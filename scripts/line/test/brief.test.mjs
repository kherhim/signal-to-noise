// scripts/line/test/brief.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickTopic, slugify, inFlight, slugTaken, resolveTopic } from '../brief.mjs';

const cfg = { preempt: true, calibration_until: '2000-01-01', thresholds: { preempt: 70, min_fit_to_preempt: 8 } };
const queue = [
  { title: 'The verification premium', family: 'metered cognition', trigger: null, status: 'queued' },
  { title: 'Alignment is a capital-allocation problem', family: 'CFO mandate', trigger: null, status: 'queued' },
  { title: 'Two banks, one start line', family: 'capital allocation', trigger: 'Bank Q3 results', status: 'pen' },
];

test('takes the top queued item and never a pen item without a peg', () => {
  const t = pickTopic({ queue, ledger: { published: [] }, board: { items: [] }, cfg });
  assert.equal(t.title, 'The verification premium');
});

test('series balance skips the family published last week', () => {
  const t = pickTopic({ queue, ledger: { published: [{ family: 'metered cognition', date: '2026-09-09' }] }, board: { items: [] }, cfg, today: '2026-09-14' });
  assert.equal(t.title, 'Alignment is a capital-allocation problem');
});

test('a preempt-level peg mapping to a pen item fires it', () => {
  const board = { items: [{ headline: 'JPM beats', score: 78, action: 'preempt', corpus_fit: 9, maps_to: 'Two banks, one start line', url: 'u' }] };
  const t = pickTopic({ queue, ledger: { published: [] }, board, cfg });
  assert.equal(t.title, 'Two banks, one start line');
  assert.equal(t.source, 'peg');
});

test('no preempt during calibration', () => {
  const board = { items: [{ headline: 'x', score: 90, action: 'preempt', corpus_fit: 10, maps_to: 'Two banks, one start line', url: 'u' }] };
  const t = pickTopic({ queue, ledger: { published: [] }, board, cfg: { ...cfg, preempt: false } });
  assert.equal(t.source, 'queue');
});

test('slugify', () => assert.equal(slugify('The 90-day notice: what it means'), 'the-90-day-notice-what-it-means'));

test('inFlight ignores published, killed and held essays', () => {
  assert.equal(inFlight([{ stage: 'published' }]), false);
  assert.equal(inFlight([{ stage: 'drafted', killed: true }]), false);
  assert.equal(inFlight([{ stage: 'drafted', hold: true }]), false);
  assert.equal(inFlight([{ stage: 'drafted' }]), true);
});

test('inFlight counts a half-sent brief: brief-sending blocks a second brief', () => {
  assert.equal(inFlight([{ stage: 'brief-sending' }]), true);
});

test('slugTaken detects published and live staged slugs but not killed ones', () => {
  assert.equal(slugTaken('a', { published: ['a'], staged: [] }), true);
  assert.equal(slugTaken('b', { published: [], staged: [{ slug: 'b', stage: 'drafted' }] }), true);
  assert.equal(slugTaken('c', { published: [], staged: [{ slug: 'c', killed: true }] }), false);
  assert.equal(slugTaken('d', { published: [], staged: [] }), false);
});

// The shortlist hands runBrief a title the owner chose. Resolving it has to
// keep the peg attached: an owner picking the top-scored story and getting an
// evergreen brief back is the whole failure this override exists to prevent.
const board = { items: [
  { headline: 'Nvidia anchors the IPO', score: 90, action: 'fast_piece', corpus_fit: 9, url: 'u', date: '2026-09-12', note: 'disclose the vendor', proposed_title: 'The landlord finances the tenant', maps_to: '' },
  { headline: 'JPM guides fees up', score: 71, action: 'preempt', corpus_fit: 9, url: 'v', date: '2026-09-19', maps_to: 'Two banks, one start line' },
] };

test('resolveTopic keeps the peg when the pick is a board-only proposal', () => {
  const t = resolveTopic('The landlord finances the tenant', { board, queue });
  assert.equal(t.source, 'peg');
  assert.equal(t.peg.score, 90);
  assert.equal(t.family, 'proposed');
});

test('resolveTopic prefers the queue row for family but still carries the peg', () => {
  const t = resolveTopic('Two banks, one start line', { board, queue });
  assert.equal(t.source, 'queue');
  assert.equal(t.family, 'capital allocation');
  assert.equal(t.peg.score, 71);
});

test('resolveTopic matches an unpegged queue item and reports no peg', () => {
  const t = resolveTopic('Alignment is a capital-allocation problem', { board, queue });
  assert.equal(t.source, 'queue');
  assert.equal(t.peg, null);
});

test('resolveTopic is case- and space-insensitive', () => {
  assert.equal(resolveTopic('  two banks, ONE start line ', { board, queue }).title, 'Two banks, one start line');
});

test('an unknown title throws rather than falling back to an evergreen', () => {
  assert.throws(() => resolveTopic('Not a real topic', { board, queue }), /no topic titled/);
});
