// scripts/line/test/lock.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isStale, acquire, readLock, STALE_AFTER_MIN } from '../lock.mjs';

const now = new Date('2026-09-21T11:40:00Z');
const at = (min) => new Date(now.getTime() - min * 60000).toISOString();
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lock-')), '.runner.lock');

test('a live, recent lock is held', () => {
  assert.equal(isStale({ pid: 1, at: at(5) }, now, { alive: () => true }), false);
});

test('a lock whose process has gone is stale', () => {
  assert.equal(isStale({ pid: 1, at: at(5) }, now, { alive: () => false }), true);
});

test('a lock older than the stale window is stale even if the pid is alive', () => {
  // Guards against a recycled pid pinning the line for ever.
  assert.equal(isStale({ pid: 1, at: at(STALE_AFTER_MIN) }, now, { alive: () => true }), true);
});

test('an unreadable or malformed lock is stale', () => {
  for (const bad of [null, {}, { pid: 'x', at: at(1) }, { pid: 1 }]) {
    assert.equal(isStale(bad, now, { alive: () => true }), true);
  }
});

test('acquire writes our pid and release removes it', () => {
  const file = tmp();
  const release = acquire({ file, now });
  assert.ok(release);
  assert.equal(readLock(file).pid, process.pid);
  release();
  assert.equal(readLock(file), null);
});

test('a second runner refuses while the first holds it', () => {
  const file = tmp();
  fs.writeFileSync(file, JSON.stringify({ pid: 4242, at: at(2) }));
  assert.equal(acquire({ file, now, deps: { alive: () => true } }), null);
  assert.equal(readLock(file).pid, 4242, 'the held lock is left untouched');
});

test('a stale lock is broken and taken', () => {
  const file = tmp();
  fs.writeFileSync(file, JSON.stringify({ pid: 4242, at: at(2) }));
  const release = acquire({ file, now, deps: { alive: () => false } });
  assert.ok(release);
  assert.equal(readLock(file).pid, process.pid);
});

test('release never removes a lock another runner has since taken', () => {
  const file = tmp();
  const release = acquire({ file, now });
  fs.writeFileSync(file, JSON.stringify({ pid: 4242, at: at(0) })); // someone broke ours
  release();
  assert.equal(readLock(file).pid, 4242, 'the other runner keeps its lock');
});
