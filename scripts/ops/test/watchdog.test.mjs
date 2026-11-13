import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lastDue, firstDueOnOrAfter, assess, syncIssues, gatherEvidence, formatWhen, issueTitle, varsFromEnv, resolveNow, toOpenIssue, lastStateKey, cliIssueGh, cliEvidenceGh,
} from '../watchdog.mjs';
import { periodStart } from '../heartbeat.mjs';
import { loadJobs } from '../jobs.mjs';
import fs from 'node:fs';
import yaml from 'js-yaml';

const WF = (f) => yaml.load(fs.readFileSync(new URL(`../../../.github/workflows/${f}`, import.meta.url), 'utf8'));

const D = (s) => new Date(s);
const MONTHLY = { kind: 'monthly', day: 1, hour_utc: 11 };
const WEEKLY = { kind: 'weekly', weekday: 1, hour_utc: 7, minute: 30 };
const DAILY = { kind: 'daily', hour_utc: 5 };

const tokenPrices = (extra = {}) => ({
  name: 'token-prices', runs_on: 'actions', since: '2026-09-01', cadence: MONTHLY, grace_hours: 48,
  heartbeat: { workflow: 'token-prices.yml' }, ...extra,
});
const metrics = (extra = {}) => ({
  name: 'metrics', runs_on: 'mac', since: '2026-09-01', cadence: WEEKLY, grace_hours: 24,
  heartbeat: { variable: 'HEARTBEAT_METRICS' }, ...extra,
});
const watchdog = (extra = {}) => ({
  name: 'watchdog', runs_on: 'actions', since: '2026-11-13', cadence: DAILY, grace_hours: 48,
  heartbeat: { workflow: 'watchdog.yml' }, ...extra,
});
const one = (jobs, now, evidence = {}) => assess(jobs, D(now), evidence)[0];

// ---------- lastDue / firstDueOnOrAfter ----------

test('lastDue is periodStart', () => {
  for (const [c, now] of [[MONTHLY, '2026-11-04T12:00:00Z'], [WEEKLY, '2026-11-18T00:00:00Z'], [DAILY, '2026-11-13T04:00:00Z']]) {
    assert.equal(lastDue(c, D(now)).toISOString(), periodStart(c, D(now)).toISOString());
  }
});

test('firstDueOnOrAfter: slot at midnight on the since date counts', () => {
  assert.equal(firstDueOnOrAfter({ kind: 'daily', hour_utc: 0 }, '2026-11-13').toISOString(), '2026-11-13T00:00:00.000Z');
  assert.equal(firstDueOnOrAfter({ kind: 'monthly', day: 1, hour_utc: 0 }, '2026-12-01').toISOString(), '2026-12-01T00:00:00.000Z');
});

test('firstDueOnOrAfter: slot later the same day, and weekly with minutes', () => {
  assert.equal(firstDueOnOrAfter(DAILY, '2026-11-13').toISOString(), '2026-11-13T05:00:00.000Z');
  // 2026-11-13 is a Friday; next Monday is 16 Nov.
  assert.equal(firstDueOnOrAfter(WEEKLY, '2026-11-13').toISOString(), '2026-11-16T07:30:00.000Z');
  assert.equal(firstDueOnOrAfter(WEEKLY, '2026-11-16').toISOString(), '2026-11-16T07:30:00.000Z');
});

test('firstDueOnOrAfter: monthly rolls to next month, quarterly crosses the year end', () => {
  assert.equal(firstDueOnOrAfter(MONTHLY, '2026-11-13').toISOString(), '2026-12-01T11:00:00.000Z');
  const q = { kind: 'quarterly', months: [2, 5, 8, 11], day: 1, hour_utc: 9 };
  assert.equal(firstDueOnOrAfter(q, '2026-11-13').toISOString(), '2027-02-01T09:00:00.000Z');
});

// ---------- assess ----------

test('ok when the last success follows the last due time', () => {
  const r = one([tokenPrices()], '2026-11-04T12:00:00Z', { 'token-prices': { lastOk: D('2026-11-01T11:03:00Z') } });
  assert.equal(r.job, 'token-prices');
  assert.equal(r.status, 'ok');
  assert.match(r.detail, /Sun 1 Nov 2026, 11:03 UTC/);
});

