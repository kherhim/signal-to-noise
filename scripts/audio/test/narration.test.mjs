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

test('lists become one item per line, markers stripped', () => {
  const t = (b) => narrationScript(b).items.map((i) => i.text);
  assert.deepEqual(t('- one\n- two'), ['one', 'two']);
  assert.deepEqual(t('1. **First.** a\n2. Second'), ['First. a', 'Second']);
  const s = narrationScript(read('two-banks-body.md'));
  for (const i of s.items) assert.ok(!/^\d+\.|^- /.test(i.text), i.text);
});
test('heading line followed by text; markdown escapes', () => {
  assert.deepEqual(narrationScript('## H\nText follows.').items, [{ kind: 'h', text: 'H' }, { kind: 'p', text: 'Text follows.' }]);
  assert.equal(spokenForm('\\> a \\[b\\] 2\\. c'), '> a [b] 2. c');
});
test('sentence edge cases', () => {
  assert.deepEqual(splitSentences('In the U.S. it rose, i.e. a lot. Then c. 1900 came. Vitamin C. Then it fell.'),
    ['In the U.S. it rose, i.e. a lot.', 'Then c. 1900 came.', 'Vitamin C.', 'Then it fell.']);
  assert.deepEqual(splitSentences('He said “stop.” Then left.'), ['He said “stop.”', 'Then left.']);
});
test('only en dash makes a range', () => {
  assert.equal(spokenForm('2026-10-27, 13-month, 11-3, 3–4'), '2026-10-27, 13-month, 11-3, 3 to 4');
});
test('html entities decoded', () => {
  assert.equal(spokenForm('it&#8217;s A&nbsp;B &amp; C'), 'it’s A B and C');
});
test('paragraphs starting with html or images are kept', () => {
  const s = narrationScript('<em>Note</em> this matters.\n\n![alt](x.png)\n\n!Wow indeed.');
  assert.deepEqual(s.items.map((i) => i.text), ['Note this matters.', '!Wow indeed.']);
});
test('nested parentheses in urls', () => {
  assert.equal(spokenForm('See [Foo](https://x.org/a_(b)) now ([Source](https://x.org/a_(b)))'), 'See Foo now');
});
test('hashtag-only paragraphs are skipped', () => {
  const s = narrationScript('Real text here.\n\n#CFO #MergersAndAcquisitions #FinanceLeadership');
  assert.deepEqual(s.items.map((i) => i.text), ['Real text here.']);
});
test('amounts under one unit are read as cents or pence', () => {
  assert.equal(spokenForm('it cost $0.06 and £0.50'), 'it cost 6 cents and 50 pence');
});
test('emoji dropped, keycaps become numbers, vs. read as versus', () => {
  assert.equal(spokenForm('4️⃣ Cross-functional trust 🚀'), '4 Cross-functional trust');
  assert.equal(spokenForm('🔟 Why scaling requires stopping'), '10 Why scaling requires stopping');
  assert.equal(spokenForm('🔟1. Thou shalt know thy audience'), '1. Thou shalt know thy audience');
  assert.equal(spokenForm('junior FP&A teams, M&A and P&L'), 'junior FP and A teams, M and A and P and L');
  assert.equal(spokenForm('$250k a year, $2tn and £3m'), '250 thousand dollars a year, 2 trillion dollars and 3 million pounds');
  assert.deepEqual(splitSentences('2. Methodology: it varies. Then 3 more.'), ['2. Methodology: it varies.', 'Then 3 more.']);
  assert.equal(spokenForm('Quarterly forecasts vs. Life'), 'Quarterly forecasts versus Life');
});
