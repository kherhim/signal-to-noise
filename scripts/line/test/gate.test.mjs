import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runGate, renderReport } from '../gate.mjs';
import { serviceUp } from '../layera.mjs';

const liveSkip = process.env.LINE_LIVE !== '1'
  ? 'set LINE_LIVE=1 to run the paid live gate fixture'
  : (!serviceUp() && 'watermarks service not running');

test('gate catches the three planted faults on the fixture', { skip: liveSkip, timeout: 600000 }, () => {
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

test('renderReport renders a pass verdict for a skipLayerB run with no checks.layerb and empty arrays everywhere', () => {
  const checks = {
    plagiarism: { verdict: 'pass', sentences: [], citations: [], cost_usd: 0 },
    bre: { flags: [], fixed: [], remaining: [], warnings: [] },
    layera: { before: { suspicious: false }, after: { suspicious: false } },
  };
  const report = renderReport({ inPath: 'x.md', outPath: 'y.md', checks, verdict: 'pass', fails: [] });
  assert.doesNotThrow(() => report);
  assert.ok(report.includes('## Verdict: PASS'));
});

test('renderReport renders the ERROR header when an error object is passed', () => {
  const report = renderReport({ inPath: 'x.md', outPath: 'y.md', checks: {}, verdict: 'fail', fails: [], error: { stage: 'plagiarism', message: 'boom' } });
  assert.ok(report.includes('## Verdict: ERROR'));
  assert.ok(report.includes('Failed during: plagiarism'));
  assert.ok(report.includes('boom'));
});

test('runGate catches a thrown error, writes an ERROR report, and returns error info (no live calls: fails at layerb stage on a missing input file)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-err-'));
  const out = path.join(dir, 'out.md'), rep = path.join(dir, 'report.md');
  const r = runGate({ inPath: path.join(dir, 'does-not-exist.md'), outPath: out, reportPath: rep, skipLayerB: true });
  assert.equal(r.verdict, 'fail');
  assert.equal(r.error.stage, 'layerb');
  assert.ok(fs.readFileSync(rep, 'utf8').includes('## Verdict: ERROR'));
});
