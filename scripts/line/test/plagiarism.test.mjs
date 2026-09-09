import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSentences, extractQuotes, verdictFrom, stripMarkup } from '../plagiarism.mjs';

test('pickSentences returns the n longest prose sentences without links or headings', () => {
  const body = '## H\n\nShort. This is a considerably longer sentence with distinctive wording about budgets. Another long sentence that mentions [a link](http://x) inside it.\n\n> quoted line\n';
  const s = pickSentences(body, 2);
  assert.equal(s.length, 2);
  assert.ok(s.every((x) => !x.includes('](') && !x.startsWith('#')));
});

test('extractQuotes finds blockquotes and inline quotes with their nearest link', () => {
  const q = extractQuotes('He said "cash is king" ([source](https://a.b/c)).\n\n> Price is what you pay\n>\n> — Buffett, [2008 letter](https://berkshire/2008)');
  assert.deepEqual(q, [{ quote: 'cash is king', url: 'https://a.b/c' }, { quote: 'Price is what you pay', url: 'https://berkshire/2008' }]);
});

test('verdictFrom fails on any hit or unverified citation', () => {
  assert.equal(verdictFrom({ sentences: [{ hit: false }], citations: [{ verified: true }] }), 'pass');
  assert.equal(verdictFrom({ sentences: [{ hit: true }], citations: [] }), 'fail');
  assert.equal(verdictFrom({ sentences: [], citations: [{ verified: false }] }), 'fail');
});

test('extractQuotes accepts curly quotes and never spans lines on an unpaired straight quote', () => {
  const body = 'He said “cash is king” ([src](https://a.b/c)).\nAn inch mark 12" here.\n\nMuch later "another quote that is long enough" ([s](https://d.e/f)).';
  assert.deepEqual(extractQuotes(body), [
    { quote: 'cash is king', url: 'https://a.b/c' },
    { quote: 'another quote that is long enough', url: 'https://d.e/f' },
  ]);
});
test('extractQuotes joins multi-line blockquotes', () => {
  const body = '> Price is what you pay.\n> Value is what you get.\n>\n> — Buffett, [2008 letter](https://berkshire/2008)';
  assert.deepEqual(extractQuotes(body), [{ quote: 'Price is what you pay. Value is what you get.', url: 'https://berkshire/2008' }]);
});
test('pickSentences keeps snake_case words intact and strips italics', () => {
  const s = pickSentences('The signal_to_noise ratio was _quietly_ the point of the whole exercise here.', 1);
  assert.equal(s[0], 'The signal_to_noise ratio was quietly the point of the whole exercise here.');
});

test('stripMarkup removes svg/script/style/comments/fences/tags so their quoted attributes are not treated as quotes', () => {
  const body = 'Real prose here.\n<svg viewBox="0 0 10 10"><text font-family="JetBrains Mono, monospace">"not a quotation at all"</text></svg>\n<!-- "hidden comment text here" -->\n```\n"code block quoted text here"\n```\n<em>kept text</em> and "an actual quotation of note" ([s](https://x.y/z)).';
  const out = stripMarkup(body);
  assert.ok(!out.includes('svg') && !out.includes('hidden comment') && !out.includes('code block'));
  assert.ok(out.includes('kept text'));
  assert.deepEqual(extractQuotes(body), [{ quote: 'an actual quotation of note', url: 'https://x.y/z' }]);
});