test('overdue after grace with no success', () => {
  const r = one([tokenPrices()], '2026-11-04T12:00:00Z', { 'token-prices': { lastOk: D('2026-10-01T11:00:00Z') } });
  assert.equal(r.status, 'overdue');
  assert.match(r.detail, /Sun 1 Nov 2026, 11:00 UTC/);
});

test('ok within grace even though the latest slot has no success yet', () => {
  const r = one([tokenPrices()], '2026-11-02T12:00:00Z', { 'token-prices': { lastOk: D('2026-10-01T11:00:00Z') } });
  assert.equal(r.status, 'ok');
});

test('failed when the heartbeat says failed', () => {
  const r = one([metrics()], '2026-11-18T09:00:00Z', {
    metrics: { lastOk: D('2026-11-09T07:30:00Z'), lastFailed: { at: D('2026-11-16T07:30:00Z'), reason: 'fetch failed' } },
  });
  assert.equal(r.status, 'failed');
  assert.match(r.detail, /fetch failed/);
});

test('failed beats overdue only when the latest evidence is a failure', () => {
  const r = one([metrics()], '2026-11-18T09:00:00Z', {
    metrics: { lastOk: D('2026-11-09T07:30:00Z'), lastFailed: { at: D('2026-11-02T07:30:00Z'), reason: 'old' } },
  });
  assert.equal(r.status, 'overdue');
});

test('a success at or after the due time is ok even after a later failure', () => {
  const r = one([metrics()], '2026-11-18T09:00:00Z', {
    metrics: { lastOk: D('2026-11-16T07:30:00Z'), lastFailed: { at: D('2026-11-17T07:30:00Z'), reason: 'x' } },
  });
  assert.equal(r.status, 'ok');
});

test('new job is not overdue before its first due time', () => {
  const job = tokenPrices({ since: '2026-11-13' });
  // First due is 1 Dec 11:00; still ok inside the grace window.
  assert.equal(one([job], '2026-11-20T00:00:00Z').status, 'ok');
  assert.equal(one([job], '2026-12-03T10:59:00Z').status, 'ok');
  const r = one([job], '2026-12-03T11:01:00Z');
  assert.equal(r.status, 'never-run');
  assert.match(r.detail, /Tue 1 Dec 2026, 11:00 UTC/);
});

test('a failure before the first due time is not unhealthy yet', () => {
  const job = tokenPrices({ since: '2026-11-13' });
  const r = one([job], '2026-11-20T00:00:00Z', { 'token-prices': { lastFailed: { at: D('2026-11-14T00:00:00Z'), reason: 'x' } } });
  assert.equal(r.status, 'ok');
});

test('grace as long as the period still catches a dead daily job', () => {
  // Watchdog itself: daily 05:00, 48 h grace. Last ok three and a half days ago.
  const r = one([watchdog()], '2026-11-20T12:00:00Z', { watchdog: { lastOk: D('2026-11-17T05:00:00Z') } });
  assert.equal(r.status, 'overdue');
  const fine = one([watchdog()], '2026-11-20T12:00:00Z', { watchdog: { lastOk: D('2026-11-18T05:01:00Z') } });
  assert.equal(fine.status, 'ok');
});

test('a dead weekly job stays overdue across the next slot (no false recovery)', () => {
  const ev = { metrics: { lastOk: D('2026-11-02T07:30:00Z') } };
  assert.equal(one([metrics()], '2026-11-10T09:00:00Z', ev).status, 'overdue');
  // Next slot 16 Nov 07:30; the day after it, still within that slot's grace.
  assert.equal(one([metrics()], '2026-11-17T05:00:00Z', ev).status, 'overdue');
});

test('detail does not change with now while the state is unchanged', () => {
  const ev = { metrics: { lastOk: D('2026-11-02T07:30:00Z') } };
  assert.equal(one([metrics()], '2026-11-10T09:00:00Z', ev).detail, one([metrics()], '2026-11-11T05:00:00Z', ev).detail);
});

