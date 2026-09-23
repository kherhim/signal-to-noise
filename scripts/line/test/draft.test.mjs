// scripts/line/test/draft.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { exemplars, validateFrontmatter, normaliseInternalLinks, MIN_WORDS, MAX_WORDS } from '../draft.mjs';

test('exemplars returns four recent essays trimmed', () => {
  const e = exemplars(4);
  assert.equal((e.match(/^### /gm) ?? []).length, 4);
  assert.ok(e.length < 4 * 5000);
});

test('validateFrontmatter lists missing keys', () => {
  const missing = validateFrontmatter('---\ntitle: "T"\ndate: 2026-09-16\n---\n\nbody');
  assert.deepEqual(missing, ['excerpt', 'seoDescription', 'tags', 'draft', 'coverImage', 'coverImageAlt', 'coverAnimation']);
});

test('normaliseInternalLinks rewrites absolute site links to the relative spec form', () => {
  const md = 'See [x](https://signal-to-noise.co/insights/a-b/) and [y](https://www.signal-to-noise.co/insights/c/) and [ext](https://example.com/insights/z/).';
  assert.equal(normaliseInternalLinks(md), 'See [x](/insights/a-b/) and [y](/insights/c/) and [ext](https://example.com/insights/z/).');
});

// The word band is the owner's editorial policy, not an implementation detail:
// the previous 1,100 floor sat above the archive's 833-word median, so the line
// could not write an essay of the length most of the site is written at.
test('the word band caps an essay at about a thousand words', () => {
  assert.equal(MAX_WORDS, 1050);
  assert.equal(MIN_WORDS, 600);
  assert.ok(MIN_WORDS < MAX_WORDS, 'the floor must sit below the ceiling');
});
