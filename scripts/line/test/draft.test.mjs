// scripts/line/test/draft.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { exemplars, validateFrontmatter, normaliseInternalLinks } from '../draft.mjs';

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
