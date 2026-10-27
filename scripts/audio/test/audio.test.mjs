import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audioFor } from '../../../src/lib/audio.mjs';
import { narrationScript, scriptHash } from '../../../src/lib/narration.mjs';

const body = '## Heading\n\nA first paragraph about earning $13.5 billion.\n\nA second paragraph.';
const hash = scriptHash(narrationScript(body, {}).items);
const entry = (h) => ({ voice: 'v', engine: 'e', hash: h, file: 's.' + h.slice(0, 8) + '.m4a', duration: 60, chapters: [['Intro', 0]], peaks: [] });

test('returns the entry when hashes match', () => {
  const e = entry(hash);
  assert.equal(audioFor('s', body, { s: e }, () => assert.fail('warned')), e);
});

test('returns null and warns once when hashes differ', () => {
  const calls = [];
  const r = audioFor('s', body, { s: entry('0'.repeat(hash.length)) }, (m) => calls.push(m));
  assert.equal(r, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], '[audio] s: text changed since narration; player hidden until re-narrated');
});

test('returns null silently when no entry', () => {
  assert.equal(audioFor('s', body, {}, () => assert.fail('warned')), null);
});