test('paused jobs are reported as paused and never alert', async () => {
  const r = one([metrics({ paused: true })], '2026-12-30T00:00:00Z');
  assert.equal(r.status, 'paused');
  const calls = [];
  const gh = fakeGh(calls, [{ number: 9, title: issueTitle('metrics') }]);
  await syncIssues([r], gh);
  assert.deepEqual(calls.filter((c) => c[0] !== 'listOpen'), []);
});

test('assess returns one result per job, in order', () => {
  const rs = assess([tokenPrices(), metrics()], D('2026-11-04T12:00:00Z'), {});
  assert.deepEqual(rs.map((r) => r.job), ['token-prices', 'metrics']);
});

// ---------- syncIssues ----------

function fakeGh(calls, open = []) {
  return {
    async listOpen(prefix) { calls.push(['listOpen', prefix]); return open; },
    async open(title, body) { calls.push(['open', title, body]); },
    async comment(n, body) { calls.push(['comment', n, body]); },
    async close(n, body) { calls.push(['close', n, body]); },
  };
}

test('issue title is exact', () => {
  assert.equal(issueTitle('metrics'), 'Scheduled job needs attention: metrics');
});

test('opens one issue for an unhealthy job with no open issue', async () => {
  const calls = [];
  await syncIssues([{ job: 'metrics', status: 'overdue', detail: 'Due Mon 9 Nov 2026, 07:30 UTC.' }], fakeGh(calls));
  const opens = calls.filter((c) => c[0] === 'open');
  assert.equal(opens.length, 1);
  assert.equal(opens[0][1], 'Scheduled job needs attention: metrics');
  assert.match(opens[0][2], /Due Mon 9 Nov 2026, 07:30 UTC/);
  assert.match(opens[0][2], /The scheduled job `metrics` is overdue\./);
});

test('updates the open issue, never opens a second', async () => {
  const calls = [];
  const gh = fakeGh(calls, [{ number: 12, title: issueTitle('metrics') }]);
  await syncIssues([{ job: 'metrics', status: 'overdue', detail: 'Due Mon 9 Nov 2026, 07:30 UTC.' }], gh);
  assert.equal(calls.filter((c) => c[0] === 'open').length, 0);
  const comments = calls.filter((c) => c[0] === 'comment');
  assert.equal(comments.length, 1);
  assert.equal(comments[0][1], 12);
});

test('closes the issue on recovery', async () => {
  const calls = [];
  const gh = fakeGh(calls, [{ number: 12, title: issueTitle('metrics') }]);
  const [r] = assess([metrics()], D('2026-11-17T09:00:00Z'), { metrics: { lastOk: D('2026-11-16T07:31:00Z') } });
  await syncIssues([r], gh);
  const closes = calls.filter((c) => c[0] === 'close');
  assert.equal(closes.length, 1);
  assert.equal(closes[0][1], 12);
  assert.match(closes[0][2], /Mon 16 Nov 2026, 07:31 UTC/);
  assert.equal(calls.filter((c) => c[0] === 'open' || c[0] === 'comment').length, 0);
});

test('ok with no open issue does nothing', async () => {
  const calls = [];
  await syncIssues([{ job: 'metrics', status: 'ok', detail: 'Last success Mon 16 Nov 2026, 07:31 UTC.' }], fakeGh(calls));
  assert.deepEqual(calls.filter((c) => c[0] !== 'listOpen'), []);
});

test('never touches an issue for the watchdog job, unhealthy or recovered', async () => {
  for (const status of ['overdue', 'ok', 'never-run', 'failed']) {
    const calls = [];
    await syncIssues([{ job: 'watchdog', status, detail: 'x' }], fakeGh(calls, [{ number: 3, title: issueTitle('watchdog') }]));
    assert.deepEqual(calls.filter((c) => c[0] !== 'listOpen'), [], status);
    const calls2 = [];
    await syncIssues([{ job: 'watchdog', status, detail: 'x' }], fakeGh(calls2));
    assert.deepEqual(calls2.filter((c) => c[0] !== 'listOpen'), [], status);
  }
});

test('titles match exactly, not by prefix', async () => {
  const calls = [];
  const gh = fakeGh(calls, [{ number: 4, title: issueTitle('metrics-extra') }]);
  await syncIssues([{ job: 'metrics', status: 'overdue', detail: 'd' }], gh);
  assert.equal(calls.filter((c) => c[0] === 'open').length, 1);
  assert.equal(calls.filter((c) => c[0] === 'comment').length, 0);
});

