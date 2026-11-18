import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healthLines, launchdLines, readVars, runHealth, UNREACHABLE, WORKFLOW_MISSING } from '../health-line.mjs';

const D = (s) => new Date(s);
const NOW = D('2026-12-08T09:00:00Z');
const MONTHLY = { kind: 'monthly', day: 1, hour_utc: 11 };
const WEEKLY = { kind: 'weekly', weekday: 1, hour_utc: 7, minute: 30 };
const DAILY = { kind: 'daily', hour_utc: 5 };
const tp = { name: 'token-prices', runs_on: 'actions', since: '2026-11-13', cadence: MONTHLY, grace_hours: 48, heartbeat: { workflow: 'token-prices.yml' } };
const metrics = { name: 'metrics', runs_on: 'mac', since: '2026-11-13', cadence: WEEKLY, grace_hours: 24, heartbeat: { variable: 'HEARTBEAT_METRICS' } };
const wd = { name: 'watchdog', runs_on: 'actions', since: '2026-11-13', cadence: DAILY, grace_hours: 48, heartbeat: { workflow: 'watchdog.yml' } };

const line = (jobs, results, issues = [], now = NOW) => healthLines(results, issues, now, jobs);

test('ok line: last ok and next due', () => {
  const r = [{ job: 'token-prices', status: 'ok', detail: 'Last success Tue 1 Dec 2026, 11:02 UTC.' }];
  assert.deepEqual(line([tp], r), ['✅ token-prices: last ok 1 Dec 11:02 UTC, next due 1 Jan']);
});

test('ok line for a weekly job uses a weekday', () => {
  const r = [{ job: 'metrics', status: 'ok', detail: 'Last success Mon 7 Dec 2026, 07:31 UTC.' }];
  assert.deepEqual(line([metrics], r), ['✅ metrics: last ok 7 Dec 07:31 UTC, next due Mon 14 Dec']);
});

test('ok but not due yet', () => {
  const r = [{ job: 'token-prices', status: 'ok', detail: 'Not due yet. First due Tue 1 Dec 2026, 11:00 UTC.' }];
  assert.deepEqual(line([tp], r, [], D('2026-11-20T00:00:00Z')), ['✅ token-prices: not run yet, first due 1 Dec']);
});

test('overdue line carries the issue number', () => {
  const r = [{ job: 'metrics', status: 'overdue', detail: 'Due Mon 7 Dec 2026, 07:30 UTC, with 24 hours grace. No success on record.' }];
  assert.deepEqual(line([metrics], r, [{ number: 61, title: 'Scheduled job needs attention: metrics', job: 'metrics' }]),
    ['❌ metrics: overdue since Mon 7 Dec 07:30 UTC (issue #61)']);
});

