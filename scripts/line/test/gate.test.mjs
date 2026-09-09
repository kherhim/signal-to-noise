import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runGate } from '../gate.mjs';
import { serviceUp } from '../layera.mjs';

test('gate catches the three planted faults on the fixture', { skip: !serviceUp() && 'watermarks service not running', timeout: 600000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  const out = path.join(dir, 'out.md'), rep = path.join(dir, 'report.md');
  const r = runGate({ inPath: new URL('../fixtures/planted.md', import.meta.url).pathname, outPath: out, reportPath: rep, skipLayerB: true });
  assert.equal(r.verdict, 'fail');
  assert.equal(r.checks.plagiarism.verdict, 'fail');            // Dickens sentence found verbatim
  assert.ok(r.checks.bre.flags.length >= 3);                      // behavior, analyze, optimize
  assert.equal(r.checks.layera.before.suspicious, true);          // zero-width space seen
  assert.equal(r.checks.layera.after.suspicious, false);          // and removed
  assert.ok(fs.readFileSync(rep, 'utf8').includes('## Verdict: FAIL'));
});