test('round trip: open, then silence, then one comment on change, then close', async () => {
  const issues = [];
  let next = 1;
  const calls = [];
  const gh = {
    async listOpen() { return issues.filter((i) => i.open).map((i) => ({ number: i.number, title: i.title, lastBody: i.bodies.at(-1) })); },
    async open(title, body) { calls.push('open'); issues.push({ number: next++, title, open: true, bodies: [body] }); },
    async comment(n, body) { calls.push('comment'); issues.find((i) => i.number === n).bodies.push(body); },
    async close(n, body) { calls.push('close'); const i = issues.find((x) => x.number === n); i.bodies.push(body); i.open = false; },
  };
  const ev1 = { metrics: { lastOk: D('2026-11-02T07:30:00Z') } };
  await syncIssues(assess([metrics()], D('2026-11-10T09:00:00Z'), ev1), gh);
  await syncIssues(assess([metrics()], D('2026-11-11T05:00:00Z'), ev1), gh);
  assert.deepEqual(calls, ['open']);
  const ev2 = { metrics: { lastOk: D('2026-11-02T07:30:00Z'), lastFailed: { at: D('2026-11-11T07:30:00Z'), reason: 'boom' } } };
  await syncIssues(assess([metrics()], D('2026-11-12T05:00:00Z'), ev2), gh);
  await syncIssues(assess([metrics()], D('2026-11-13T05:00:00Z'), ev2), gh);
  // A daily re-stamped failure with the same reason does not add a comment.
  const ev3 = { metrics: { lastOk: D('2026-11-02T07:30:00Z'), lastFailed: { at: D('2026-11-13T07:30:00Z'), reason: 'boom' } } };
  await syncIssues(assess([metrics()], D('2026-11-14T05:00:00Z'), ev3), gh);
  assert.deepEqual(calls, ['open', 'comment']);
  const ev4 = { metrics: { lastOk: D('2026-11-16T07:30:00Z') } };
  await syncIssues(assess([metrics()], D('2026-11-17T05:00:00Z'), ev4), gh);
  assert.deepEqual(calls, ['open', 'comment', 'close']);
  assert.equal(issues.length, 1);
});

test('a human comment after ours does not cause a duplicate when marker found in lastBody', async () => {
  // The CLI adapter passes the newest body carrying the marker as lastBody.
  const calls = [];
  const r = { job: 'metrics', status: 'overdue', detail: 'Due Mon 9 Nov 2026, 07:30 UTC.' };
  const log = [];
  await syncIssues([r], fakeGh(log));
  const body = log.find((c) => c[0] === 'open')[2];
  const gh = fakeGh(calls, [{ number: 5, title: issueTitle('metrics'), lastBody: body }]);
  await syncIssues([r], gh);
  assert.equal(calls.filter((c) => c[0] === 'comment').length, 0);
});

test('every generated body: British, no em dash, no "ledger", dates in house style', async () => {
  const bodies = [];
  const gh = {
    async listOpen() { return [{ number: 1, title: issueTitle('token-prices') }]; },
    async open(t, b) { bodies.push(b); }, async comment(n, b) { bodies.push(b); }, async close(n, b) { bodies.push(b); },
  };
  const now = D('2026-12-07T09:00:00Z');
  const jobs = [tokenPrices(), metrics(), metrics({ name: 'humaniser-learn', since: '2026-12-01', heartbeat: { variable: 'HEARTBEAT_HUMANISER_LEARN' } })];
  for (const ev of [
    {},
    { 'token-prices': { lastOk: D('2026-12-01T11:02:00Z') }, metrics: { lastFailed: { at: D('2026-11-30T07:30:00Z'), reason: 'run https://x/1' } } },
    { 'token-prices': { lastOk: D('2026-10-01T11:00:00Z') }, metrics: { lastOk: D('2026-11-23T07:30:00Z') } },
  ]) await syncIssues(assess(jobs, now, ev), gh);
  assert.ok(bodies.length >= 4);
  for (const b of bodies) {
    assert.ok(!b.includes('—'), b);
    assert.ok(!/ledger/i.test(b), b);
    assert.match(b, /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}, \d{2}:\d{2} UTC/, b);
    assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(b.replace(/<!--[\s\S]*?-->/g, '')), b);
  }
});

