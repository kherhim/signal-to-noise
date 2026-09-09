#!/usr/bin/env node
/**
 * metrics-pull.mjs — pull the weekly readout numbers without a human in the loop.
 *
 *   node scripts/metrics-pull.mjs            # Substack + Cloudflare, print table, write snapshot
 *   node scripts/metrics-pull.mjs --linkedin # also print the LinkedIn browser runbook
 *   node scripts/metrics-pull.mjs --json     # JSON only, no table
 *
 * Sources
 *   Substack   — session cookie (SUBSTACK_SID in .env), aggregate-only endpoints:
 *                  /api/v1/publication/stats/subscribers            → totalEmail (free+paid count)
 *                  /api/v1/publication/stats/email_stats/30d_open_rate
 *                  /api/v1/publication/stats/publication_traffic/30d_views
 *                No subscriber rows are fetched; nothing personal is written to disk.
 *   Cloudflare — GraphQL analytics (CLOUDFLARE_ANALYTICS_TOKEN in .env, Zone→Analytics→Read).
 *                The purge token in .env cannot read analytics. Daily requests/cached so
 *                bot-burst days are visible, plus the 30-day aggregate.
 *   LinkedIn   — no API for personal post analytics; cookie scraping breaks the User
 *                Agreement. Pulled via the Chrome extension in the user's own session,
 *                using the activity URNs in distribution/metrics/linkedin-posts.json.
 *
 * Output: distribution/metrics/YYYY-MM-DD.json + a paste-ready LEARNING-LOG table.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT_DIR = path.join(ROOT, 'distribution', 'metrics');
const POSTS_FILE = path.join(OUT_DIR, 'linkedin-posts.json');
const PUB = 'https://hkher.substack.com';

const args = new Set(process.argv.slice(2));
const wantLinkedIn = args.has('--linkedin');
const jsonOnly = args.has('--json');

// ---------- env ----------
function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* fall through to process.env */
  }
  return { ...env, ...process.env };
}
const ENV = loadEnv();

