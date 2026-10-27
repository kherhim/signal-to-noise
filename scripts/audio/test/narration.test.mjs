import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spokenForm, narrationScript, scriptHash, splitSentences } from '../../../src/lib/narration.mjs';

const read = (f) => readFileSync(new URL('./fixtures/' + f, import.meta.url), 'utf8');

test('spoken forms', () => {
  assert.equal(spokenForm('earning $13.5 billion a year at a 22% return'), 'earning 13.5 billion dollars a year at a 22 per cent return');
  assert.equal(spokenForm('is now $2.68.'), 'is now 2 dollars 68.');
  assert.equal(spokenForm('ran at 3–4%'), 'ran at 3 to 4 per cent');
  assert.equal(spokenForm('£2.1bn and €300m'), '2.1 billion pounds and 300 million euros');
  assert.equal(spokenForm('~$40bn, 10x, Q3 2026, FY2027'), 'about 40 billion dollars, 10 times, third quarter 2026, financial year 2027');
  assert.equal(spokenForm('Citi', { Citi: 'Sitty' }), 'Sitty');
});
test('two-banks fixture', () => {
  const s = narrationScript(read('two-banks-body.md'));
  assert.deepEqual(s.chapters, ['Opening','How losses become permanent','Preparation and succession','Why the gap persists','The week of 13 October','The lessons for public companies']);
  assert.equal(s.items.filter(i => i.kind === 'p').length, 28);
  const all = s.items.map(i => i.text).join(' ');
  for (const bad of ['<', '](', 'Source', '$', '%', '|']) assert.ok(!all.includes(bad), bad);
});
test('chapters edge cases', () => {
  assert.deepEqual(narrationScript('Just one paragraph.').chapters, ['Opening']);
  assert.deepEqual(narrationScript('## First\n\nText.').chapters, ['First']);
});
test('hash ignores figures and link targets, tracks prose', () => {
  const a = 'Up 22% [here](https://a).\n\n<figure>x</figure>';
  assert.equal(scriptHash(narrationScript(a).items), scriptHash(narrationScript('Up 22% [here](https://b).\n\n<figure>y</figure>').items));
  assert.notEqual(scriptHash(narrationScript(a).items), scriptHash(narrationScript('Up 23% [here](https://a).').items));
});
test('sentences', () => {
  assert.deepEqual(splitSentences('It fell 4.5%. Then it rose. Dr. No left.'), ['It fell 4.5%.', 'Then it rose.', 'Dr. No left.']);
});