test('formatWhen uses the house style regardless of locale', () => {
  assert.equal(formatWhen(D('2026-12-07T07:30:00Z')), 'Mon 7 Dec 2026, 07:30 UTC');
  assert.equal(formatWhen(D('2027-01-01T00:05:00Z')), 'Fri 1 Jan 2027, 00:05 UTC');
});

// ---------- gatherEvidence ----------

function runsGh(table, vars = {}) {
  const calls = [];
  return {
    calls,
    async listRuns(workflow, status) { calls.push([workflow, status]); return table[`${workflow}:${status}`] ?? []; },
    vars,
  };
}

test('gatherEvidence: workflow jobs use latest success and latest failure with its URL', async () => {
  const gh = runsGh({
    'token-prices.yml:success': [{ createdAt: '2026-11-01T11:00:05Z', url: 'https://github.com/o/r/actions/runs/1' }],
    'token-prices.yml:failure': [{ createdAt: '2026-10-01T11:00:05Z', url: 'https://github.com/o/r/actions/runs/0' }],
  });
  const ev = await gatherEvidence([tokenPrices()], gh);
  assert.equal(ev['token-prices'].lastOk.toISOString(), '2026-11-01T11:00:05.000Z');
  assert.equal(ev['token-prices'].lastFailed.at.toISOString(), '2026-10-01T11:00:05.000Z');
  assert.equal(ev['token-prices'].lastFailed.reason, 'https://github.com/o/r/actions/runs/0');
});

test('gatherEvidence: a workflow with zero runs is no evidence', async () => {
  const ev = await gatherEvidence([tokenPrices()], runsGh({}));
  assert.deepEqual(ev['token-prices'] ?? {}, {});
  assert.equal(assess([tokenPrices()], D('2026-11-04T12:00:00Z'), ev)[0].status, 'never-run');
});

test('gatherEvidence: variable jobs parse the named heartbeat only', async () => {
  const vars = {
    HEARTBEAT_METRICS: 'failed:2026-11-16T07:30:00.000Z:fetch failed',
    HEARTBEAT_HUMANISER_LEARN: 'ok:2026-11-16T07:45:00.000Z',
    OTHER: 'secret-looking',
  };
  const jobs = [metrics(), metrics({ name: 'humaniser-learn', heartbeat: { variable: 'HEARTBEAT_HUMANISER_LEARN' } })];
  const ev = await gatherEvidence(jobs, runsGh({}, vars));
  assert.equal(ev.metrics.lastFailed.reason, 'fetch failed');
  assert.equal(ev.metrics.lastFailed.at.toISOString(), '2026-11-16T07:30:00.000Z');
  assert.equal(ev.metrics.lastOk, undefined);
  assert.equal(ev['humaniser-learn'].lastOk.toISOString(), '2026-11-16T07:45:00.000Z');
});

test('gatherEvidence: missing or malformed heartbeat variable is no evidence', async () => {
  const ev = await gatherEvidence([metrics()], runsGh({}, { HEARTBEAT_METRICS: 'garbage' }));
  assert.deepEqual(ev.metrics ?? {}, {});
  const ev2 = await gatherEvidence([metrics()], runsGh({}, {}));
  assert.deepEqual(ev2.metrics ?? {}, {});
});

test('gatherEvidence: paused jobs are skipped', async () => {
  const gh = runsGh({});
  await gatherEvidence([tokenPrices({ paused: true })], gh);
  assert.deepEqual(gh.calls, []);
});

test('varsFromEnv reads only the heartbeat variables and throws when one is not passed', () => {
  const jobs = [tokenPrices(), metrics()];
  assert.deepEqual(varsFromEnv(jobs, { HEARTBEAT_METRICS: 'ok:2026-11-16T07:30:00.000Z', SECRET: 'x' }), { HEARTBEAT_METRICS: 'ok:2026-11-16T07:30:00.000Z' });
  assert.deepEqual(varsFromEnv(jobs, { HEARTBEAT_METRICS: '' }), { HEARTBEAT_METRICS: '' });
  assert.throws(() => varsFromEnv(jobs, {}), /HEARTBEAT_METRICS is not passed/);
});

