import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanClaudish, claudishFails, RULES, POST_RULES } from '../claudish.mjs';
import { applyRewrites, humaniseFile, kindFor, POST_HOLD_FLAGS } from '../../humanise.mjs';

const ids = (t, rules) => claudishFails(scanClaudish(t, rules ? { rules } : {})).map((h) => h.id);

test('LinkedIn-register tells fail', () => {
  assert.deepEqual(ids('Everybody cheered. Fair enough.'), ['stock-beat']);
  assert.deepEqual(ids('Intro.\n\nThree honest reasons.\n\n1. Data.'), ['countdown']);
  assert.deepEqual(ids('It is banned. Not optional. Banned.'), ['not-fragment']);
  assert.deepEqual(ids('Done. Look, I sell platforms.'), ['chummy-opener']);
  assert.deepEqual(ids('I sell both. That is exactly why I want the number.'), ['exactly-why']);
});

test("the owner's own uses pass", () => {
  // From the hand-written corpus (Buffett fortress; FP&A commandments).
  assert.deepEqual(ids('Leverage magnifies gains, he grants, and that is exactly why it can ruin you.'), []);
  assert.deepEqual(ids('Every variance is a plot twist.'), []);
  assert.deepEqual(ids('Four practices do most of the work.'), []);
  assert.deepEqual(ids('Look at the cash flow statement first.'), []);
});

test('engagement close is a post-only warning', () => {
  const t = 'The point stands.\n\nWhat number would make you buy GPUs? Or sell them?';
  assert.equal(scanClaudish(t).length, 0);
  const h = scanClaudish(t, { rules: [...RULES, ...POST_RULES] });
  assert.deepEqual(h.map((x) => [x.id, x.severity]), [['engagement-close', 'warn']]);
});

test('applyRewrites swaps body sentences, never frontmatter, and reports misses', () => {
  const md = '---\ntitle: Fair enough\n---\nEverybody cheered. Fair enough. Then it fell.';
  const r = applyRewrites(md, [
    { sentence: 'Everybody cheered. Fair enough.', rewrite: 'Everybody cheered, and fairly.' },
    { sentence: 'Not in the text.', rewrite: 'x' },
    { sentence: 'Then it fell.', rewrite: '' },
  ]);
  assert.equal(r.md, '---\ntitle: Fair enough\n---\nEverybody cheered, and fairly. Then it fell.');
  assert.equal(r.applied.length, 1);
  assert.equal(r.unapplied.length, 2);
});

test('kind follows location', () => {
  assert.equal(kindFor('distribution/ready-to-post/x.md'), 'post');
  assert.equal(kindFor('_sources/social/x.md'), 'post');
  assert.equal(kindFor('src/content/insights/x.md'), 'essay');
});

test('posts hold on a flag count, essays on the rate; --apply writes a copy and leaves the original', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'humanise-'));
  const f = path.join(dir, 'post.md');
  const text = 'Prices fell. Buyers gained. Sellers lost. Owners waited.';
  fs.writeFileSync(f, text);
  const flag = (s) => ({ sentence: s, why: 'staccato', rewrite: s.replace('.', ', fast.') });
  const one = () => ({ flags: [flag('Prices fell.')], dropped: 0, words: 8, rate: 125 });
  const two = () => ({ flags: [flag('Prices fell.'), flag('Owners waited.')], dropped: 0, words: 8, rate: 250 });
  assert.equal(humaniseFile(f, { kind: 'post', check: one }).hold, POST_HOLD_FLAGS > 1 ? false : true);
  const r = humaniseFile(f, { kind: 'post', check: two, apply: true });
  assert.equal(r.hold, true);
  assert.equal(fs.readFileSync(f, 'utf8'), text);
  assert.match(fs.readFileSync(r.out.path, 'utf8'), /Prices fell, fast\./);
  assert.equal(humaniseFile(f, { kind: 'essay', check: one }).hold, true);
  assert.equal(humaniseFile(f, { useModel: false }).read, null);
});

test('comment replies: stock openers fail, a direct reply with a question back passes, one flag holds', async () => {
  const { humaniseText, COMMENT_HOLD_FLAGS } = await import('../../humanise.mjs');
  const bad = humaniseText('Great point, Prem! The utilisation number matters.', { useModel: false });
  assert.ok(bad.hits.some((h) => h.id === 'stock-opener'));
  assert.equal(bad.hold, true);
  const good = humaniseText('The utilisation number is the one most CFOs never compute. What did yours come out at?', { useModel: false });
  assert.equal(good.hold, false);
  assert.equal(good.hits.length, 0, 'a question back is conversation, not engagement bait');
  const one = () => ({ flags: [{ sentence: 'The utilisation number matters.', why: 'restates', rewrite: 'At 40% utilisation you rent an empty building.' }], dropped: 0, words: 4, rate: 250 });
  const r = humaniseText('The utilisation number matters.', { check: one, apply: true });
  assert.equal(COMMENT_HOLD_FLAGS, 1);
  assert.equal(r.hold, true);
  assert.equal(r.out.text, 'At 40% utilisation you rent an empty building.');
});

test('rewrites never duplicate a neighbour, and DELETE cuts the sentence', () => {
  const text = 'Thanks for the comment. Most finance teams never compute utilisation, which is the problem. Happy to discuss!';
  const r = applyRewrites(text, [
    { sentence: 'Thanks for the comment.', rewrite: 'Most finance teams never compute utilisation, and that is the problem.' },
    { sentence: 'Happy to discuss!', rewrite: 'DELETE' },
  ]);
  assert.equal(r.md, 'Thanks for the comment. Most finance teams never compute utilisation, which is the problem.');
  assert.equal(r.unapplied[0].reason, 'duplicates a neighbouring sentence');
});
