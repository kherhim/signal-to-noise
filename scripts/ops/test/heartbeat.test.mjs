import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  periodStart, parseHeartbeat, formatHeartbeat, runWithHeartbeat, ghReadVar, ghWriteVar, LATE_HOURS,
} from '../heartbeat.mjs';

const D = (s) => new Date(s);
const WEEKLY = { kind: 'weekly', weekday: 1, hour_utc: 6, minute: 30 };
const JOBS = [{
  name: 'metrics', runs_on: 'mac', since: '2026-11-13', cadence: WEEKLY, grace_hours: 24,
  heartbeat: { variable: 'HEARTBEAT_METRICS' },
}];

// ---------- periodStart ----------

test('periodStart weekly: Monday 06:29 returns the previous Monday 06:30', () => {
  // 2026-11-16 is a Monday.
  assert.equal(periodStart(WEEKLY, D('2026-11-16T06:29:00Z')).toISOString(), '2026-11-09T06:30:00.000Z');
});

test('periodStart weekly: exactly at the slot, one second before, and later in the week', () => {
  assert.equal(periodStart(WEEKLY, D('2026-11-16T06:30:00Z')).toISOString(), '2026-11-16T06:30:00.000Z');
  assert.equal(periodStart(WEEKLY, D('2026-11-16T06:29:59Z')).toISOString(), '2026-11-09T06:30:00.000Z');
  assert.equal(periodStart(WEEKLY, D('2026-11-18T10:00:00Z')).toISOString(), '2026-11-16T06:30:00.000Z');
  // Sunday maps to weekday 7.
  assert.equal(periodStart({ kind: 'weekly', weekday: 7, hour_utc: 9 }, D('2026-11-15T09:00:00Z')).toISOString(), '2026-11-15T09:00:00.000Z');
  assert.equal(periodStart({ kind: 'weekly', weekday: 7, hour_utc: 9 }, D('2026-11-16T00:00:00Z')).toISOString(), '2026-11-15T09:00:00.000Z');
  assert.equal(periodStart({ kind: 'weekly', weekday: 7, hour_utc: 9 }, D('2026-11-15T08:59:59Z')).toISOString(), '2026-11-08T09:00:00.000Z');
});

test('periodStart daily: at the slot, one second before, minute defaults to 0', () => {
  const c = { kind: 'daily', hour_utc: 5 };
  assert.equal(periodStart(c, D('2026-11-13T05:00:00Z')).toISOString(), '2026-11-13T05:00:00.000Z');
  assert.equal(periodStart(c, D('2026-11-13T04:59:59Z')).toISOString(), '2026-11-12T05:00:00.000Z');
  assert.equal(periodStart(c, D('2026-01-01T00:00:00Z')).toISOString(), '2025-12-31T05:00:00.000Z');
});

test('periodStart monthly: at the slot, one second before, year rollback', () => {
  const c = { kind: 'monthly', day: 1, hour_utc: 11 };
  assert.equal(periodStart(c, D('2026-12-01T11:00:00Z')).toISOString(), '2026-12-01T11:00:00.000Z');
  assert.equal(periodStart(c, D('2026-12-01T10:59:59Z')).toISOString(), '2026-11-01T11:00:00.000Z');
  assert.equal(periodStart(c, D('2026-01-01T10:59:59Z')).toISOString(), '2025-12-01T11:00:00.000Z');
  assert.equal(periodStart({ kind: 'monthly', day: 28, hour_utc: 0, minute: 15 }, D('2026-03-05T00:00:00Z')).toISOString(), '2026-02-28T00:15:00.000Z');
});

test('periodStart quarterly: at the slot, one second before, year rollback', () => {
  const c = { kind: 'quarterly', months: [1, 4, 7, 10], day: 2, hour_utc: 9 };
  assert.equal(periodStart(c, D('2026-04-02T09:00:00Z')).toISOString(), '2026-04-02T09:00:00.000Z');
  assert.equal(periodStart(c, D('2026-04-02T08:59:59Z')).toISOString(), '2026-01-02T09:00:00.000Z');
  assert.equal(periodStart(c, D('2026-06-30T12:00:00Z')).toISOString(), '2026-04-02T09:00:00.000Z');
  assert.equal(periodStart(c, D('2026-01-02T08:59:59Z')).toISOString(), '2025-10-02T09:00:00.000Z');
  // Unordered months and a single month a year.
  assert.equal(periodStart({ kind: 'quarterly', months: [11, 2], day: 1, hour_utc: 0 }, D('2026-01-15T00:00:00Z')).toISOString(), '2025-11-01T00:00:00.000Z');
  assert.equal(periodStart({ kind: 'quarterly', months: [3], day: 1, hour_utc: 0 }, D('2026-02-28T00:00:00Z')).toISOString(), '2025-03-01T00:00:00.000Z');
});

// ---------- format / parse ----------

