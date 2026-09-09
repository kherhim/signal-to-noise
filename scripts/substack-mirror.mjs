#!/usr/bin/env node
/**
 * substack-mirror.mjs — mirror newly published essays to Substack, hands-off.
 *
 * The mirror is mechanical: the Substack body is the essay body verbatim plus an
 * "Originally published at" backlink, and the subtitle is the essay excerpt. This
 * script finds essays that are live on the site, at least MIN_AGE_HOURS old (the
 * head start is the only duplicate-content mitigation — Substack has no canonical
 * field), not yet on Substack, and publishes them with an email to subscribers.
 *
 *   node scripts/substack-mirror.mjs                 # dry run: report what would post
 *   node scripts/substack-mirror.mjs --live          # actually draft + publish + email
 *   node scripts/substack-mirror.mjs --live --max 1  # cap per run (default 1)
 *   node scripts/substack-mirror.mjs --slug <slug>   # consider only this essay
 *   node scripts/substack-mirror.mjs --no-email      # publish without emailing
 *
 * Guardrails
 *   - dry run unless --live
 *   - only essays dated on/after SINCE (default 2026-08-01) — the back catalogue is
 *     already mirrored and must never be re-emailed
 *   - essay must return 200 on the live site (committed ≠ deployed)
 *   - skipped if a Substack post with the same title or slug already exists
 *     (public archive, paginated) or if the slug is in the ledger
 *   - max 1 post per run by default
 *   - kill switch: distribution/autopilot/PAUSE
 *   - ledger distribution/substack-mirror-ledger.json + log ~/Library/Logs/signal2noise-substack-mirror.log
 *   - a hand-written hook in _sources/substack-hooks/<slug>.md is used if present
 *     (so a bespoke subtitle survives); otherwise one is generated there
 *
 * Auth: SUBSTACK_SID in .env (see substack-post.mjs). Publishing is delegated to
 * substack-post.mjs so the tested draft/publish path is the only one that posts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SITE = 'https://signal-to-noise.co';
const PUB = 'https://hkher.substack.com';
const ESSAYS = path.join(ROOT, 'src', 'content', 'insights');
const HOOKS = path.join(ROOT, '_sources', 'substack-hooks');
const LEDGER = path.join(ROOT, 'distribution', 'substack-mirror-ledger.json');
const LOG = path.join(process.env.HOME ?? ROOT, 'Library', 'Logs', 'signal2noise-substack-mirror.log');
const PAUSE = path.join(ROOT, 'distribution', 'autopilot', 'PAUSE');
const POSTER = path.join(ROOT, 'scripts', 'substack-post.mjs');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const LIVE = flag('--live');
const MAX = Number(opt('--max', 1));
const ONLY = opt('--slug', null);
const SEND_EMAIL = !flag('--no-email');
const MIN_AGE_HOURS = Number(opt('--min-age-hours', 48));
const SINCE = opt('--since', '2026-08-01');

const now = new Date();
const stamp = () => now.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
function log(line) {
  const s = `${stamp()}  ${LIVE ? 'LIVE' : 'DRY '}  ${line}`;
  console.log(s);
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, s + '\n');
}
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ---------- essays ----------
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2].trim() };
}

function loadEssays() {
  return fs
    .readdirSync(ESSAYS)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      const p = parseFrontmatter(fs.readFileSync(path.join(ESSAYS, f), 'utf8'));
      if (!p) return null;
      return { slug, ...p.meta, body: p.body };
    })
    .filter(Boolean);
}

// ---------- substack state ----------
async function substackTitles() {
  const seen = { titles: new Set(), slugs: new Set() };
  // The archive endpoint caps page size inconsistently; page in 12s and stop when a
  // page adds nothing new.
  const ids = new Set();
  for (let offset = 0; offset < 2000; offset += 12) {
    const res = await fetch(`${PUB}/api/v1/archive?sort=new&limit=12&offset=${offset}`);
    if (!res.ok) throw new Error(`archive ${res.status}`);
    const posts = await res.json();
    let fresh = 0;
    for (const p of posts) {
      if (ids.has(p.id)) continue;
      ids.add(p.id);
      fresh++;
      seen.titles.add(norm(p.title));
      seen.slugs.add(p.slug);
    }
    if (!posts.length || !fresh) break;
  }
  seen.count = ids.size;
  return seen;
}

function loadLedger() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  } catch {
    return { mirrored: {} };
  }
}

async function isLive(slug) {
  try {
    const r = await fetch(`${SITE}/insights/${slug}/`, { method: 'HEAD', redirect: 'follow' });
    return r.status === 200;
  } catch {
    return false;
  }
}

// ---------- hook ----------
function buildHook(e) {
  const body = e.body
    .replace(/\]\((\/[^)\s]+)\)/g, `](${SITE}$1)`) // relative links → absolute
    .replace(/^import .*$/gm, '')
    .trim();
  const subtitle = (e.excerpt ?? '').replace(/"/g, '“');
  return `---
title: "${e.title.replace(/"/g, '“')}"
subtitle: "${subtitle}"
canonical: ${SITE}/insights/${e.slug}/
---

${body}

---

Originally published at [signal-to-noise.co](${SITE}/insights/${e.slug}/), where every essay carries its own cover and the full archive lives.
`;
}

function hookPath(e) {
  const p = path.join(HOOKS, `${e.slug}.md`);
  if (fs.existsSync(p)) {
    // Refresh the body from the essay (the site is the source of truth) but keep
    // a hand-written title/subtitle.
    const existing = parseFrontmatter(fs.readFileSync(p, 'utf8'));
    if (existing?.meta?.title) {
      const fresh = buildHook({ ...e, title: existing.meta.title, excerpt: existing.meta.subtitle ?? e.excerpt });
      fs.writeFileSync(p, fresh);
      return p;
    }
  }
  fs.mkdirSync(HOOKS, { recursive: true });
  fs.writeFileSync(p, buildHook(e));
  return p;
}

// ---------- publish (via substack-post.mjs) ----------
function poster(argv) {
  const r = spawnSync(process.execPath, [POSTER, ...argv], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`substack-post.mjs ${argv[0]} failed: ${(r.stderr || r.stdout).slice(0, 400)}`);
  return r.stdout;
}

// ---------- main ----------
if (flag('--print-hook')) {
  // Test aid: build the hook for one essay to stdout without touching disk or Substack.
  const e = loadEssays().find((x) => x.slug === opt('--print-hook', null));
  if (!e) throw new Error('unknown slug');
  process.stdout.write(buildHook(e));
  process.exit(0);
}
if (fs.existsSync(PAUSE)) {
  log('PAUSE file present — nothing done');
  process.exit(0);
}

const ledger = loadLedger();
const seen = await substackTitles();
log(`substack archive: ${seen.count} posts`);
const cutoff = new Date(now.getTime() - MIN_AGE_HOURS * 3600e3);

const candidates = loadEssays()
  .filter((e) => !ONLY || e.slug === ONLY)
  .filter((e) => e.draft !== 'true')
  .filter((e) => e.date && e.date >= SINCE)
  .filter((e) => new Date(e.date + 'T09:00:00Z') <= cutoff)
  .sort((a, b) => (a.date < b.date ? -1 : 1));

let posted = 0;
for (const e of candidates) {
  if (posted >= MAX) break;
  const why = [];
  if (ledger.mirrored[e.slug]) why.push('in ledger');
  if (seen.slugs.has(e.slug) || seen.titles.has(norm(e.title))) why.push('already on Substack');
  if (why.length) {
    if (ONLY) log(`skip ${e.slug}: ${why.join(', ')}`);
    continue;
  }
  if (!(await isLive(e.slug))) {
    log(`skip ${e.slug}: not live on ${SITE} yet`);
    continue;
  }

  const hook = hookPath(e);
  if (!LIVE) {
    log(`would mirror ${e.slug} (dated ${e.date}) from ${path.relative(ROOT, hook)}${SEND_EMAIL ? ' + email' : ''}`);
    posted++;
    continue;
  }
  try {
    const out = poster(['draft', hook]);
    const id = out.match(/Draft (\d+):/)?.[1];
    if (!id) throw new Error(`no draft id in: ${out.slice(0, 200)}`);
    const pub = poster(['publish', id, ...(SEND_EMAIL ? ['--send-email'] : [])]);
    const url = pub.match(/https?:\/\/\S+/)?.[0] ?? '';
    ledger.mirrored[e.slug] = { draft: Number(id), url, at: now.toISOString(), emailed: SEND_EMAIL };
    fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
    log(`MIRRORED ${e.slug} → ${url} (draft ${id}${SEND_EMAIL ? ', emailed' : ''})`);
    posted++;
  } catch (err) {
    log(`ERROR ${e.slug}: ${String(err.message).replace(/\s+/g, ' ')}`);
    process.exitCode = 1;
    break;
  }
}
if (!posted) log(`nothing to mirror (${candidates.length} candidates checked)`);
