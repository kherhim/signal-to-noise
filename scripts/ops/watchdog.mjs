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
 * the job's first due time and there is no success at or after it (for a Mac
 * job, an ok less than LATE_HOURS before the slot also counts; see okCoversSlot).
 *
 * The watchdog job itself is assessed but never gets an issue; the Monday
 * health line reports it. Paused jobs never alert and their issues are left
 * alone. Exits 0 when jobs are unhealthy (the issues are the alert); non-zero
 * only for its own errors.
 *
 * Usage: node scripts/ops/watchdog.mjs   (env: GH_TOKEN, PRETEND_NOW, one HEARTBEAT_* per Mac job)
 */
import { execFileSync } from 'node:child_process';
import { loadJobs } from './jobs.mjs';
import { periodStart, parseHeartbeat, okCoversSlot, REPO } from './heartbeat.mjs';
import { isMain } from '../lib/is-main.mjs';

export const ISSUE_PREFIX = 'Scheduled job needs attention: ';
export const SELF = 'watchdog';
const HOUR = 3600e3;
const STATE_RE = /<!-- watchdog-state: (\S*) -->/g;
const JOB_RE = /^<!-- watchdog-job: ([a-z0-9-]+) -->/;
/** Accounts whose issues and comments the watchdog trusts (gh JSON shows app authors as app/<name>). */
export const BOT_LOGINS = new Set(['github-actions', 'app/github-actions', 'github-actions[bot]']);
export const DRY_RUN_TAG = '(dry run)';
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
    // A Mac job's catch-up can land just before the slot (in BST its 07:45
    // local fire is 06:45Z) and then cover it, as runWithHeartbeat does.
    const covered = job.heartbeat.variable ? okCoversSlot(lastOk, due) : lastOk && lastOk.getTime() >= due.getTime();
    if (covered) return { job: job.name, status: 'ok', detail: okLine };

    const dueLine = `Due ${formatWhen(due)}, with ${hours(job.grace_hours)} grace.`;
    // A failure counts as this slot's outcome only if it happened at or after
    // the due time; an older failure with nothing since is simply overdue.
    if (lastFailed && lastFailed.at.getTime() >= due.getTime()) {
      return { job: job.name, status: 'failed', detail: `${dueLine} The latest run failed: ${reasonText(lastFailed.reason)} ${okLine}` };
    }
    if (!lastOk && !lastFailed) {
      return { job: job.name, status: 'never-run', detail: `${dueLine} No run on record since it was added.` };
    }
    const earlier = lastFailed && (!lastOk || lastFailed.at.getTime() > lastOk.getTime())
      ? ` No run since an earlier failure: ${reasonText(lastFailed.reason)}` : '';
    return { job: job.name, status: 'overdue', detail: `${dueLine} ${okLine}${earlier}` };
  });
}

/**
 * Render a failure reason for a public issue. Whitespace is flattened; a run
 * URL stays bare so it is clickable; any other text goes in a code span so
 * `@name` or `#12` in an error never pings or cross-links.
 */
function reasonText(reason) {
  const raw = String(reason ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return 'no reason recorded.';
  if (/^https:\/\/\S+$/.test(raw)) return raw;
  return `\`${raw.replace(/`/g, "'")}\``;
}

const stateKey = (r) => encodeURIComponent(`${r.status}|${r.detail}`);
const marker = (r) => `<!-- watchdog-state: ${stateKey(r)} -->`;
const UNHEALTHY = new Set(['overdue', 'failed', 'never-run']);
const LABEL = { overdue: 'is overdue', failed: 'is failing', 'never-run': 'has never run' };

