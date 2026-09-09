import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ENV, log } from './env.mjs';

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1']);

export function resolveServiceUrl(env = ENV) {
  const raw = env.WATERMARKS_SERVICE_URL ?? 'http://127.0.0.1:8765';
  const url = new URL(raw);
  if (!LOCAL_HOSTNAMES.has(url.hostname)) {
    throw new Error(`WATERMARKS_SERVICE_URL must be local, got ${url.hostname}`);
  }
  return raw;
}

export function plausibleClean(beforeLen, afterLen) {
  return afterLen > 0 && afterLen >= beforeLen * 0.9;
}

function post(route, payload) {
  const wm = resolveServiceUrl();
  const r = spawnSync('curl', ['-s', '-m', '60', '-X', 'POST', `${wm}${route}`, '-H', 'Content-Type: application/json', '--data-binary', '@-'], { input: JSON.stringify(payload), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`watermarks service unreachable at ${wm}`);
  let j;
  try {
    j = JSON.parse(r.stdout);
  } catch {
    throw new Error(`watermarks ${route}: non-JSON response: ${r.stdout.slice(0, 120)}`);
  }
  if (j.ok === false) throw new Error(`watermarks ${route}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

export function serviceUp() {
  let wm;
  try {
    wm = resolveServiceUrl();
  } catch {
    return false;
  }
  const r = spawnSync('curl', ['-s', '-m', '5', '-X', 'POST', `${wm}/inspect`, '-H', 'Content-Type: application/json', '--data-binary', '@-'], { input: JSON.stringify({ file: Buffer.from('ok').toString('base64'), name: 'probe.txt' }), encoding: 'utf8' });
  if (r.status !== 0) return false;
  let j;
  try {
    j = JSON.parse(r.stdout);
  } catch {
    return false;
  }
  return typeof j === 'object' && j !== null && 'ok' in j;
}

export function inspectFile(file) {
  const j = post('/inspect', { file: fs.readFileSync(file).toString('base64'), name: path.basename(file) });
  return { suspicious: Boolean(j.suspicious), report: j.report ?? null, kind: j.kind };
}

export function cleanFile(file) {
  const before = fs.readFileSync(file);
  const j = post('/clean', { file: before.toString('base64'), name: path.basename(file), options: { nfkc: false } });
  const after = Buffer.from(j.cleaned, 'base64');
  if (!plausibleClean(before.length, after.length)) {
    throw new Error(`watermarks /clean returned an implausible payload (${after.length} bytes vs ${before.length})`);
  }
  const changed = !before.equals(after);
  if (changed) fs.writeFileSync(file, after);
  log('layera', `${path.basename(file)} ${changed ? 'cleaned' : 'already clean'}`);
  return { changed, report: j.report ?? null };
}