test('every heartbeat.variable in ops/jobs.json has its env line in watchdog.yml', () => {
  const step = WF('watchdog.yml').jobs.check.steps.find((st) => /watchdog\.mjs/.test(st.run ?? ''));
  const vars = loadJobs().map((j) => j.heartbeat.variable).filter(Boolean);
  assert.ok(vars.length >= 2);
  for (const v of vars) assert.equal(step.env[v], `\${{ vars.${v} }}`, v);
  assert.equal(step.env.VARS_JSON, undefined);
  assert.ok(!JSON.stringify(step.env).includes('toJSON'));
});

test('dry and verification runs are titled "(dry run)"', () => {
  const tp = WF('token-prices.yml');
  assert.match(tp['run-name'], /inputs\.dry && 'Token prices \(dry run\)'/);
  const wd = WF('watchdog.yml');
  assert.match(wd['run-name'], /inputs\.pretend_now && '[^']*\(dry run\)'/);
  assert.equal(wd.on.schedule[0].cron, '0 5 * * *');
  assert.deepEqual(wd.permissions, { actions: 'read', issues: 'write', contents: 'read' });
});

test('gatherEvidence ignores dry runs and takes the newest real run', async () => {
  const gh = runsGh({
    'token-prices.yml:success': [
      { createdAt: '2026-11-20T10:00:00Z', url: 'u/3', displayTitle: 'Token prices (dry run)' },
      { createdAt: '2026-11-01T11:00:05Z', url: 'u/1', displayTitle: 'Token prices' },
    ],
    'token-prices.yml:failure': [{ createdAt: '2026-11-21T10:00:00Z', url: 'u/4', displayTitle: 'Token prices (dry run)' }],
  });
  const ev = await gatherEvidence([tokenPrices()], gh);
  assert.equal(ev['token-prices'].lastOk.toISOString(), '2026-11-01T11:00:05.000Z');
  assert.equal(ev['token-prices'].lastFailed, undefined);
});

test('a failure before the current due slot is overdue, not failed', () => {
  const r = one([tokenPrices()], '2026-11-04T12:00:00Z', {
    'token-prices': { lastOk: D('2026-10-01T11:00:00Z'), lastFailed: { at: D('2026-10-15T11:00:00Z'), reason: 'https://x/runs/5' } },
  });
  assert.equal(r.status, 'overdue');
  assert.match(r.detail, /earlier failure: https:\/\/x\/runs\/5/);
});

// ---------- issue ownership and markers ----------

const BOT = { login: 'app/github-actions', is_bot: true };
const BOT_C = { login: 'github-actions' };

async function openedBody(r) {
  const log = [];
  await syncIssues([r], fakeGh(log));
  return log.find((c) => c[0] === 'open')[2];
}

test('an issue by another author with a matching title and markers is ignored', async () => {
  const r = { job: 'metrics', status: 'overdue', detail: 'Due Mon 9 Nov 2026, 07:30 UTC.' };
  const body = await openedBody(r);
  const fake = { number: 66, title: issueTitle('metrics'), body, author: { login: 'mallory', is_bot: false } };
  assert.equal(toOpenIssue(fake, []), null);
  const calls = [];
  await syncIssues([r], fakeGh(calls, [toOpenIssue(fake, [])].filter(Boolean)));
  assert.equal(calls.filter((c) => c[0] === 'open').length, 1);
  assert.equal(calls.filter((c) => c[0] === 'comment' || c[0] === 'close').length, 0);
});

test('state is read only from bot comments', async () => {
  const r = { job: 'metrics', status: 'overdue', detail: 'Due Mon 9 Nov 2026, 07:30 UTC.' };
  const body = await openedBody(r);
  const changed = { ...r, detail: 'Due Mon 16 Nov 2026, 07:30 UTC.' };
  const human = { author: { login: 'mallory' }, body: `<!-- watchdog-state: ${encodeURIComponent(`${changed.status}|${changed.detail}`)} -->` };
  const issue = toOpenIssue({ number: 7, title: 'x', body, author: BOT }, [human]);
  assert.equal(issue.lastBody, body);
  const calls = [];
  await syncIssues([changed], fakeGh(calls, [issue]));
  assert.equal(calls.filter((c) => c[0] === 'comment').length, 1);
});