// ---------- helpers ----------
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : null);

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok || json === null) {
    throw new Error(`${url} → ${res.status} ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  }
  return json;
}

// ---------- Substack ----------
async function substack() {
  const sid = ENV.SUBSTACK_SID;
  if (!sid) return { error: 'SUBSTACK_SID missing from .env' };
  const init = { headers: { cookie: `substack.sid=${sid}`, referer: `${PUB}/publish` } };
  try {
    const [subs, open, views] = await Promise.all([
      getJson(`${PUB}/api/v1/publication/stats/subscribers`, init),
      getJson(`${PUB}/api/v1/publication/stats/email_stats/30d_open_rate`, init),
      getJson(`${PUB}/api/v1/publication/stats/publication_traffic/30d_views`, init).catch(() => null),
    ]);
    return {
      subscribers: subs.totalEmail ?? null,
      paid: subs.subscribers ?? 0,
      open_rate_30d: open.openRate != null ? Math.round(open.openRate * 10) / 10 : null,
      open_rate_30d_diff: open.openRateDiff != null ? Math.round(open.openRateDiff * 10) / 10 : null,
      views_30d: views?.views30d ?? null,
      views_30d_delta: views?.viewsDelta30d ?? null,
    };
  } catch (e) {
    const msg = String(e.message);
    const auth = /→ (401|403)/.test(msg);
    return {
      error: msg,
      hint: auth
        ? 'Session cookie expired. Re-grab: log in at substack.com → DevTools → Application → Cookies → https://substack.com → copy `substack.sid` (URL-encoded form, starts s%3A) into .env as SUBSTACK_SID. Verify with `node scripts/substack-post.mjs probe`.'
        : undefined,
    };
  }
}

// ---------- Cloudflare ----------
async function cloudflare() {
  const token = ENV.CLOUDFLARE_ANALYTICS_TOKEN;
  const zone = ENV.CLOUDFLARE_ZONE_ID;
  if (!token || !zone) {
    return {
      error: 'CLOUDFLARE_ANALYTICS_TOKEN (and CLOUDFLARE_ZONE_ID) missing from .env',
      hint: 'Create it once: dash.cloudflare.com → profile icon → My Profile → API Tokens → Create Token → Create Custom Token → Permissions: Zone · Analytics · Read → Zone Resources: Include · Specific zone · signal-to-noise.co → Continue → Create. Paste the value into .env as CLOUDFLARE_ANALYTICS_TOKEN. The existing purge token cannot read analytics.',
    };
  }
  const since = daysAgo(30);
  const query = `{
    viewer { zones(filter: { zoneTag: "${zone}" }) {
      httpRequests1dGroups(limit: 31, orderBy: [date_ASC], filter: { date_geq: "${since}" }) {
        dimensions { date }
        sum { requests cachedRequests bytes cachedBytes pageViews }
        uniq { uniques }
      }
    } }
  }`;
  try {
    const j = await getJson('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (j.errors?.length) return { error: j.errors.map((e) => e.message).join('; ') };
    const days = (j.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? []).map((g) => ({
      date: g.dimensions.date,
      requests: g.sum.requests,
      cached: g.sum.cachedRequests,
      pct_cached: pct(g.sum.cachedRequests, g.sum.requests),
      page_views: g.sum.pageViews,
      uniques: g.uniq.uniques,
    }));
    const tot = days.reduce((a, d) => ({ r: a.r + d.requests, c: a.c + d.cached }), { r: 0, c: 0 });
    // Median-based bot-burst detection: a day > 5× the median request count is flagged.
    const sorted = days.map((d) => d.requests).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const burst = days.filter((d) => median && d.requests > 5 * median).map((d) => d.date);
    const clean = days.filter((d) => !burst.includes(d.date));
    const ct = clean.reduce((a, d) => ({ r: a.r + d.requests, c: a.c + d.cached }), { r: 0, c: 0 });
    // Last 7 days, one query per day (free plan caps adaptive queries at 1d): cache hit rate on
    // non-404 responses only (what "is the Cache Rule working" actually means) and 404 volume,
    // which on this site is almost entirely vulnerability scanners probing /.env, wp-*, actuator…
    const last7 = [];
    for (let i = 7; i >= 1; i--) {
      const d = daysAgo(i);
      const q7 = `{ viewer { zones(filter: { zoneTag: "${zone}" }) {
        ok: httpRequestsAdaptiveGroups(limit: 10, filter: { date: "${d}", edgeResponseStatus_lt: 400 }) { count dimensions { cacheStatus } }
        nf: httpRequestsAdaptiveGroups(limit: 1, filter: { date: "${d}", edgeResponseStatus: 404 }) { count }
      } } }`;
      try {
        const r = await getJson('https://api.cloudflare.com/client/v4/graphql', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ query: q7 }),
        });
        const z = r.data?.viewer?.zones?.[0];
        if (!z) continue;
        const ok = z.ok.reduce((a, g) => a + g.count, 0);
        const hit = z.ok
          .filter((g) => ['hit', 'revalidated'].includes(g.dimensions.cacheStatus))
          .reduce((a, g) => a + g.count, 0);
        last7.push({ date: d, non404: ok, hit, pct_hit_non404: pct(hit, ok), not_found: z.nf[0]?.count ?? 0 });
      } catch {
        /* skip day */
      }
    }
    const s7 = last7.reduce((a, d) => ({ ok: a.ok + d.non404, hit: a.hit + d.hit, nf: a.nf + d.not_found }), { ok: 0, hit: 0, nf: 0 });
    return {
      since,
      hit_rate_non404_7d: pct(s7.hit, s7.ok),
      not_found_7d: s7.nf,
      last7,
      requests_30d: tot.r,
      cached_30d: tot.c,
      pct_cached_30d: pct(tot.c, tot.r),
      burst_days: burst,
      pct_cached_excl_bursts: pct(ct.c, ct.r),
      days,
    };
  } catch (e) {
    return { error: String(e.message) };
  }
}

// ---------- LinkedIn runbook ----------
function linkedinRunbook() {
  let posts = [];
  try {
    posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8')).posts ?? [];
  } catch {
    /* no registry yet */
  }
  const lines = [
    'LinkedIn has no API for personal post analytics, and cookie scraping breaks the User Agreement.',
    'Pull it through the Chrome extension in your own logged-in session (Claude Code: "pull LinkedIn metrics"):',
    '  1. Followers: https://www.linkedin.com/in/me/recent-activity/all/ (left card, "Followers").',
    '  2. Per post: open https://www.linkedin.com/analytics/post-summary/urn:li:activity:<id>/',
    '     wait ~5s for the Discovery card, read: impressions, in/out-of-network %, members reached,',
    '     reactions, comments, reposts, saves, followers gained. Newsletter editions also show',
    '     article views and email sends.',
    '  3. New posts: read the activity page, take the "View analytics" href for each, add to',
    `     ${path.relative(ROOT, POSTS_FILE)}.`,
    '',
    'Registered posts:',
    ...posts.map((p) => `  - ${p.label.padEnd(34)} ${p.posted}  https://www.linkedin.com/analytics/post-summary/urn:li:activity:${p.activity}/`),
  ];
  return lines.join('\n');
}

