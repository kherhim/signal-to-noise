// scripts/line/test/claudish.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanClaudish, claudishFails, scannableText, renderClaudish, RULES, PROMPT_BANS } from '../claudish.mjs';

const ids = (md) => scanClaudish(md).map((h) => h.id);

test('catches the sentence that started the rule', () => {
  assert.ok(ids('Here is the test, for your own ledger rather than Nvidia\'s.').includes('here-is'));
  assert.ok(ids('Apply this test to your own ledger rather than Nvidia\'s.').includes('rather-than'));
});

test('catches the construction Layer B introduced', () => {
  assert.ok(ids('Nowhere is that calculation required.').includes('fronted-inversion'));
});

test('em dashes fail', () => {
  const hits = scanClaudish('The supplier tightened its financing — and revenue fell.');
  assert.equal(hits[0].id, 'em-dash');
  assert.equal(hits[0].severity, 'fail');
});

test('reader-instruction openers are caught at a sentence start, not mid-sentence', () => {
  assert.ok(ids('Consider the loop.').includes('instruction-opener'));
  assert.ok(ids('The board should consider the loop.').length === 0);
});

test('a real imperative with an object is not an instruction opener', () => {
  // "Follow it one hop at a time" and "Read that last phrase slowly" are the
  // owner's voice; only the announcing verbs are listed.
  assert.deepEqual(ids('Follow it one hop at a time. Read that last phrase slowly.'), []);
});

test('announcing the point, restatement and essence scaffolding all fail', () => {
  assert.ok(ids('The hop hides it, and that is the point.').includes('that-is-the-point'));
  assert.ok(ids('In other words, revenue is not evidence.').includes('in-other-words'));
  assert.ok(ids('Fundamentally, the loop is the issue.').includes('at-its-core'));
  assert.ok(ids('It is worth noting that nobody publishes it.').includes('worth-noting'));
});

test('contrastive negation is allowed once and fails on the second', () => {
  assert.deepEqual(ids('It is not the question.'), []);
  const two = ids('It is not the question. That is not an ordinary anchor.');
  assert.deepEqual(two, ['contrastive-negation']);
  assert.equal(scanClaudish('It is not the question. That is not an ordinary anchor.')[0].count, 2);
});

test('a source quotation never fails the gate', () => {
  // The words are the source's and cannot be reworded without misquoting.
  const md = 'The filing attributes it to "a more selective program, rather than a broad one".';
  assert.deepEqual(ids(md), []);
});

test('blockquotes, code and SVG are not scanned', () => {
  assert.deepEqual(ids('> Here is the quoted claim rather than ours.'), []);
  assert.deepEqual(ids('`Here is code rather than prose`'), []);
  assert.deepEqual(ids('<svg><text>Here is a label rather than prose</text></svg>'), []);
});

test('link text is scanned but the URL is not', () => {
  assert.deepEqual(ids('See [the filing](https://example.com/here-is-a-slug-rather-than-another).'), []);
  assert.ok(ids('See [Here is the filing](https://example.com/x).').includes('here-is'));
});

test('the owner\'s own constructions are deliberately absent from the list', () => {
  const listed = RULES.map((r) => r.id);
  assert.ok(!listed.includes('llm-lexicon'), 'the owner uses those words at 2.40/1k');
  assert.deepEqual(ids('This is not just a loop but a financing rate. It leverages a robust, crucial tapestry.'), []);
});

test('warn-level hits are reported but do not fail the gate', () => {
  const md = 'a: one. b: two. c: three. d: four. e: five.';
  const hits = scanClaudish(md);
  assert.ok(hits.some((h) => h.id === 'colon-payoff'));
  assert.equal(claudishFails(hits).filter((h) => h.id === 'colon-payoff').length, 0);
});

test('clean prose produces nothing', () => {
  assert.deepEqual(ids('Nvidia invests in Anthropic. Anthropic buys Azure capacity from Microsoft.'), []);
  assert.equal(renderClaudish([]), 'No Claudish constructions found.');
});

test('scannableText keeps ordinary prose intact', () => {
  assert.match(scannableText('Revenue fell to $5,841m.'), /Revenue fell to \$5,841m\./);
});

// Found by reading a real gate report: "That is the point" at the start of a
// sentence slipped past a case-sensitive pattern. Sentence-initial rules keep
// their capitals on purpose; these do not.
test('the non-positional rules are case-insensitive', () => {
  assert.ok(ids('That is the point.').includes('that-is-the-point'));
  assert.ok(ids('Rather than argue, look at the ledger.').includes('rather-than'));
  assert.ok(ids('And here is the difficulty.').includes('here-is'));
});

// False positive found on a real draft: "here" as an adverb after a noun is
// ordinary English, not the announcing construction.
test('"here is/are" only fails when it announces', () => {
  assert.deepEqual(ids('Two things here are unknown.'), []);
  assert.deepEqual(ids('The figures here are corroborated.'), []);
  assert.ok(ids('Here is the test.').includes('here-is'));
  assert.ok(ids('And here is the difficulty.').includes('here-is'));
});

// The regex list and the Layer B prompt must not drift apart: a rule added to
// one without the other means Layer B keeps producing what the gate rejects.
test('every fail-level rule is also banned in the Layer B prompt', () => {
  const banned = new Set(PROMPT_BANS.map(([id]) => id));
  for (const r of RULES) {
    assert.ok(banned.has(r.id), `rule "${r.id}" is not in PROMPT_BANS`);
  }
});

test('the landlord essay tells of 23 Sep 2026 all fail', () => {
  const old = "Your own ledger deserves this test before Nvidia's does. Knowing the answer pays precisely because nobody requires you to report it. Four questions will get you there. The question lies elsewhere.";
  const found = ids(old);
  for (const id of ['ledger', 'deserves', 'precisely-because', 'signpost-close', 'your-own-pivot', 'lies-elsewhere']) {
    assert.ok(found.includes(id), `${id} not caught`);
  }
  assert.ok(ids('Ledgers, general ledger, the LEDGER.').includes('ledger'));
  assert.deepEqual(ids('The same test should start with your own company. Four questions give you the answer.'), []);
});
