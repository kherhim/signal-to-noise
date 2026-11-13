/**
 * watchdog.mjs: daily health check for the scheduled jobs in ops/jobs.json.
 *
 * For each job it gathers evidence (GitHub Actions runs for workflow jobs, the
 * heartbeat repo variable for Mac jobs), judges it against the cadence, and
 * keeps one GitHub issue per unhealthy job: open it, comment only when the
 * status or detail changes, close it on recovery.
 *
 * A job is judged against the latest slot whose grace has already expired,
 * lastDue(cadence, now - grace). It is unhealthy when that slot is on or after
 * the job's first due time and there is no success at or after it.
 *
 * The watchdog job itself is assessed but never gets an issue; the Monday
 * health line reports it. Paused jobs never alert and their issues are left
 * alone. Exits 0 when jobs are unhealthy (the issues are the alert); non-zero
 * only for its own errors.
 *
 * Usage: node scripts/ops/watchdog.mjs   (env: GH_TOKEN, VARS_JSON, PRETEND_NOW)
 */
import { execFileSync } from 'node:child_process';
import { loadJobs } from './jobs.mjs';
import { periodStart, parseHeartbeat, REPO } from './heartbeat.mjs';
import { isMain } from '../lib/is-main.mjs';

export const ISSUE_PREFIX = 'Scheduled job needs attention: ';
export const SELF = 'watchdog';
const HOUR = 3600e3;
const MARKER_RE = /<!-- watchdog-state: ([^\s]*) -->/;
const GH_TIMEOUT_MS = 30_000;

export const issueTitle = (job) => `${ISSUE_PREFIX}${job}`;

/** The most recent scheduled time at or before `now`. */
export function lastDue(cadence, now) {
  return periodStart(cadence, now);
}

/** The first scheduled time on or after midnight UTC of `since` ("YYYY-MM-DD"). */
export function firstDueOnOrAfter(cadence, since) {
  const start = new Date(`${since}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) throw new Error(`bad since date ${since}`);
  // Probe forward an hour at a time; slots are at least a day apart, so the
  // first probe whose period starts on or after `start` names that slot.
  for (let t = start.getTime(); t < start.getTime() + 400 * 24 * HOUR; t += HOUR) {
    const p = periodStart(cadence, new Date(t));
    if (p.getTime() >= start.getTime()) return p;
  }
  throw new Error(`no scheduled time within 400 days of ${since}`);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

/** "Mon 7 Dec 2026, 07:30 UTC" */
export function formatWhen(d) {
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

const hours = (n) => `${n} hour${n === 1 ? '' : 's'}`;

/**
 * Judge each job. `evidence[name]` may hold lastOk (Date) and lastFailed ({at, reason}).
 * The detail text depends only on the slot and the evidence, never on `now`
 * itself, so an unchanged state gives an identical detail day after day.
 */
export function assess(jobs, now, evidence = {}) {
  return jobs.map((job) => {
    if (job.paused) return { job: job.name, status: 'paused', detail: 'Paused in ops/jobs.json.' };
    const ev = evidence[job.name] ?? {};
    const lastOk = ev.lastOk;
    const lastFailed = ev.lastFailed;
    const first = firstDueOnOrAfter(job.cadence, job.since);
    const due = lastDue(job.cadence, new Date(now.getTime() - job.grace_hours * HOUR));
    const okLine = lastOk ? `Last success ${formatWhen(lastOk)}.` : 'No success on record.';

    if (due.getTime() < first.getTime()) {
      return { job: job.name, status: 'ok', detail: lastOk ? okLine : `Not due yet. First due ${formatWhen(first)}.` };
    }
    if (lastOk && lastOk.getTime() >= due.getTime()) return { job: job.name, status: 'ok', detail: okLine };

    const dueLine = `Due ${formatWhen(due)}, with ${hours(job.grace_hours)} grace.`;
    if (lastFailed && (!lastOk || lastFailed.at.getTime() > lastOk.getTime())) {
      const raw = String(lastFailed.reason ?? '').trim();
      // A run URL stays bare so it is clickable; any other text goes in a code
      // span so `@name` or `#12` in an error never pings or cross-links.
      const why = !raw ? 'no reason recorded' : /^https:\/\/\S+$/.test(raw) ? raw : `\`${raw.replace(/`/g, "'")}\``;
      return { job: job.name, status: 'failed', detail: `${dueLine} The latest run failed: ${why} ${okLine}` };
    }
    if (!lastOk && !lastFailed) {
      return { job: job.name, status: 'never-run', detail: `${dueLine} No run on record since it was added.` };
    }
    return { job: job.name, status: 'overdue', detail: `${dueLine} ${okLine}` };
  });
}

const stateKey = (r) => encodeURIComponent(`${r.status}|${r.detail}`);
const marker = (r) => `<!-- watchdog-state: ${stateKey(r)} -->`;
const UNHEALTHY = new Set(['overdue', 'failed', 'never-run']);
const LABEL = { overdue: 'is overdue', failed: 'is failing', 'never-run': 'has never run' };

function openBody(r) {
  return [
    `The scheduled job \`${r.job}\` ${LABEL[r.status]}.`,
    '',
    r.detail,
    '',
    'The daily watchdog keeps this issue up to date and closes it when the job next succeeds. Job settings live in `ops/jobs.json`.',
    '',
    marker(r),
  ].join('\n');
}