test('format and parse round-trip for all three forms', () => {
  const at = D('2026-11-16T06:30:00.000Z');
  assert.equal(formatHeartbeat({ status: 'ok', at, late: false }), 'ok:2026-11-16T06:30:00.000Z');
  assert.equal(formatHeartbeat({ status: 'ok', at, late: true }), 'ok:2026-11-16T06:30:00.000Z:late');
  assert.equal(formatHeartbeat({ status: 'failed', at, late: false, reason: 'boom: bad' }), 'failed:2026-11-16T06:30:00.000Z:boom: bad');

  for (const hb of [{ status: 'ok', at, late: false }, { status: 'ok', at, late: true }]) {
    assert.deepEqual(parseHeartbeat(formatHeartbeat(hb)), hb);
  }
  const f = parseHeartbeat(formatHeartbeat({ status: 'failed', at, late: false, reason: 'boom: bad' }));
  assert.equal(f.status, 'failed');
  assert.equal(f.at.toISOString(), at.toISOString());
  assert.equal(f.reason, 'boom: bad');
});

test('a reason containing a newline is flattened and capped at 100 characters', () => {
  const at = D('2026-11-16T06:30:00.000Z');
  const v = formatHeartbeat({ status: 'failed', at, late: false, reason: 'line one\nline two\r\nthree' });
  assert.equal(v, 'failed:2026-11-16T06:30:00.000Z:line one line two three');
  assert.ok(!/[\r\n]/.test(v));
  const long = formatHeartbeat({ status: 'failed', at, late: false, reason: 'x'.repeat(300) });
  assert.equal(parseHeartbeat(long).reason.length, 100);
});

test('parseHeartbeat tolerates the trailing newline gh prints and rejects junk', () => {
  assert.equal(parseHeartbeat('ok:2026-11-16T06:30:00.000Z\n').status, 'ok');
  for (const v of [undefined, null, '', '   ', 'ok', 'ok:yesterday', 'done:2026-11-16T06:30:00.000Z', 'ok:2026-11-16T06:30:00.000Z:early', 'ok:2026-13-45T99:99:99.000Z']) {
    assert.equal(parseHeartbeat(v), null, String(v));
  }
});

// ---------- runWithHeartbeat ----------

function harness({ value, now, writeThrows = false }) {
  const store = { HEARTBEAT_METRICS: value };
  const logs = [];
  const writes = [];
  const deps = {
    now,
    jobs: JOBS,
    readVar: async (name) => store[name],
    writeVar: async (name, v) => { writes.push([name, v]); if (writeThrows) throw new Error('gh offline'); store[name] = v; },
    log: (m) => logs.push(m),
  };
  return { store, logs, writes, deps };
}

test('runs once per period after a missed slot', async () => {
  // Last ok was the previous Monday; now is Wednesday 10:00.
  const h = harness({ value: 'ok:2026-11-09T06:31:00.000Z', now: D('2026-11-18T10:00:00Z') });
  let calls = 0;
  const fn = async () => { calls++; };
  assert.equal(await runWithHeartbeat('metrics', fn, h.deps), 'ok');
  assert.equal(calls, 1);
  assert.deepEqual(parseHeartbeat(h.store.HEARTBEAT_METRICS), { status: 'ok', at: D('2026-11-18T10:00:00Z'), late: true });

  const again = { ...h.deps, now: D('2026-11-19T10:00:00Z') };
  assert.equal(await runWithHeartbeat('metrics', fn, again), 'skipped');
  assert.equal(calls, 1);
});

test('an on-time run is not late; the late threshold is 6 hours', async () => {
  assert.equal(LATE_HOURS, 6);
  const onTime = harness({ value: undefined, now: D('2026-11-16T12:30:00Z') });
  assert.equal(await runWithHeartbeat('metrics', async () => {}, onTime.deps), 'ok');
  assert.equal(onTime.store.HEARTBEAT_METRICS, 'ok:2026-11-16T12:30:00.000Z');
  const late = harness({ value: undefined, now: D('2026-11-16T12:30:01Z') });
  await runWithHeartbeat('metrics', async () => {}, late.deps);
  assert.equal(late.store.HEARTBEAT_METRICS, 'ok:2026-11-16T12:30:01.000Z:late');
});

test('a failed heartbeat in this period does not skip; the job retries', async () => {
  const h = harness({ value: 'failed:2026-11-16T06:30:00.000Z:boom', now: D('2026-11-17T10:00:00Z') });
  let calls = 0;
  assert.equal(await runWithHeartbeat('metrics', async () => { calls++; }, h.deps), 'ok');
  assert.equal(calls, 1);
});

