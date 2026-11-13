import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadJobs, validateJob } from '../../scripts/ops/jobs.mjs';

const good = () => ({
  name: 'token-prices', runs_on: 'actions', since: '2026-11-13',
  cadence: { kind: 'monthly', day: 1, hour_utc: 11 }, grace_hours: 48,
  heartbeat: { workflow: 'token-prices.yml' },
});
const mac = () => ({
  name: 'weekly-thing', runs_on: 'mac', since: '2026-11-13',
  cadence: { kind: 'weekly', weekday: 1, hour_utc: 7, minute: 30 }, grace_hours: 24,
  heartbeat: { variable: 'HEARTBEAT_WEEKLY_THING' },
});
const problems = (mut, base = good) => { const j = base(); mut(j); return validateJob(j); };

test('every job has a valid cadence, grace and exactly one heartbeat source', () => {
  const jobs = loadJobs();
  assert.ok(jobs.length >= 1);
  for (const j of jobs) assert.deepEqual(validateJob(j), [], j.name);
  assert.equal(jobs[0].name, 'token-prices');
});

test('job names are unique kebab-case', () => {
  const names = loadJobs().map((j) => j.name);
  assert.equal(new Set(names).size, names.length);
  for (const n of names) assert.match(n, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test('valid examples pass, including all cadence kinds', () => {
  assert.deepEqual(validateJob(good()), []);
  assert.deepEqual(validateJob(mac()), []);
  assert.deepEqual(problems((j) => { j.cadence = { kind: 'daily', hour_utc: 6 }; }), []);
  assert.deepEqual(problems((j) => { j.cadence = { kind: 'quarterly', months: [1, 4, 7, 10], day: 2, hour_utc: 9, minute: 15 }; }), []);
  assert.deepEqual(problems((j) => { j.paused = true; }), []);
});

test('bad fields are reported by field name', () => {
  const has = (list, re) => assert.ok(list.some((p) => re.test(p)), `${re} in ${JSON.stringify(list)}`);
  has(problems((j) => { j.name = 'Bad_Name'; }), /name/);
  has(problems((j) => { delete j.since; }), /since/);
  has(problems((j) => { j.since = '13/11/2026'; }), /since/);
  has(problems((j) => { j.grace_hours = 0; }), /grace_hours/);
  has(problems((j) => { j.runs_on = 'cloud'; }), /runs_on/);
  has(problems((j) => { j.paused = 'yes'; }), /paused/);
  has(problems((j) => { j.cadence.kind = 'yearly'; }), /cadence\.kind/);
  has(problems((j) => { j.cadence.day = 29; }), /cadence\.day/);
  has(problems((j) => { j.cadence.hour_utc = 24; }), /cadence\.hour_utc/);
  has(problems((j) => { j.cadence.minute = 60; }), /cadence\.minute/);
  has(problems((j) => { j.cadence = { kind: 'weekly', weekday: 8, hour_utc: 1 }; }), /cadence\.weekday/);
  has(problems((j) => { j.cadence = { kind: 'quarterly', months: [], day: 1, hour_utc: 1 }; }), /cadence\.months/);
  has(problems((j) => { j.cadence = { kind: 'quarterly', months: [13], day: 1, hour_utc: 1 }; }), /cadence\.months/);
});

test('heartbeat: exactly one source, matching runs_on', () => {
  const has = (list, re) => assert.ok(list.some((p) => re.test(p)), JSON.stringify(list));
  has(problems((j) => { j.heartbeat = { workflow: 'a.yml', variable: 'HEARTBEAT_A' }; }), /heartbeat/);
  has(problems((j) => { j.heartbeat = {}; }), /heartbeat/);
  has(problems((j) => { delete j.heartbeat; }), /heartbeat/);
  has(problems((j) => { j.heartbeat = { workflow: 'a.txt' }; }), /heartbeat\.workflow/);
  has(problems((j) => { j.heartbeat = { variable: 'HEARTBEAT_A' }; }), /runs_on/);
  has(problems((j) => { j.heartbeat = { workflow: 'a.yml' }; }, mac), /runs_on/);
  has(problems((j) => { j.heartbeat = { variable: 'lower_case' }; }, mac), /heartbeat\.variable/);
});

test('loadJobs throws naming the bad job and field, and rejects duplicates', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobs-'));
  const write = (v) => { const f = path.join(dir, 'jobs.json'); fs.writeFileSync(f, JSON.stringify(v)); return f; };
  const bad = good(); bad.grace_hours = -1;
  assert.throws(() => loadJobs(write([bad])), /token-prices.*grace_hours/);
  assert.throws(() => loadJobs(write([good(), good()])), /duplicate.*token-prices/i);
  assert.throws(() => loadJobs(write({})), /array/);
  assert.equal(loadJobs(write([good(), mac()])).length, 2);
});
