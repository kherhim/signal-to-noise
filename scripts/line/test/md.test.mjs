import test from 'node:test';
import assert from 'node:assert/strict';
import { splitFrontmatter, joinFrontmatter, SHIPPING_FIELDS, BRE_FIELDS } from '../md.mjs';

test('the approved title is never handed to Codex, but is still spelt British', () => {
  assert.deepEqual(SHIPPING_FIELDS, ['excerpt', 'seoDescription', 'coverImageAlt']);
  assert.ok(!SHIPPING_FIELDS.includes('title'), 'the owner approved that exact title; Layer B must not rewrite it');
  assert.ok(BRE_FIELDS.includes('title'), 'a spelling fix is not a rewrite: the title still gets the BrE pass');
  assert.ok(SHIPPING_FIELDS.every((f) => BRE_FIELDS.includes(f)));
});

test('frontmatter round-trips including quoted values and arrays', () => {
  const src = `---\ntitle: "A: b"\ndate: 2026-09-16\ntags: ["cfo", "ai"]\ndraft: false\n---\n\nBody **x**.\n`;
  const { meta, body, raw } = splitFrontmatter(src);
  assert.equal(meta.title, 'A: b');
  assert.deepEqual(meta.tags, ['cfo', 'ai']);
  assert.equal(body, 'Body **x**.');
  assert.equal(joinFrontmatter(meta, body, raw), src);
});

test('nested blocks and unknown lines survive a round-trip byte for byte', () => {
  const src = `---\ntitle: "T"\ndate: 2026-01-05\nseries:\n  id: leadership-lessons\n  name: "Leadership lessons I wish I knew earlier"\n  part: 6\ntags: ["cfo", "ai"]\ndraft: false\n---\n\nBody.\n`;
  const { meta, body, raw } = splitFrontmatter(src);
  assert.equal(meta.series, undefined);
  assert.equal(joinFrontmatter(meta, body, raw), src);
});

test('escaped quotes round-trip idempotently and edits touch only their line', () => {
  const src = `---\ntitle: "Say \\"no\\" more"\nexcerpt: "One."\n---\n\nB.\n`;
  const p = splitFrontmatter(src);
  assert.equal(p.meta.title, 'Say "no" more');
  assert.equal(joinFrontmatter(p.meta, p.body, p.raw), src);
  const q = splitFrontmatter(joinFrontmatter({ ...p.meta, excerpt: 'Two "2".' }, p.body, p.raw));
  assert.equal(q.meta.title, 'Say "no" more');
  assert.equal(q.meta.excerpt, 'Two "2".');
});