test('heartbeat failure never masks the job result', async () => {
  const ok = harness({ value: undefined, now: D('2026-11-16T07:00:00Z'), writeThrows: true });
  assert.equal(await runWithHeartbeat('metrics', async () => {}, ok.deps), 'ok');
  assert.equal(ok.writes.length, 1);
  assert.ok(ok.logs.some((m) => /could not write/i.test(m) && /gh offline/.test(m)), ok.logs.join('\n'));

  // fn throws: the failure is written, then the original error is rethrown
  // (a rethrow is how the caller sees 'failed').
  const bad = harness({ value: undefined, now: D('2026-11-16T07:00:00Z') });
  const err = new Error('cloudflare down\nretry later');
  await assert.rejects(runWithHeartbeat('metrics', async () => { throw err; }, bad.deps), (e) => e === err);
  assert.equal(bad.store.HEARTBEAT_METRICS, 'failed:2026-11-16T07:00:00.000Z:cloudflare down retry later');

  // fn throws and the write throws too: still the job's error that surfaces.
  const both = harness({ value: undefined, now: D('2026-11-16T07:00:00Z'), writeThrows: true });
  await assert.rejects(runWithHeartbeat('metrics', async () => { throw err; }, both.deps), (e) => e === err);
});

test('an unreadable heartbeat never skips the job', async () => {
  const h = harness({ value: undefined, now: D('2026-11-16T07:00:00Z') });
  h.deps.readVar = async () => { throw new Error('not logged in'); };
  let calls = 0;
  assert.equal(await runWithHeartbeat('metrics', async () => { calls++; }, h.deps), 'ok');
  assert.equal(calls, 1);
  assert.ok(h.logs.some((m) => /could not read/i.test(m) && /not logged in/.test(m)));
  assert.equal(h.store.HEARTBEAT_METRICS, 'ok:2026-11-16T07:00:00.000Z');
});

test('a job missing from the registry still runs, without a heartbeat', async () => {
  const h = harness({ value: undefined, now: D('2026-11-16T07:00:00Z') });
  let calls = 0;
  assert.equal(await runWithHeartbeat('no-such-job', async () => { calls++; }, h.deps), 'ok');
  assert.equal(calls, 1);
  assert.equal(h.writes.length, 0);
  assert.ok(h.logs.some((m) => /no-such-job/.test(m)));
});

test('the real registry carries both Mac jobs at the R4 times', async () => {
  const { loadJobs } = await import('../jobs.mjs');
  const jobs = loadJobs();
  const m = jobs.find((j) => j.name === 'metrics');
  const hl = jobs.find((j) => j.name === 'humaniser-learn');
  assert.deepEqual(m.cadence, { kind: 'weekly', weekday: 1, hour_utc: 7, minute: 30 });
  assert.deepEqual(hl.cadence, { kind: 'weekly', weekday: 1, hour_utc: 7, minute: 45 });
  assert.equal(m.heartbeat.variable, 'HEARTBEAT_METRICS');
  assert.equal(hl.heartbeat.variable, 'HEARTBEAT_HUMANISER_LEARN');
  for (const j of [m, hl]) { assert.equal(j.runs_on, 'mac'); assert.equal(j.grace_hours, 24); assert.equal(j.since, '2026-11-13'); }
});

// ---------- default gh adapters ----------

test('ghReadVar: a missing variable reads as undefined; other failures throw', async () => {
  const calls = [];
  const fakeExec = (out) => (cmd, args, opts) => { calls.push([cmd, args, opts]); return out(); };
  const got = await ghReadVar('HEARTBEAT_METRICS', { exec: fakeExec(() => 'ok:2026-11-16T07:00:00.000Z\n') });
  assert.equal(got, 'ok:2026-11-16T07:00:00.000Z\n');
  assert.equal(calls[0][0], 'gh');
  assert.deepEqual(calls[0][1], ['variable', 'get', 'HEARTBEAT_METRICS', '--repo', 'kherhim/signal-to-noise']);
  assert.ok(calls[0][2].timeout > 0);

  const notFound = () => { const e = new Error('Command failed'); e.stderr = 'variable HEARTBEAT_METRICS was not found\n'; throw e; };
  assert.equal(await ghReadVar('HEARTBEAT_METRICS', { exec: fakeExec(notFound) }), undefined);

  const offline = () => { const e = new Error('Command failed'); e.stderr = 'error connecting to api.github.com\n'; throw e; };
  await assert.rejects(ghReadVar('HEARTBEAT_METRICS', { exec: fakeExec(offline) }), /api\.github\.com/);
});

test('ghWriteVar passes the value as --body to the right repo', async () => {
  const calls = [];
  await ghWriteVar('HEARTBEAT_METRICS', 'ok:x', { exec: (cmd, args, opts) => { calls.push([cmd, args, opts]); return ''; } });
  assert.deepEqual(calls[0][1], ['variable', 'set', 'HEARTBEAT_METRICS', '--repo', 'kherhim/signal-to-noise', '--body', 'ok:x']);
  assert.ok(calls[0][2].timeout > 0);
});