const commentBody = (r) => [`Still unhealthy: \`${r.job}\` ${LABEL[r.status]}.`, '', r.detail, '', marker(r)].join('\n');
const closeBody = (r) => [`Recovered: \`${r.job}\` is healthy again.`, '', r.detail, '', marker(r)].join('\n');

/**
 * Keep one issue per unhealthy job. gh: { listOpen(prefix) -> [{number, title, lastBody?}],
 * open(title, body), comment(n, body), close(n, body) }. `lastBody` is the newest
 * issue or comment body carrying a watchdog marker, when the adapter knows it.
 */
export async function syncIssues(results, gh) {
  const open = await gh.listOpen(ISSUE_PREFIX);
  for (const r of results) {
    if (r.job === SELF || r.status === 'paused') continue;
    const title = issueTitle(r.job);
    const issue = open.filter((i) => i.title === title).sort((a, b) => a.number - b.number)[0];
    if (UNHEALTHY.has(r.status)) {
      if (!issue) await gh.open(title, openBody(r));
      else {
        const prev = MARKER_RE.exec(issue.lastBody ?? '')?.[1];
        if (prev !== stateKey(r)) await gh.comment(issue.number, commentBody(r));
      }
    } else if (r.status === 'ok' && issue) {
      await gh.close(issue.number, closeBody(r));
    }
  }
}

/** Parse the `${{ toJSON(vars) }}` value. Throws rather than treating every Mac job as never run. */
export function parseVarsJson(text) {
  if (typeof text !== 'string' || text.trim() === '') throw new Error('VARS_JSON is not set');
  let v;
  try { v = JSON.parse(text); } catch { throw new Error('VARS_JSON is not valid JSON'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('VARS_JSON must be a JSON object');
  return v;
}

/**
 * Collect evidence. gh: { listRuns(workflow, 'success' | 'failure') -> [{createdAt, url}] newest first,
 * vars: Record<string, string> }. Only the named heartbeat variables are read.
 */
export async function gatherEvidence(jobs, gh) {
  const out = {};
  for (const job of jobs) {
    if (job.paused) continue;
    const ev = {};
    if (job.heartbeat.workflow) {
      const [ok] = await gh.listRuns(job.heartbeat.workflow, 'success');
      const [bad] = await gh.listRuns(job.heartbeat.workflow, 'failure');
      if (ok) ev.lastOk = new Date(ok.createdAt);
      if (bad) ev.lastFailed = { at: new Date(bad.createdAt), reason: bad.url };
    } else {
      const hb = parseHeartbeat(gh.vars?.[job.heartbeat.variable]);
      if (hb?.status === 'ok') ev.lastOk = hb.at;
      else if (hb?.status === 'failed') ev.lastFailed = { at: hb.at, reason: hb.reason };
    }
    out[job.name] = ev;
  }
  return out;
}

// ---------- CLI adapters ----------

function gh(args) {
  return execFileSync('gh', [...args, '--repo', REPO], {
    encoding: 'utf8', timeout: GH_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function cliEvidenceGh(vars) {
  return {
    vars,
    async listRuns(workflow, status) {
      return JSON.parse(gh(['run', 'list', '--workflow', workflow, '--status', status, '--limit', '1', '--json', 'createdAt,url']));
    },
  };
}

export function cliIssueGh() {
  return {
    async listOpen(prefix) {
      const issues = JSON.parse(gh(['issue', 'list', '--state', 'open', '--limit', '200', '--json', 'number,title,body,comments']));
      return issues.filter((i) => i.title.startsWith(prefix)).map((i) => {
        const bodies = [i.body ?? '', ...(i.comments ?? []).map((c) => c.body ?? '')];
        return { number: i.number, title: i.title, lastBody: bodies.filter((b) => MARKER_RE.test(b)).at(-1) };
      });
    },
    async open(title, body) { gh(['issue', 'create', '--title', title, '--body', body]); },
    async comment(n, body) { gh(['issue', 'comment', String(n), '--body', body]); },
    async close(n, body) { gh(['issue', 'close', String(n), '--comment', body]); },
  };
}

export function resolveNow(pretend) {
  if (pretend === undefined || pretend.trim() === '') return new Date();
  const d = new Date(pretend.trim());
  if (Number.isNaN(d.getTime())) throw new Error('PRETEND_NOW is not a valid ISO date');
  return d;
}

async function main() {
  const now = resolveNow(process.env.PRETEND_NOW);
  const jobs = loadJobs();
  const vars = parseVarsJson(process.env.VARS_JSON);
  const evidence = await gatherEvidence(jobs, cliEvidenceGh(vars));
  const results = assess(jobs, now, evidence);
  console.log(`[watchdog] checked at ${formatWhen(now)}`);
  for (const r of results) console.log(`[watchdog] ${r.job}: ${r.status}. ${r.detail}`);
  await syncIssues(results, cliIssueGh());
}

if (isMain(import.meta.url, process.argv[1])) {
  main().catch((e) => {
    console.error(`[watchdog] ${e?.message ?? e}`);
    process.exit(1);
  });
}
