/**
 * health-line.mjs: the Monday health line for the scheduled jobs in ops/jobs.json.
 *
 * Prints one line per job (last success and next due, or what is wrong and the
 * watchdog issue number), then a read-only launchd section saying whether each
 * Mac job's launchd label is loaded. The watchdog job is included: it never
 * gets an issue, so this line is how its own outage is seen.
 *
 * Usage: node scripts/ops/health-line.mjs   (needs the gh CLI signed in; read-only)
 * Exits 1 with a single line when GitHub cannot be reached, or when a job's
 * heartbeat.workflow names a workflow GitHub does not have.
 */
import { execFileSync } from 'node:child_process';
import { loadJobs } from './jobs.mjs';
import { REPO } from './heartbeat.mjs';
import { assess, gatherEvidence, cliEvidenceGh, cliIssueGh, firstDueOnOrAfter, issueTitle } from './watchdog.mjs';
import { isMain } from '../lib/is-main.mjs';

export const UNREACHABLE = 'Health check could not reach GitHub (gh failed). Check `gh auth status` and the network, then run it again.';
export const WORKFLOW_MISSING = 'Health check: GitHub has no workflow for job';
export const LABEL_PREFIX = 'co.signal-to-noise.';

/** gh's error for an unknown workflow file (HTTP 404 "workflow x.yml not found ..."). */
const NOT_FOUND_RE = /HTTP 404|could not find any workflows|workflow \S+ not found/i;

/** Wrap listRuns so a failure says which job and workflow it was about. */
function tagWorkflowErrors(gh, jobs) {
  return {
    ...gh,
    async listRuns(workflow, status) {
      try {
        return await gh.listRuns(workflow, status);
      } catch (e) {
        if (e && typeof e === 'object') e.workflow = { workflow, job: jobs.find((j) => j.heartbeat?.workflow === workflow)?.name };
        throw e;
      }
    },
  };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const dm = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const dmTime = (d) => `${dm(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
const dayDmTime = (d) => `${DAYS[d.getUTCDay()]} ${dmTime(d)}`;

/** "Mon 7 Dec 2026, 07:30 UTC" (watchdog's formatWhen) back to a Date. */
const WHEN_RE = /(?:[A-Z][a-z]{2} )?(\d{1,2}) ([A-Z][a-z]{2}) (\d{4}), (\d{2}):(\d{2}) UTC/;
function parseWhen(text) {
  const m = WHEN_RE.exec(text ?? '');
  if (!m) return undefined;
  return new Date(Date.UTC(+m[3], MONTHS.indexOf(m[2]), +m[1], +m[4], +m[5]));
}
const after = (detail, label) => {
  const i = detail.indexOf(label);
  return i < 0 ? undefined : parseWhen(detail.slice(i + label.length));
};

/** The first scheduled slot strictly after `now`. */
function nextDue(cadence, now) {
  for (let i = 0; i < 400; i++) {
    const day = new Date(now.getTime() + i * 86400e3).toISOString().slice(0, 10);
    const d = firstDueOnOrAfter(cadence, day);
    if (d.getTime() > now.getTime()) return d;
  }
  return undefined;
}

const dayOnly = (cadence, d) => (cadence.kind === 'weekly' || cadence.kind === 'daily' ? `${DAYS[d.getUTCDay()]} ${dm(d)}` : dm(d));

export function healthLines(results, openIssues, now, jobs = loadJobs()) {
  const byName = new Map(jobs.map((j) => [j.name, j]));
  return results.map((r) => {
    const cadence = byName.get(r.job)?.cadence;
    const issue = openIssues.find((i) => (i.job !== undefined ? i.job === r.job : i.title === issueTitle(r.job)));
    const tag = issue ? ` (issue #${issue.number})` : '';
    const dueAt = after(r.detail, 'Due ');
    const since = dueAt ? dayDmTime(dueAt) : 'an unknown time';
    switch (r.status) {
      case 'paused': return `⏸ ${r.job}: paused`;
      case 'ok': {
        const ok = after(r.detail, 'Last success ');
        if (ok) {
          const next = cadence ? nextDue(cadence, now) : undefined;
          return `✅ ${r.job}: last ok ${dmTime(ok)}${next ? `, next due ${dayOnly(cadence, next)}` : ''}`;
        }
        const first = after(r.detail, 'First due ');
        return `✅ ${r.job}: not run yet${first ? `, first due ${dm(first)}` : ''}`;
      }
      case 'failed': return `❌ ${r.job}: failing since ${since}${tag}`;
      case 'never-run': return `❌ ${r.job}: never run, due since ${since}${tag}`;
      default: return `❌ ${r.job}: overdue since ${since}${tag}`;
    }
  });
}

/** Read-only: is each Mac job's launchd label loaded? exec(cmd, args) throws on a non-zero exit. */
export function launchdLines(jobs, exec, uid) {
  const out = ['launchd:'];
  for (const job of jobs.filter((j) => j.runs_on === 'mac')) {
    const label = `${LABEL_PREFIX}${job.name}`;
    try {
      exec('launchctl', ['print', `gui/${uid}/${label}`]);
      out.push(`✅ ${label}: loaded`);
    } catch {
      out.push(`❌ ${label}: not loaded`);
    }
  }
  return out;
}

/** Read each heartbeat variable. A variable that does not exist is undefined; any other failure throws. */
export function readVars(jobs, readVar) {
  const vars = {};
  for (const job of jobs) {
    const name = job.heartbeat?.variable;
    if (!name) continue;
    try {
      vars[name] = String(readVar(name)).trim();
    } catch (e) {
      if (/not found|could not find|404/i.test(String(e?.stderr ?? ''))) vars[name] = undefined;
      else throw e;
    }
  }
  return vars;
}

/** Everything injected, so tests need no gh, launchctl, clock or platform. */
export async function runHealth({ jobs, now, readVar, evidenceGh, issueGh, exec, uid }) {
  let lines;
  try {
    const vars = readVars(jobs, readVar);
    const evidence = await gatherEvidence(jobs, tagWorkflowErrors(evidenceGh(vars), jobs));
    const results = assess(jobs, now, evidence);
    lines = healthLines(results, await issueGh.listOpen(), now, jobs);
  } catch (e) {
    const raw = `${e?.stderr ?? ''} ${e?.message ?? ''}`;
    if (e?.workflow && NOT_FOUND_RE.test(raw)) {
      return { lines: [`${WORKFLOW_MISSING} ${e.workflow.job}: ${e.workflow.workflow}. Fix heartbeat.workflow in ops/jobs.json.`], code: 1 };
    }
    const why = String(e?.stderr || e?.message || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    return { lines: [why ? `${UNREACHABLE} (${why})` : UNREACHABLE], code: 1 };
  }
  return { lines: [...lines, ...launchdLines(jobs, exec, uid)], code: 0 };
}

async function main() {
  const { lines, code } = await runHealth({
    jobs: loadJobs(),
    now: new Date(),
    readVar: (name) => execFileSync('gh', ['variable', 'get', name, '--repo', REPO], {
      encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'],
    }),
    evidenceGh: cliEvidenceGh,
    issueGh: cliIssueGh(),
    exec: (cmd, args) => execFileSync(cmd, args, { stdio: 'ignore', timeout: 15_000 }),
    uid: process.getuid(),
  });
  for (const l of lines) console.log(l);
  process.exitCode = code;
}

if (isMain(import.meta.url, process.argv[1])) {
  main().catch((e) => {
    console.error(`health-line: ${e?.message ?? e}`);
    process.exit(1);
  });
}