test('a retitled bot issue is still found by its job marker and updated, not duplicated', async () => {
  const r = { job: 'metrics', status: 'overdue', detail: 'Due Mon 9 Nov 2026, 07:30 UTC.' };
  const body = await openedBody(r);
  const issue = toOpenIssue({ number: 8, title: 'Metrics job broken (renamed by owner)', body, author: BOT }, []);
  assert.equal(issue.job, 'metrics');
  const calls = [];
  await syncIssues([{ ...r, detail: 'Due Mon 16 Nov 2026, 07:30 UTC.' }], fakeGh(calls, [issue]));
  assert.deepEqual(calls.filter((c) => c[0] !== 'listOpen').map((c) => [c[0], c[1]]), [['comment', 8]]);
  const calls2 = [];
  await syncIssues([{ job: 'metrics', status: 'ok', detail: 'Last success Mon 16 Nov 2026, 07:31 UTC.' }], fakeGh(calls2, [issue]));
  assert.deepEqual(calls2.filter((c) => c[0] !== 'listOpen').map((c) => [c[0], c[1]]), [['close', 8]]);
});

test('a bot issue without the job marker is not ours', () => {
  assert.equal(toOpenIssue({ number: 9, title: issueTitle('metrics'), body: 'hand written', author: BOT }, []), null);
});

test('newest bot comment wins as lastBody', async () => {
  const body = await openedBody({ job: 'metrics', status: 'overdue', detail: 'a' });
  const c1 = { author: BOT_C, body: 'x\n<!-- watchdog-state: one -->' };
  const c2 = { author: BOT_C, body: 'y\n<!-- watchdog-state: two -->' };
  const issue = toOpenIssue({ number: 1, title: 't', body, author: BOT }, [c1, { author: BOT_C, body: 'no marker' }, c2]);
  assert.equal(lastStateKey(issue.lastBody), 'two');
});

test('the last state marker in a body wins, so a reason carrying a fake marker cannot pin state', async () => {
  const r = assess([metrics()], D('2026-11-18T09:00:00Z'), {
    metrics: { lastFailed: { at: D('2026-11-16T07:30:00Z'), reason: '<!-- watchdog-state: forged -->' } },
  })[0];
  const body = await openedBody(r);
  assert.notEqual(lastStateKey(body), 'forged');
  const calls = [];
  await syncIssues([r], fakeGh(calls, [{ number: 3, title: issueTitle('metrics'), lastBody: body }]));
  assert.equal(calls.filter((c) => c[0] === 'comment').length, 0);
});

test('reasons are flattened to one line before the code span', async () => {
  const [r] = assess([metrics()], D('2026-11-18T09:00:00Z'), {
    metrics: { lastFailed: { at: D('2026-11-16T07:30:00Z'), reason: 'boom\n  ping @someone\tnow' } },
  });
  assert.match(r.detail, /`boom ping @someone now`/);
  const body = await openedBody(r);
  const outside = body.replace(/<!--[\s\S]*?-->/g, '').replace(/`[^`]*`/g, '');
  assert.ok(!outside.includes('@someone'), body);
});


test('resolveNow: empty means real now, ISO is used, garbage throws', () => {
  assert.equal(resolveNow('2026-12-04T12:00:00Z').toISOString(), '2026-12-04T12:00:00.000Z');
  assert.ok(resolveNow('') instanceof Date);
  assert.ok(resolveNow(undefined) instanceof Date);
  assert.throws(() => resolveNow('not a date'), /PRETEND_NOW/);
});

test('the real registry lists the watchdog last, daily 05:00 with 48 h grace', async () => {
  const { loadJobs } = await import('../jobs.mjs');
  const jobs = loadJobs();
  assert.deepEqual(jobs.at(-1), {
    name: 'watchdog', runs_on: 'actions', since: '2026-11-13', cadence: { kind: 'daily', hour_utc: 5 }, grace_hours: 48, heartbeat: { workflow: 'watchdog.yml' },
  });
});

test('failure reasons cannot mention people or issues in public bodies', async () => {
  const [r] = assess([metrics()], D('2026-11-18T09:00:00Z'), {
    metrics: { lastFailed: { at: D('2026-11-16T07:30:00Z'), reason: 'Cannot find module @scope/pkg, see #12 and `x`' } },
  });
  const calls = [];
  await syncIssues([r], fakeGh(calls));
  await syncIssues([r], fakeGh(calls, [{ number: 2, title: issueTitle('metrics') }]));
  const bodies = calls.filter((c) => c[0] === 'open' || c[0] === 'comment').map((c) => c[2]);
  assert.equal(bodies.length, 2);
  for (const b of bodies) {
    const outside = b.replace(/<!--[\s\S]*?-->/g, '').replace(/`[^`]*`/g, '');
    assert.ok(!/@scope|#12/.test(outside), b);
    assert.ok(b.includes("`Cannot find module @scope/pkg, see #12 and 'x'`"), b);
  }
});

