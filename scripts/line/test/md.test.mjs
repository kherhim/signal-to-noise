import test from 'node:test';
import assert from 'node:assert/strict';
import { splitFrontmatter, joinFrontmatter } from '../md.mjs';

test('frontmatter round-trips including quoted values and arrays', () => {
  const src = `---\ntitle: "A: b"\ndate: 2026-09-16\ntags: ["cfo", "ai"]\ndraft: false\n---\n\nBody **x**.\n`;
  const { meta, body, order } = splitFrontmatter(src);
  assert.equal(meta.title, 'A: b');
  assert.deepEqual(meta.tags, ['cfo', 'ai']);
  assert.equal(body, 'Body **x**.');
  assert.equal(joinFrontmatter(meta, body, order), src);
});
