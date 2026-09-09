import { spawnSync } from 'node:child_process';
import { ROOT } from './env.mjs';

const porcelainPath = (line) => line.slice(3);

export function snapshotTree() {
  const r = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git status failed: ${(r.stderr || r.stdout).slice(0, 400)}`);
  return r.stdout.split('\n').filter(Boolean);
}

export function unexpectedWrites(before, after, allowed) {
  const beforeSet = new Set(before.map(porcelainPath));
  const allowedSet = new Set(allowed);
  const seen = new Set();
  const result = [];
  for (const line of after) {
    const p = porcelainPath(line);
    if (beforeSet.has(p) || allowedSet.has(p) || seen.has(p)) continue;
    seen.add(p);
    result.push(p);
  }
  return result;
}