test('issue matched by exact title when no job field; other jobs ignored', () => {
  const r = [{ job: 'metrics', status: 'overdue', detail: 'Due Mon 7 Dec 2026, 07:30 UTC, with 24 hours grace. x' }];
  const issues = [{ number: 3, title: 'Scheduled job needs attention: token-prices' }, { number: 61, title: 'Scheduled job needs attention: metrics' }];
  assert.match(line([metrics], r, issues)[0], /\(issue #61\)$/);
});

test('overdue with no open issue omits the suffix', () => {
  const r = [{ job: 'metrics', status: 'overdue', detail: 'Due Mon 7 Dec 2026, 07:30 UTC, with 24 hours grace. x' }];
  assert.deepEqual(line([metrics], r), ['❌ metrics: overdue since Mon 7 Dec 07:30 UTC']);
});

test('failed line', () => {
  const r = [{ job: 'token-prices', status: 'failed', detail: 'Due Tue 1 Dec 2026, 11:00 UTC, with 48 hours grace. The latest run failed: x' }];
  assert.deepEqual(line([tp], r, [{ number: 9, title: '', job: 'token-prices' }]), ['❌ token-prices: failing since Tue 1 Dec 11:00 UTC (issue #9)']);
});

test('never-run line', () => {
  const r = [{ job: 'metrics', status: 'never-run', detail: 'Due Mon 7 Dec 2026, 07:30 UTC, with 24 hours grace. No run on record since it was added.' }];
  assert.deepEqual(line([metrics], r), ['❌ metrics: never run, due since Mon 7 Dec 07:30 UTC']);
});

test('paused line', () => {
  const r = [{ job: 'metrics', status: 'paused', detail: 'Paused in ops/jobs.json.' }];
  assert.deepEqual(line([metrics], r), ['⏸ metrics: paused']);
});

test('watchdog gets a line like any job (it never has an issue)', () => {
  const r = [{ job: 'watchdog', status: 'overdue', detail: 'Due Sun 6 Dec 2026, 05:00 UTC, with 48 hours grace. Last success Fri 4 Dec 2026, 05:00 UTC.' }];
  assert.deepEqual(line([wd], r), ['❌ watchdog: overdue since Sun 6 Dec 05:00 UTC']);
});

test('launchd section: loaded and missing, mac jobs only, via injected exec', () => {
  const calls = [];
  const exec = (cmd, args) => {
    calls.push([cmd, ...args]);
    if (args.at(-1).endsWith('humaniser-learn')) throw new Error('exit 113');
  };
  const jobs = [tp, metrics, { ...metrics, name: 'humaniser-learn' }];
  assert.deepEqual(launchdLines(jobs, exec, 501), [
    'launchd:',
    '✅ co.signal-to-noise.metrics: loaded',
    '❌ co.signal-to-noise.humaniser-learn: not loaded',
  ]);
  assert.deepEqual(calls[0], ['launchctl', 'print', 'gui/501/co.signal-to-noise.metrics']);
  assert.equal(calls.length, 2);
});

test('readVars: reads each heartbeat variable; a missing one is undefined', () => {
  const run = (name) => {
    if (name === 'HEARTBEAT_METRICS') return 'ok:2026-12-07T07:31:00Z\n';
    const e = new Error('x'); e.stderr = 'HTTP 404: Not Found'; throw e;
  };
  const jobs = [tp, metrics, { ...metrics, name: 'humaniser-learn', heartbeat: { variable: 'HEARTBEAT_HUMANISER_LEARN' } }];
  assert.deepEqual(readVars(jobs, run), { HEARTBEAT_METRICS: 'ok:2026-12-07T07:31:00Z', HEARTBEAT_HUMANISER_LEARN: undefined });
});

test('readVars: any other gh failure propagates', () => {
  const run = () => { const e = new Error('x'); e.stderr = 'dial tcp: no route to host'; throw e; };
  assert.throws(() => readVars([metrics], run));
});

test('runHealth: gh unreachable gives one clear line and a failure code, no launchd call', async () => {
  let launchd = 0;
  const out = await runHealth({
    jobs: [metrics], now: NOW,
    readVar: () => { throw new Error('no route'); },
    evidenceGh: () => ({}), issueGh: { listOpen: async () => [] },
    exec: () => { launchd++; },
  });
  assert.equal(out.code, 1);
  assert.equal(out.lines.length, 1);
  assert.equal(out.lines[0], `${UNREACHABLE} (no route)`);
  assert.equal(launchd, 0);
});

test('runHealth: happy path prints job lines then launchd section', async () => {
  const out = await runHealth({
    jobs: [metrics], now: NOW, uid: 501,
    readVar: () => 'ok:2026-12-07T07:31:00Z',
    evidenceGh: (vars) => ({ vars, listRuns: async () => [] }),
    issueGh: { listOpen: async () => [] },
    exec: () => {},
  });
  assert.equal(out.code, 0);
  assert.equal(out.lines[0], '✅ metrics: last ok 7 Dec 07:31 UTC, next due Mon 14 Dec');
  assert.deepEqual(out.lines.slice(1), ['launchd:', '✅ co.signal-to-noise.metrics: loaded']);
});

test('runHealth: a workflow GitHub does not know is named as such, not as unreachable', async () => {
  const bad = { ...tp, heartbeat: { workflow: 'token-price.yml' } };
  const out = await runHealth({
    jobs: [bad], now: NOW, uid: 501,
    readVar: () => '',
    evidenceGh: (vars) => ({
      vars,
      listRuns: async (wf) => {
        const e = new Error('Command failed: gh run list');
        e.stderr = `HTTP 404: workflow ${wf} not found on the default branch (https://api.github.com/repos/o/r/actions/workflows/${wf})`;
        throw e;
      },
    }),
    issueGh: { listOpen: async () => [] },
    exec: () => {},
  });
  assert.equal(out.code, 1);
  assert.equal(out.lines.length, 1);
  assert.equal(out.lines[0], `${WORKFLOW_MISSING} token-prices: token-price.yml. Fix heartbeat.workflow in ops/jobs.json.`);
  assert.ok(!out.lines[0].includes(UNREACHABLE));
});

test('runHealth: a network failure listing runs is still "could not reach GitHub"', async () => {
  const out = await runHealth({
    jobs: [tp], now: NOW, uid: 501,
    readVar: () => '',
    evidenceGh: (vars) => ({ vars, listRuns: async () => { const e = new Error('x'); e.stderr = 'dial tcp: lookup api.github.com: no such host'; throw e; } }),
    issueGh: { listOpen: async () => [] },
    exec: () => {},
  });
  assert.equal(out.code, 1);
  assert.match(out.lines[0], new RegExp(`^${UNREACHABLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('an ok heartbeat flagged late shows (late) on the line', async () => {
  const r = [{ job: 'metrics', status: 'ok', detail: 'Last success Mon 7 Dec 2026, 13:31 UTC.' }];
  assert.deepEqual(healthLines(r, [], NOW, [metrics], { metrics: { lastOk: D('2026-12-07T13:31:00Z'), lastOkLate: true } }),
    ['✅ metrics: last ok 7 Dec 13:31 UTC (late), next due Mon 14 Dec']);
  assert.deepEqual(healthLines(r, [], NOW, [metrics], { metrics: { lastOk: D('2026-12-07T13:31:00Z') } }),
    ['✅ metrics: last ok 7 Dec 13:31 UTC, next due Mon 14 Dec']);
  // End to end from the heartbeat variable.
  const out = await runHealth({
    jobs: [metrics], now: NOW, uid: 501,
    readVar: () => 'ok:2026-12-07T13:31:00.000Z:late\n',
    evidenceGh: (vars) => ({ vars, listRuns: async () => [] }),
    issueGh: { listOpen: async () => [] },
    exec: () => {},
  });
  assert.equal(out.lines[0], '✅ metrics: last ok 7 Dec 13:31 UTC (late), next due Mon 14 Dec');
});
