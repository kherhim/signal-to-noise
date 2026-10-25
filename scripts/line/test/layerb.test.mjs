import test from 'node:test';
import assert from 'node:assert/strict';
import { codexArgs, buildPrompt, checkOutput, divergence, layerBModel, LAYERB_MAX_SURVIVAL } from '../layerb.mjs';

test('codexArgs runs read-only, non-interactive, writing the last message to a file', () => {
  const a = codexArgs('/tmp/out.md', 'gpt-5.5');
  assert.deepEqual(a.slice(0, 5), ['exec', '-m', 'gpt-5.5', '-c', 'service_tier=default']);
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

test('the Layer B model comes from repo config, never the global Codex config', () => {
  assert.equal(layerBModel({ models: { layerb: 'gpt-5.5' } }), 'gpt-5.5');
  assert.throws(() => layerBModel({ models: {} }), /models\.layerb/);
  assert.throws(() => codexArgs('/tmp/o.md'), /model/);
});

test('divergence: identical text survives whole, a full reword hardly at all', () => {
  const a = 'the board asked whether the company could rely on one supplier for the whole of its compute';
  assert.equal(divergence(a, a).rate, 1);
  const b = 'directors wanted to know if a single vendor might safely provide every bit of processing capacity the firm needs';
  assert.ok(divergence(a, b).rate < 0.1);
});

test('divergence ignores figures, names, quotations and links, which are meant to survive', () => {
  const a = 'Revenue rose 12% to £4.6bn at Anthropic. He said "we will not stop here" and [Reuters reported](https://x.example/a) it.';
  const r = divergence(a, a);
  assert.equal(r.total, 0);
  assert.equal(r.rate, 0);
});

test('buildPrompt keeps the original register and lists formal words not to introduce (24 Oct 2026)', () => {
  const p = buildPrompt('body');
  assert.match(p, /Keep the original register: never swap a plain word for a more formal one/);
  assert.match(p, /Do not introduce these words[^\n]*"expenditure"/);
  const bare = buildPrompt('body', 'body', { pairs: [] });
  assert.match(bare, /Keep the original register/);
  assert.doesNotMatch(bare, /Do not introduce these words/);
});

test('the survival threshold is 35%', () => {
  assert.equal(LAYERB_MAX_SURVIVAL, 0.35);
});