// ---------- main ----------
const [ss, cf] = await Promise.all([substack(), cloudflare()]);
const snapshot = { date: today, substack: ss, cloudflare: cf };

fs.mkdirSync(OUT_DIR, { recursive: true });
const outFile = path.join(OUT_DIR, `${today}.json`);
fs.writeFileSync(outFile, JSON.stringify(snapshot, null, 2) + '\n');

if (jsonOnly) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  const row = (n, metric, value, note = '') => `| ${n} | ${metric} | ${value} | ${note} |`;
  const out = [];
  out.push(`Readout — ${today}`);
  out.push('');
  out.push('| # | Metric | Value | Note |');
  out.push('|---|---|---|---|');
  if (ss.error) {
    out.push(row(2, 'Substack subscribers', '_error_', ss.error + (ss.hint ? ` — ${ss.hint}` : '')));
  } else {
    out.push(row(2, 'Substack subscribers', `**${ss.subscribers}**`, `30d open rate ${ss.open_rate_30d}% (${ss.open_rate_30d_diff >= 0 ? '+' : ''}${ss.open_rate_30d_diff} pts)${ss.views_30d != null ? `; 30d site views ${ss.views_30d}` : ''}`));
  }
  if (cf.error) {
    out.push(row(6, 'Cloudflare percent cached (30d)', '_error_', cf.error + (cf.hint ? ` — ${cf.hint}` : '')));
  } else {
    const burst = cf.burst_days.length ? `bot-burst days excluded: ${cf.burst_days.join(', ')} → **${cf.pct_cached_excl_bursts}%** clean` : 'no bot-burst days detected';
    out.push(row(6, 'Cloudflare percent cached (30d)', `**${cf.pct_cached_30d}%** (${cf.cached_30d.toLocaleString()} / ${cf.requests_30d.toLocaleString()})`, burst));
    out.push(row('6b', 'Cache hit rate, non-404 responses (7d)', `**${cf.hit_rate_non404_7d}%**`, `the real Cache Rule read; ${cf.not_found_7d.toLocaleString()} 404s in 7d (scanner probes, not audience)`));
  }
  out.push('');
  out.push(`Snapshot written: ${path.relative(ROOT, outFile)}`);
  if (wantLinkedIn) {
    out.push('');
    out.push(linkedinRunbook());
  }
  console.log(out.join('\n'));
}
