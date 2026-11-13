// The Mac jobs' launchd plists. launchd runs whatever branch the main checkout
// is on; on a branch older than the heartbeat work `--scheduled` would be
// ignored and the job would run at every fire. Each plist therefore runs
// through /bin/sh with a guard that refuses to start when
// scripts/ops/heartbeat.mjs is missing. plutil is not on Linux CI, so the XML
// is read with a small parser good enough for these files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadJobs } from '../../scripts/ops/jobs.mjs';
import { macLogPath } from '../../scripts/ops/heartbeat.mjs';

const INFRA = new URL('../../infra/', import.meta.url);
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function readPlist(name) {
  const xml = fs.readFileSync(new URL(`co.signal-to-noise.${name}.plist`, INFRA), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const str = (key) => unescape(new RegExp(`<key>${key}</key>\\s*<string>([\\s\\S]*?)</string>`).exec(xml)?.[1] ?? '');
  const arr = /<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(xml)?.[1] ?? '';
  const args = [...arr.matchAll(/<string>([\s\S]*?)<\/string>/g)].map((m) => unescape(m[1]));
  return { args, cwd: str('WorkingDirectory'), out: str('StandardOutPath'), err: str('StandardErrorPath') };
}

const macJobs = loadJobs().filter((j) => j.runs_on === 'mac');

// What each plist must still exec after the guard, unchanged from before.
const EXPECTED = {
  metrics: (root) => `/opt/homebrew/bin/node ${root}/scripts/metrics-pull.mjs --linkedin --scheduled`,
  'humaniser-learn': (root) => `/usr/bin/caffeinate -s -i /opt/homebrew/bin/node ${root}/scripts/line/humaniser-learn.mjs --scheduled`,
};

test('every Mac job in the registry has a plist we know how to check', () => {
  assert.ok(macJobs.length >= 2);
  for (const job of macJobs) {
    assert.ok(EXPECTED[job.name], `add ${job.name} to EXPECTED in ops/test/plists.test.mjs`);
    assert.ok(fs.existsSync(new URL(`co.signal-to-noise.${job.name}.plist`, INFRA)), job.name);
  }
});

for (const job of macJobs) {
  test(`${job.name} plist: /bin/sh guard on heartbeat.mjs, then exec of the --scheduled command`, () => {
    const p = readPlist(job.name);
    assert.equal(p.args.length, 3, JSON.stringify(p.args));
    assert.deepEqual(p.args.slice(0, 2), ['/bin/sh', '-c']);
    const script = p.args[2];
    const guard = `test -f ${p.cwd}/scripts/ops/heartbeat.mjs ||`;
    assert.ok(script.startsWith(guard), script);
    assert.match(script, /exit 1; }; exec /);
    assert.ok(script.indexOf('exec ') > script.indexOf(guard));
    const cmd = script.slice(script.indexOf('; exec ') + '; exec '.length);
    assert.equal(cmd, EXPECTED[job.name](p.cwd));
    assert.ok(cmd.endsWith(' --scheduled'));
    // The failed-heartbeat reason names this log; keep them in step.
    const log = macLogPath(job.name).replace(/^~/, '');
    assert.ok(p.out.endsWith(log), p.out);
    assert.ok(p.err.endsWith(log), p.err);
  });

  test(`${job.name} plist guard: stops with a clear line when heartbeat.mjs is absent, runs when present`, () => {
    const p = readPlist(job.name);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plist-guard-'));
    // Same script against a scratch checkout, with the real command swapped for an echo.
    const script = p.args[2].split(p.cwd).join(dir).replace(/; exec .*$/, '; exec echo RAN');
    const run = () => {
      try { return { code: 0, out: execFileSync('/bin/sh', ['-c', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { code: e.status, out: String(e.stdout) }; }
    };
    const missing = run();
    assert.equal(missing.code, 1);
    assert.match(missing.out, /heartbeat\.mjs is missing/);
    assert.ok(!missing.out.includes('RAN'));
    fs.mkdirSync(path.join(dir, 'scripts/ops'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'scripts/ops/heartbeat.mjs'), '');
    assert.deepEqual(run(), { code: 0, out: 'RAN\n' });
  });
}