test('a run URL reason stays bare and clickable', () => {
  const [r] = assess([tokenPrices()], D('2026-11-04T12:00:00Z'), {
    'token-prices': { lastFailed: { at: D('2026-11-01T11:00:00Z'), reason: 'https://github.com/o/r/actions/runs/9' } },
  });
  assert.equal(r.status, 'failed');
  assert.match(r.detail, / https:\/\/github\.com\/o\/r\/actions\/runs\/9 /);
});

test('a Mac failure alerts the next morning, inside grace (the failed stamp replaces the ok)', () => {
  // Monday 16 Nov 07:30 run failed; the heartbeat now holds only the failure.
  const r = one([metrics()], '2026-11-17T05:00:00Z', { metrics: { lastFailed: { at: D('2026-11-16T07:30:00Z'), reason: 'x' } } });
  assert.equal(r.status, 'failed');
});

// ---------- CLI adapters (exec injected; no network) ----------

function recordingExec(replies) {
  const calls = [];
  const exec = (cmd, args) => {
    calls.push([cmd, ...args]);
    const key = `${args[0]} ${args[1]}`;
    return replies[key] ?? '[]';
  };
  return { calls, exec };
}

test('cliIssueGh.listOpen asks gh for issues by github-actions[bot], then reads each bot issue\'s comments', async () => {
  const body = '<!-- watchdog-job: metrics -->\nx\n<!-- watchdog-state: s1 -->';
  const { calls, exec } = recordingExec({
    'issue list': JSON.stringify([
      { number: 4, title: 't', body, author: { login: 'app/github-actions', is_bot: true } },
      { number: 5, title: 't', body, author: { login: 'mallory', is_bot: false } },
    ]),
    'issue view': JSON.stringify({ comments: [{ author: { login: 'github-actions' }, body: '<!-- watchdog-state: s2 -->' }] }),
  });
  const open = await cliIssueGh({ exec }).listOpen();
  const list = calls.find((c) => c[1] === 'issue' && c[2] === 'list');
  const i = list.indexOf('--author');
  assert.ok(i > 0);
  assert.equal(list[i + 1], 'github-actions[bot]');
  assert.deepEqual(list.slice(-2), ['--repo', 'kherhim/signal-to-noise']);
  assert.deepEqual(calls.filter((c) => c[2] === 'view').map((c) => c[3]), ['4']);
  assert.equal(open.length, 1);
  assert.equal(open[0].job, 'metrics');
  assert.equal(lastStateKey(open[0].lastBody), 's2');
});

test('cliEvidenceGh.listRuns reads main only, a 20-run window, with displayTitle', async () => {
  const { calls, exec } = recordingExec({});
  await cliEvidenceGh({}, { exec }).listRuns('token-prices.yml', 'success');
  const a = calls[0];
  assert.equal(a[a.indexOf('--branch') + 1], 'main');
  assert.equal(a[a.indexOf('--limit') + 1], '20');
  assert.equal(a[a.indexOf('--json') + 1], 'createdAt,url,displayTitle');
});
