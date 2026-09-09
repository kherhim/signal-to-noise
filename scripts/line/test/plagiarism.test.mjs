import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSentences, extractQuotes, verdictFrom } from '../plagiarism.mjs';

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
