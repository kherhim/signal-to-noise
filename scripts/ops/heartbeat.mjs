/**
 * heartbeat.mjs: catch-up and heartbeats for the jobs that run on the Mac.
 *
 * A Mac job fires at its weekly slot and again at a daily catch-up slot (and
 * at load). runWithHeartbeat runs the job at most once per cadence period: if
 * the job's repo variable already holds an ok heartbeat stamped at or after the
 * start of the current period, the run is skipped. Otherwise the job runs and
 * the outcome is written back as
 *
 *   ok:<ISO>            on time
 *   ok:<ISO>:late       more than LATE_HOURS after the slot
 *   failed:<ISO>:<why>  the job threw (reason flattened, max 100 chars)
 *
 * The heartbeat never decides the job's result: an unreadable variable means
 * the job runs, and a failed write is logged and ignored.
 *
 * No side effects at import time; the watchdog imports periodStart and
 * parseHeartbeat from here.
 */
import { execFileSync } from 'node:child_process';
import { loadJobs } from './jobs.mjs';

export const REPO = 'kherhim/signal-to-noise';
export const LATE_HOURS = 6;
const GH_TIMEOUT_MS = 30_000;
const REASON_MAX = 100;
const DAY = 864e5;

/** Start of the cadence period containing `now`: the latest slot at or before it (UTC). */
export function periodStart(cadence, now) {
  const t = now.getTime();
  const min = cadence.minute ?? 0;
  const h = cadence.hour_utc;
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const d = now.getUTCDate();
  switch (cadence.kind) {
    case 'daily': {
      const s = Date.UTC(y, mo, d, h, min);
      return new Date(s <= t ? s : s - DAY);
    }
    case 'weekly': {
      const dow = now.getUTCDay() || 7; // 1 = Monday ... 7 = Sunday
      const back = (dow - cadence.weekday + 7) % 7;
      const s = Date.UTC(y, mo, d - back, h, min);
      return new Date(s <= t ? s : s - 7 * DAY);
    }
    case 'monthly': {
      const s = Date.UTC(y, mo, cadence.day, h, min);
      return new Date(s <= t ? s : Date.UTC(y, mo - 1, cadence.day, h, min));
    }
    case 'quarterly': {
      for (let i = 0; i <= 12; i++) {
        const s = Date.UTC(y, mo - i, cadence.day, h, min);
        const m = new Date(s).getUTCMonth() + 1;
        if (cadence.months.includes(m) && s <= t) return new Date(s);
      }
      throw new Error('quarterly cadence has no valid months');
    }
    default:
      throw new Error(`unknown cadence kind ${cadence.kind}`);
  }
}

const HB_RE = /^(ok|failed):(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)(?::([\s\S]*))?$/;

/** Parse a heartbeat variable. Returns null when absent or malformed. */
export function parseHeartbeat(value) {
  if (typeof value !== 'string') return null;
  const m = HB_RE.exec(value.trim());
  if (!m) return null;
  const at = new Date(m[2]);
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 19) !== m[2].slice(0, 19)) return null;
  if (m[1] === 'ok') {
    if (m[3] !== undefined && m[3] !== 'late') return null;
    return { status: 'ok', at, late: m[3] === 'late' };
  }
  return { status: 'failed', at, late: false, reason: m[3] ?? '' };
}

const flatten = (s) => String(s ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim().slice(0, REASON_MAX);

export function formatHeartbeat({ status, at, late, reason }) {
  const iso = at.toISOString();
  if (status === 'ok') return `ok:${iso}${late ? ':late' : ''}`;
  if (status === 'failed') return `failed:${iso}:${flatten(reason)}`;
  throw new Error(`unknown heartbeat status ${status}`);
}

const ghExec = (cmd, args, opts) => execFileSync(cmd, args, opts);

/** Read a repo variable. A variable that does not exist yet reads as undefined; anything else throws. */
export async function ghReadVar(name, { exec = ghExec } = {}) {
  try {
    return String(exec('gh', ['variable', 'get', name, '--repo', REPO], {
      encoding: 'utf8', timeout: GH_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } catch (e) {
    const stderr = String(e.stderr ?? '');
    if (/was not found/i.test(stderr)) return undefined;
    throw new Error(`gh variable get ${name}: ${stderr.trim() || e.message}`);
  }
}

export async function ghWriteVar(name, value, { exec = ghExec } = {}) {
  try {
    exec('gh', ['variable', 'set', name, '--repo', REPO, '--body', value], {
      encoding: 'utf8', timeout: GH_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    throw new Error(`gh variable set ${name}: ${String(e.stderr ?? '').trim() || e.message}`);
  }
}

const errText = (e) => (e && e.message) || String(e);

/**
 * Run `fn` unless this period's heartbeat already says ok.
 * Resolves 'skipped' or 'ok'; if `fn` throws, the failure is written and the
 * original error rethrown (that is the 'failed' outcome).
 */
export async function runWithHeartbeat(jobName, fn, deps = {}) {
  const {
    now = new Date(),
    readVar = ghReadVar,
    writeVar = ghWriteVar,
    log = (m) => console.log(m),
  } = deps;
  const say = (m) => log(`[heartbeat] ${jobName}: ${m}`);

  let job;
  try {
    const jobs = deps.jobs ?? loadJobs();
    job = jobs.find((j) => j.name === jobName);
    if (!job) say('not in ops/jobs.json; running without a heartbeat');
    else if (!job.heartbeat?.variable) { say('has no heartbeat variable; running without a heartbeat'); job = undefined; }
  } catch (e) {
    say(`could not load ops/jobs.json (${errText(e)}); running without a heartbeat`);
    job = undefined;
  }
  if (!job) { await fn(); return 'ok'; }

  const variable = job.heartbeat.variable;
  const start = periodStart(job.cadence, now);
  let hb = null;
  try {
    hb = parseHeartbeat(await readVar(variable));
  } catch (e) {
    say(`could not read ${variable} (${errText(e)}); running anyway`);
  }
  if (hb && hb.status === 'ok' && hb.at.getTime() >= start.getTime()) {
    say(`already ran this period (${hb.at.toISOString()}, period from ${start.toISOString()}); skipping`);
    return 'skipped';
  }

  const late = now.getTime() - start.getTime() > LATE_HOURS * 3600e3;
  let error;
  try {
    await fn();
  } catch (e) {
    error = e ?? new Error('job failed');
  }
  const value = error
    ? formatHeartbeat({ status: 'failed', at: now, late, reason: errText(error) })
    : formatHeartbeat({ status: 'ok', at: now, late });
  try {
    await writeVar(variable, value);
    say(`wrote ${variable}=${value}`);
  } catch (e) {
    say(`could not write ${variable} (${errText(e)})`);
  }
  if (error) throw error;
  return 'ok';
}
