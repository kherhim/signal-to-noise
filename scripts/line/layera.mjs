import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ENV, log } from './env.mjs';

const WM = ENV.WATERMARKS_SERVICE_URL ?? 'http://127.0.0.1:8765';

function post(route, payload) {
  const r = spawnSync('curl', ['-s', '-m', '60', '-X', 'POST', `${WM}${route}`, '-H', 'Content-Type: application/json', '--data-binary', '@-'], { input: JSON.stringify(payload), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`watermarks service unreachable at ${WM}`);
  const j = JSON.parse(r.stdout);
  if (j.ok === false) throw new Error(`watermarks ${route}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

export function serviceUp() {
  const r = spawnSync('curl', ['-s', '-m', '5', '-o', '/dev/null', '-w', '%{http_code}', `${WM}/inspect`], { encoding: 'utf8' });
  return r.status === 0 && /^(200|404|405)$/.test(r.stdout.trim());
}

export function inspectFile(file) {
  const j = post('/inspect', { file: fs.readFileSync(file).toString('base64'), name: path.basename(file) });
  return { suspicious: Boolean(j.suspicious), report: j.report ?? null, kind: j.kind };
}

export function cleanFile(file) {
  const before = fs.readFileSync(file);
  const j = post('/clean', { file: before.toString('base64'), name: path.basename(file), options: { nfkc: false } });
  const after = Buffer.from(j.cleaned, 'base64');
  const changed = !before.equals(after);
  if (changed) fs.writeFileSync(file, after);
  log('layera', `${path.basename(file)} ${changed ? 'cleaned' : 'already clean'}`);
  return { changed, report: j.report ?? null };
}
