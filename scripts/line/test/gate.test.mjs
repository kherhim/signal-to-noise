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
  const r = runGate({ inPath: path.join(dir, 'does-not-exist.md'), outPath: out, reportPath: rep, skipLayerB: true, deps: { serviceUp: () => true } });
  assert.equal(r.verdict, 'fail');
  assert.equal(r.error.stage, 'layerb');
  assert.ok(fs.readFileSync(rep, 'utf8').includes('## Verdict: ERROR'));
});

// --- offline gate tests: every paid or networked collaborator is injected ---

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const clean = { suspicious: false, report: null, kind: 'text' };
const offlineDeps = (over = {}) => ({
  serviceUp: () => true,
  checkPlagiarism: () => ({ verdict: 'pass', sentences: [], citations: [], cost_usd: 0 }),
  inspectFile: () => clean,
  cleanFile: () => ({ changed: false, report: null }),
  loadNeverList: () => ['Axi'],
  ...over,
});

test('runGate refuses to start when the watermarks service is down, and spends nothing', () => {
  const dir = tmp('gate-down-');
  const src = path.join(dir, 'in.md'), out = path.join(dir, 'out.md'), rep = path.join(dir, 'report.md');
  fs.writeFileSync(src, '---\ntitle: "T"\n---\n\nBody.\n');
  const r = runGate({
    inPath: src, outPath: out, reportPath: rep, skipLayerB: true,
    deps: offlineDeps({ serviceUp: () => false, checkPlagiarism: () => { throw new Error('must not spend'); } }),
  });
  assert.equal(r.verdict, 'fail');
  assert.match(r.error.message, /watermarks service not running at http/);
  assert.match(r.error.message, /make serve.*watermarks-remover/);
  const report = fs.readFileSync(rep, 'utf8');
  assert.ok(report.includes('## Verdict: ERROR'));
  assert.ok(report.includes('watermarks service not running'));
  assert.equal(fs.existsSync(out), false, 'nothing is written when the prerequisite is missing');
});

test('runGate fails the gate on a never-list hit, after the BrE step and before Layer A', () => {
  const dir = tmp('gate-never-');
  const src = path.join(dir, 'in.md'), out = path.join(dir, 'out.md'), rep = path.join(dir, 'report.md');
  fs.writeFileSync(src, '---\ntitle: "T"\nexcerpt: "One."\n---\n\nAt Axi the behavior was different.\n');
  const seen = [];
  const r = runGate({
    inPath: src, outPath: out, reportPath: rep, skipLayerB: true,
    deps: offlineDeps({ inspectFile: (f) => { seen.push(f); return clean; } }),
  });
  assert.equal(r.verdict, 'fail');
  assert.deepEqual(r.checks.neverlist.hits, ['Axi']);
  assert.ok(r.report.includes('never-list: Axi'));
  assert.equal(seen.length, 2, 'Layer A still runs last, before and after');
  assert.match(fs.readFileSync(out, 'utf8'), /behaviour/, 'the BrE fix landed before the never-list check');
});

test('runGate passes a clean file and reports no never-list hits', () => {
  const dir = tmp('gate-clean-');
  const src = path.join(dir, 'in.md'), out = path.join(dir, 'out.md'), rep = path.join(dir, 'report.md');
  fs.writeFileSync(src, '---\ntitle: "T"\nexcerpt: "One."\n---\n\nPlain body.\n');
  const r = runGate({ inPath: src, outPath: out, reportPath: rep, skipLayerB: true, deps: offlineDeps() });
  assert.equal(r.verdict, 'pass');
  assert.deepEqual(r.checks.neverlist.hits, []);
  assert.ok(r.report.includes('Never-list'));
});

test('BrE fixes touch the body and the shipping fields only — never an identifier line', () => {
  const dir = tmp('gate-bre-');
  const src = path.join(dir, 'in.md'), out = path.join(dir, 'out.md'), rep = path.join(dir, 'report.md');
  fs.writeFileSync(src, [
    '---', 'title: "T"', 'excerpt: "The color of the analyze step."',
    'coverImage: "/img/color-theory.webp"', 'coverAnimation: "color-theory"', 'tags: ["color"]',
    '---', '', 'The behavior of the color model.', '',
  ].join('\n'));
  const r = runGate({ inPath: src, outPath: out, reportPath: rep, skipLayerB: true, deps: offlineDeps() });
  const md = fs.readFileSync(out, 'utf8');
  assert.match(md, /^coverImage: "\/img\/color-theory\.webp"$/m, 'a file path is never respelt');
  assert.match(md, /^coverAnimation: "color-theory"$/m, 'a cover id is never respelt');
  assert.match(md, /^tags: \["color"\]$/m, 'a tag is never respelt');
  assert.match(md, /^excerpt: "The colour of the analyse step\."$/m);
  assert.match(md, /The behaviour of the colour model\./);
  assert.deepEqual(r.checks.bre.remaining, [], 'identifier lines must not flag for ever as unresolved');
  assert.equal(r.verdict, 'pass');
});
