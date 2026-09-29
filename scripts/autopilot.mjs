#!/usr/bin/env node
/* Autopilot — post the due items from a pre-approved queue, hands-off.
 *
 * This is the runner a scheduled Routine invokes (see distribution/AUTONOMY.md).
 * It does NOT write content. It only publishes items you already reviewed and
 * placed in the queue, within hard guardrails. That distinction is the whole
 * safety model: the creative decision (what to say) stays human; only the
 * mechanical decision (send the thing you already approved, today) is automated.
 *
 * Queue: distribution/autopilot/queue/*.md — one file per scheduled post:
 *   ---
 *   date: 2026-08-10          # publish on/after this date (UTC)
 *   channel: linkedin         # linkedin (Substack channel removed 29 Sep 2026)
 *   type: post
 *   status: pending           # pending | posted | skipped   (autopilot updates)
 *   ---
 *   <the exact body to publish>
 *
 * GUARDRAILS (all on by default):
 *   1. Dry-run unless --live is passed. The Routine passes --live.
 *   2. A file named distribution/autopilot/PAUSE halts everything (kill switch).
 *   3. (was: Substack send_email guard; channel removed 29 Sep 2026)
 *   4. Max --max N posts per run (default 2) — no runaway.
 *   5. Freshness: items whose date is >7 days stale are skipped, not posted late.
 *   6. Idempotent: status flips to `posted`, so re-runs never double-post.
 *   7. Every action is appended to distribution/autopilot/log.md (audit trail).
 *
 * Usage:
 *   node scripts/autopilot.mjs            # dry-run: show what WOULD post today
 *   node scripts/autopilot.mjs --live     # actually post due items
 *   node scripts/autopilot.mjs --live --max 1
 *   node scripts/autopilot.mjs --date 2026-08-10   # simulate a given day
 */

import {
  readFileSync, writeFileSync, readdirSync, existsSync, appendFileSync, mkdirSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queueLinkedInPost } from './buffer-queue.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE_DIR = resolve(ROOT, 'distribution/autopilot/queue');
const PAUSE_FILE = resolve(ROOT, 'distribution/autopilot/PAUSE');
const LOG_FILE = resolve(ROOT, 'distribution/autopilot/log.md');

const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const maxIdx = args.indexOf('--max');
const MAX = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 2;
const dateIdx = args.indexOf('--date');
// NOTE: pass --date in the Routine prompt, since new Date() is fine here (this
// is a normal script, not a workflow). Default to today (UTC date part).
const TODAY = dateIdx >= 0 ? args[dateIdx + 1] : new Date().toISOString().slice(0, 10);
const STALE_DAYS = 7;

function log(line) {
  const stamp = new Date().toISOString();
  const entry = `- ${stamp} — ${line}`;
  console.log(entry);
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, entry + '\n');
  } catch { /* logging is best-effort */ }
}

// ---------- guardrails ----------

if (existsSync(PAUSE_FILE)) {
  log('PAUSE file present — autopilot halted, nothing posted.');
  process.exit(0);
}
if (!existsSync(QUEUE_DIR)) {
  console.log(`No queue dir at ${QUEUE_DIR}. Nothing to do.`);
  process.exit(0);
}

// ---------- parse queue ----------

function parseItem(file) {
  const raw = readFileSync(resolve(QUEUE_DIR, file), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^(\w+):\s*(.*)$/);
    if (mm) meta[mm[1]] = mm[2].replace(/^["']|["']$/g, '').trim();
  }
  return { file, meta, body: m[2].trim(), raw };
}

function daysBetween(a, b) {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);
}

const items = readdirSync(QUEUE_DIR)
  .filter((f) => f.endsWith('.md'))
  .map(parseItem)
  .filter(Boolean)
  .filter((it) => (it.meta.status ?? 'pending') === 'pending')
  .filter((it) => it.meta.date && it.meta.date <= TODAY)
  .sort((a, b) => (a.meta.date < b.meta.date ? -1 : 1));

if (!items.length) {
  console.log(`No pending items due on/before ${TODAY}.`);
  process.exit(0);
}

// ---------- dispatch ----------

function markStatus(item, status) {
  const newRaw = item.raw.replace(/status:\s*.*$/m, `status: ${status}`);
  writeFileSync(resolve(QUEUE_DIR, item.file), newRaw, 'utf8');
}

async function postLinkedIn(item) {
  return queueLinkedInPost({ text: item.body, dryRun: !LIVE });
}

// ---------- run ----------

log(`Autopilot ${LIVE ? 'LIVE' : 'DRY-RUN'} — ${TODAY} — ${items.length} due, cap ${MAX}`);

let done = 0;
for (const item of items) {
  if (done >= MAX) { log(`Hit --max ${MAX}; ${items.length - done} left for next run.`); break; }

  const stale = daysBetween(TODAY, item.meta.date) > STALE_DAYS;
  if (stale) {
    log(`SKIP (stale >${STALE_DAYS}d): ${item.file} (was due ${item.meta.date})`);
    if (LIVE) markStatus(item, 'skipped');
    continue;
  }

  try {
    let res;
    if (item.meta.channel === 'linkedin') res = await postLinkedIn(item);
    else { log(`SKIP (unknown channel): ${item.file}`); continue; }

    if (LIVE && res?.ok && !res.dryRun) {
      markStatus(item, 'posted');
      log(`POSTED ${item.meta.channel}: ${item.file}${res.id ? ` (id ${res.id})` : ''}`);
      done++;
    } else if (!LIVE) {
      log(`would post ${item.meta.channel}: ${item.file}`);
      done++;
    }
  } catch (e) {
    // A failure leaves status pending so the next run retries; it does not
    // crash the whole batch.
    log(`ERROR ${item.file}: ${String(e.message).slice(0, 200)}`);
  }
}

log(`Autopilot done — ${done} ${LIVE ? 'posted' : 'previewed'}.`);