function openBody(r) {
  return [
    `<!-- watchdog-job: ${r.job} -->`,
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

/** The last state marker in a body (ours is always at the end; earlier ones may be quoted text). */
export function lastStateKey(body) {
  return [...String(body ?? '').matchAll(STATE_RE)].at(-1)?.[1];
}

const isBot = (author) => !!author && BOT_LOGINS.has(author.login);

/**
 * Turn gh's issue JSON ({number, title, body, author}) plus that issue's full
 * comment list ({author, body}[]) into what syncIssues needs, or null when the
 * issue is not one of ours. Only bot-authored issues count, the job comes from
 * the hidden job marker at the top of the opening body (the title is display
 * only), and state is read only from bot-authored bodies.
 */
export function toOpenIssue(issue, comments = []) {
  if (!isBot(issue.author)) return null;
  const job = JOB_RE.exec(String(issue.body ?? '').trimStart())?.[1];
  if (!job) return null;
  const bodies = [issue.body ?? '', ...comments.filter((c) => isBot(c.author)).map((c) => c.body ?? '')];
  return { number: issue.number, title: issue.title, job, lastBody: bodies.filter((b) => lastStateKey(b) !== undefined).at(-1) };
}

/**
 * Keep one issue per unhealthy job. gh: { listOpen(prefix) -> [{number, title, job?, lastBody?}],
 * open(title, body), comment(n, body), close(n, body) }. An issue belongs to a
 * job by its `job` (from the hidden marker); fixtures without one match on the
 * exact title. `lastBody` is the newest bot body carrying a state marker.
 */
export async function syncIssues(results, gh) {
  const open = await gh.listOpen(ISSUE_PREFIX);
  for (const r of results) {
    if (r.job === SELF || r.status === 'paused') continue;
    const title = issueTitle(r.job);
    const issue = open
      .filter((i) => (i.job !== undefined ? i.job === r.job : i.title === title))
      .sort((a, b) => a.number - b.number)[0];
    if (UNHEALTHY.has(r.status)) {
      if (!issue) await gh.open(title, openBody(r));
      else {
        if (lastStateKey(issue.lastBody) !== stateKey(r)) await gh.comment(issue.number, commentBody(r));
      }
    } else if (r.status === 'ok' && issue) {
      await gh.close(issue.number, closeBody(r));
    }
  }
}

/**
 * Build the heartbeat values from the environment: one env entry per
 * heartbeat.variable in ops/jobs.json (the workflow passes each explicitly).
 * An entry missing altogether is a wiring fault and throws, rather than
 * making a Mac job look as if it never ran; an empty value is no evidence.
 */
export function varsFromEnv(jobs, env) {
  const vars = {};
  for (const job of jobs) {
    const name = job.heartbeat?.variable;
    if (!name) continue;
    if (!Object.hasOwn(env, name)) throw new Error(`${name} is not passed to the watchdog`);
    vars[name] = env[name];
  }
  return vars;
}

const latestReal = (runs) => runs.find((r) => !String(r.displayTitle ?? '').includes(DRY_RUN_TAG));

/**
 * Collect evidence. gh: { listRuns(workflow, 'success' | 'failure') -> [{createdAt, url, displayTitle}]
 * newest first, vars: Record<string, string> }. Runs titled "(dry run)" are not
 * evidence. Only the named heartbeat variables are read.
 */
export async function gatherEvidence(jobs, gh) {
  const out = {};
  for (const job of jobs) {
    if (job.paused) continue;
    const ev = {};
    if (job.heartbeat.workflow) {
      const ok = latestReal(await gh.listRuns(job.heartbeat.workflow, 'success'));
      const bad = latestReal(await gh.listRuns(job.heartbeat.workflow, 'failure'));
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

const ghExec = (cmd, args, opts) => execFileSync(cmd, args, opts);

function makeGh(exec = ghExec) {
  return (args) => exec('gh', [...args, '--repo', REPO], {
    encoding: 'utf8', timeout: GH_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * gh passes --author to GraphQL `createdBy`, which only matches the bot login
 * `github-actions[bot]` (`app/github-actions` and `github-actions` return
 * nothing). The JSON then reports the author as `app/github-actions`, which
 * toOpenIssue checks again on the client side.
 */
export const ISSUE_AUTHOR = 'github-actions[bot]';

export function cliEvidenceGh(vars, { exec } = {}) {
  const gh = makeGh(exec);
  return {
    vars,
    async listRuns(workflow, status) {
      // A window of 20 so a few dry runs cannot hide the last real one.
      return JSON.parse(gh(['run', 'list', '--workflow', workflow, '--branch', 'main', '--status', status,
        '--limit', '20', '--json', 'createdAt,url,displayTitle']));
    },
  };
}

export function cliIssueGh({ exec } = {}) {
  const gh = makeGh(exec);
  return {
    async listOpen() {
      const issues = JSON.parse(gh(['issue', 'list', '--state', 'open', '--author', ISSUE_AUTHOR,
        '--limit', '200', '--json', 'number,title,body,author']));
      const out = [];
      for (const i of issues) {
        if (!toOpenIssue(i)) continue;
        // `gh issue list --json comments` returns only the first 100 comments;
        // `gh issue view` returns them all, so the newest is never missed.
        const { comments } = JSON.parse(gh(['issue', 'view', String(i.number), '--json', 'comments']));
        const mine = toOpenIssue(i, comments);
        if (mine) out.push(mine);
      }
      return out;
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
  const vars = varsFromEnv(jobs, process.env);
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
