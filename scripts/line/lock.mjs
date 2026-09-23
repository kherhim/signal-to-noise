// scripts/line/lock.mjs
//
// One runner at a time. Before this existed, a manual `node runner.mjs` and the
// hourly launchd wake would both run a full tick: on 21 Sep 2026 two `makeCover`
// calls overlapped, the second saw the first's webp as an unexpected write, and
// its cleanup deleted the good cover module the first had just paid $4.59 for.
//
// The lock is advisory and deliberately dumb: a file holding the pid and the
// time it was taken. A second runner that finds a live lock logs and exits.
import fs from 'node:fs';
import path from 'node:path';
import { log } from './env.mjs';
import { STAGING } from './state.mjs';

export const LOCK_FILE = path.join(STAGING, '.runner.lock');

// A wake can legitimately run for a long time: the draft, the gate and the
// cover chain in one tick, each child bounded by proc.mjs (claude 25 min is the
// longest). Past that, a lock whose process is gone — or whose pid has been
// recycled onto something else — is stale and may be broken, or one crashed
// runner would block the line until someone noticed.
export const STALE_AFTER_MIN = 45;

export const pidAlive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

// Pure, so the staleness rule is testable without processes or clocks.
export function isStale(lock, now, { alive = pidAlive } = {}) {
  if (!lock || typeof lock.pid !== 'number' || !lock.at) return true; // unreadable = stale
  if ((now.getTime() - new Date(lock.at).getTime()) / 60000 >= STALE_AFTER_MIN) return true;
  return !alive(lock.pid);
}

export function readLock(file = LOCK_FILE) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

// Returns a release function on success, or null if another runner holds it.
// The write is not atomic against a simultaneous acquire, and does not need to
// be: the race it exists to stop is minutes wide (a launchd wake landing inside
// a running tick), not microseconds.
export function acquire({ file = LOCK_FILE, now = new Date(), deps = {} } = {}) {
  const held = readLock(file);
  if (held && !isStale(held, now, deps)) {
    log('lock', `another runner holds the lock (pid ${held.pid}, since ${held.at}); exiting`);
    return null;
  }
  if (held) log('lock', `breaking stale lock (pid ${held.pid}, since ${held.at})`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, at: now.toISOString() }, null, 2) + '\n');
  return function release() {
    // Only ever remove our own lock: a stale-break by a third runner must not
    // be undone by this one's finally block.
    const cur = readLock(file);
    if (cur && cur.pid === process.pid) fs.rmSync(file, { force: true });
  };
}
