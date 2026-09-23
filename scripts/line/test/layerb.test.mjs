import test from 'node:test';
import assert from 'node:assert/strict';
import { codexArgs, buildPrompt, checkOutput } from '../layerb.mjs';

test('codexArgs runs read-only, non-interactive, writing the last message to a file', () => {
  const a = codexArgs('/tmp/out.md');
  assert.ok(a.includes('exec') && a.includes('--sandbox') && a.includes('read-only'));
  assert.ok(a.includes('-o') && a.includes('/tmp/out.md'));
});

test('buildPrompt forbids meaning changes and demands British English', () => {
  const p = buildPrompt('body');
  assert.match(p, /British English/);
  assert.match(p, /do not change (the )?meaning/i);
});

test('checkOutput rejects marker residue and prompt echo', () => {
  assert.throws(() => checkOutput('<<<\nhello\n>>>\nextra >>>', 'Rewrite the markdown essay below so that…'), /markers|echoes/);
  assert.throws(() => checkOutput('Rewrite the markdown essay below so that its statistical fingerprint changes while', 'Rewrite the markdown essay below so that its statistical fingerprint changes while its meaning'), /echoes/);
  assert.equal(checkOutput('<<<\nclean text\n>>>', 'Rewrite the …'), 'clean text');
});

test('buildPrompt changes the fingerprint through words, never through bent word order (23 Sep 2026)', () => {
  const p = buildPrompt('body');
  assert.doesNotMatch(p, /vary sentence openings, clause order/);
  assert.match(p, /Do NOT do it by reordering clauses/);
  assert.match(p, /Keep natural word order/);
  assert.match(p, /few runs of three words survive/);
});
