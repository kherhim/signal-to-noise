import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vetFlags, pickVoice, checkHumaniser, renderHumaniser } from '../humaniser.mjs';

const ESSAY = 'Nvidia invests in Anthropic. Your own books deserve this test first. The loop is hidden.';

test('a flag that does not quote the essay is dropped', () => {
  const r = vetFlags([{ sentence: 'Invented sentence.', why: 'x', rewrite: 'y' }], ESSAY);
  assert.equal(r.flags.length, 0);
  assert.equal(r.dropped.length, 1);
});

test('a quoted flag is kept, whitespace-insensitively', () => {
  const r = vetFlags([{ sentence: 'Your own  books deserve\nthis test first.', why: 'pivot', rewrite: 'Run the test on your company first.' }], ESSAY);
  assert.equal(r.flags.length, 1);
  assert.equal(r.flags[0].rewrite, 'Run the test on your company first.');
});

test('a suggested rewrite that trips the Claudish test is withheld', () => {
  const r = vetFlags([{ sentence: 'The loop is hidden.', why: 'flat', rewrite: 'The loop sits in the ledger, rather than the notes.' }], ESSAY);
  assert.equal(r.flags[0].rewrite, '');
  assert.match(r.flags[0].rewriteRejected, /ledger/);
  assert.match(renderHumaniser({ flags: r.flags, dropped: 0 }), /withheld/);
});

test('voice samples exclude the line\'s own essays', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-'));
  fs.writeFileSync(path.join(dir, 'owner-a.md'), '---\ntitle: a\n---\nOwner words here.');
  fs.writeFileSync(path.join(dir, 'line-b.md'), '---\ntitle: b\n---\nLine words here.');
  const v = pickVoice({ dir, exclude: ['line-b'], n: 3 });
  assert.ok(v.every((s) => !s.includes('Line words')));
  assert.ok(v.some((s) => s.includes('Owner words')));
});

test('checkHumaniser strips quotations before the reader sees them, and reports flags', () => {
  let seen;
  const run = ({ input }) => { seen = JSON.parse(input); return { json: { flags: [{ sentence: 'The loop is hidden.', why: 'flat', rewrite: 'Nobody can see the loop.' }] }, cost_usd: 0.1 }; };
  const r = checkHumaniser(`${ESSAY} He said "this quoted sentence belongs to a source".`, { run, voice: ['v'] });
  assert.ok(!seen.essay.includes('belongs to a source'));
  assert.equal(r.flags.length, 1);
  assert.equal(r.cost_usd, 0.1);
});

test('the hold threshold is a rate, not any flag', async () => {
  const { humaniserRate, humaniserFails, FAIL_PER_1K } = await import('../humaniser.mjs');
  assert.equal(FAIL_PER_1K, 3);
  assert.equal(humaniserRate(2, 1000), 2);
  assert.equal(humaniserFails({ rate: 3 }), false);
  assert.equal(humaniserFails({ rate: 3.01 }), true);
});
