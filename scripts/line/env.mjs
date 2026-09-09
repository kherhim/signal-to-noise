import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
export const PAUSE = path.join(ROOT, 'distribution', 'autopilot', 'PAUSE');
export const LOG_FILE = path.join(process.env.HOME ?? ROOT, 'Library', 'Logs', 'signal2noise-essay-line.log');

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* fall through */ }
  return { ...env, ...process.env };
}
export const ENV = loadEnv();

export const nowIso = () => new Date().toISOString();
export const paused = () => fs.existsSync(PAUSE);

export function log(job, msg) {
  const line = `${nowIso().replace('T', ' ').slice(0, 19)}Z  ${job.padEnd(9)}  ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch { /* logging must never fail the job */ }
}

export function need(key) {
  if (!ENV[key]) throw new Error(`${key} missing from .env`);
  return ENV[key];
}
