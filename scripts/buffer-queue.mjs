#!/usr/bin/env node
/* Push posts to Buffer, which posts them to LinkedIn on schedule.
 *
 * WHY BUFFER: LinkedIn's own API is Partner-Program-gated and can't create
 * newsletters or carousels; automating your login cookie is against
 * LinkedIn's User Agreement and risks a ban (see distribution/AUTONOMY.md).
 * Buffer is an *official* LinkedIn API partner — it holds the partnership,
 * so routing posts through Buffer is the compliant way to publish to your
 * personal profile without ever touching your LinkedIn credentials.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ VERIFY BEFORE TRUSTING. Buffer has changed its API over the years.   │
 * │ This targets the documented "create update" pattern, but the exact   │
 * │ base URL / auth / field names MUST be confirmed against Buffer's     │
 * │ current developer docs on landing (buffer.com/api). The HTTP call is │
 * │ isolated in bufferCreate() so it's a one-function fix if it drifted. │
 * │ Test with --dry-run first; it prints the payload and posts nothing.  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Auth (never commit; never paste in chat — use an environment secret):
 *   BUFFER_ACCESS_TOKEN=<token>
 *   BUFFER_LINKEDIN_PROFILE_ID=<the profile id for your LinkedIn account>
 * Get the profile id once with:  node scripts/buffer-queue.mjs profiles
 *
 * Commands:
 *   profiles                     list connected Buffer profiles + ids
 *   add "<text>" [--at <ISO>]    queue one post (--at schedules; else Buffer's
 *                                next slot).  --dry-run to preview only.
 *   add-file <path> [--at <ISO>] queue a post whose body is a text file
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- env ----------

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* fall through to process.env */
  }
  return { ...env, ...process.env };
}

const ENV = loadEnv();

// Buffer's classic API base. VERIFY against current docs — Buffer has a
// newer publish API; if this 404s, update BASE and the paths below.
const BASE = ENV.BUFFER_API_BASE || 'https://api.bufferapp.com/1';

function requireToken() {
  if (!ENV.BUFFER_ACCESS_TOKEN) {
    console.error('Missing BUFFER_ACCESS_TOKEN (set as an environment secret).');
    process.exit(1);
  }
  return ENV.BUFFER_ACCESS_TOKEN;
}

// ---------- http (isolated so an API drift is a one-place fix) ----------

async function bufferGet(path) {
  const token = requireToken();
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${token}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function bufferCreate({ profileId, text, scheduledAt }) {
  const token = requireToken();
  // Classic Buffer: POST /updates/create.json, form-encoded.
  const body = new URLSearchParams();
  body.append('profile_ids[]', profileId);
  body.append('text', text);
  if (scheduledAt) body.append('scheduled_at', scheduledAt); // ISO 8601
  body.append('access_token', token);

  const res = await fetch(`${BASE}/updates/create.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const respText = await res.text();
  if (!res.ok) throw new Error(`create → ${res.status}: ${respText.slice(0, 400)}`);
  return JSON.parse(respText);
}

/* Exported for autopilot.mjs. Returns {ok, id?} or throws.
   Pass dryRun to preview without posting. */
export async function queueLinkedInPost({ text, scheduledAt, dryRun = false }) {
  const profileId = ENV.BUFFER_LINKEDIN_PROFILE_ID;
  // Dry-run must work with no credentials connected, so preview first and
  // only require the profile id when actually posting.
  if (dryRun) {
    console.log(`[dry-run] would queue to Buffer` +
      `${profileId ? ` profile ${profileId}` : ' (no BUFFER_LINKEDIN_PROFILE_ID set yet)'}` +
      `${scheduledAt ? ` at ${scheduledAt}` : ' (next slot)'}:\n${text.slice(0, 160)}…\n`);
    return { ok: true, dryRun: true };
  }
  if (!profileId) throw new Error('Missing BUFFER_LINKEDIN_PROFILE_ID');
  const r = await bufferCreate({ profileId, text, scheduledAt });
  return { ok: true, id: r?.updates?.[0]?.id ?? r?.id ?? null };
}

// ---------- CLI ----------

const [cmd, ...rest] = process.argv.slice(2);
const dryRun = rest.includes('--dry-run');
const atIdx = rest.indexOf('--at');
const scheduledAt = atIdx >= 0 ? rest[atIdx + 1] : undefined;

async function main() {
  if (cmd === 'profiles') {
    const profiles = await bufferGet('/profiles.json');
    for (const p of profiles) {
      console.log(`${p.id}\t${p.service}\t${p.formatted_username ?? p.service_username ?? ''}`);
    }
    return;
  }

  if (cmd === 'add' || cmd === 'add-file') {
    let text;
    if (cmd === 'add') {
      text = rest.find((a) => !a.startsWith('--') && a !== scheduledAt);
    } else {
      const file = rest.find((a) => !a.startsWith('--') && a !== scheduledAt);
      text = readFileSync(resolve(process.cwd(), file), 'utf8').trim();
    }
    if (!text) throw new Error('No text to post.');
    const r = await queueLinkedInPost({ text, scheduledAt, dryRun });
    console.log(dryRun ? 'Dry-run complete.' : `Queued to Buffer (id: ${r.id ?? 'n/a'}).`);
    return;
  }

  console.error('Commands: profiles | add "<text>" [--at ISO] [--dry-run] | add-file <path> [...]');
  process.exit(1);
}

// Only run CLI when invoked directly, not when imported by autopilot.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
