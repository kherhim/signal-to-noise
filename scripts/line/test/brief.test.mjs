// scripts/line/test/brief.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickTopic, slugify, inFlight, vetoDeadline, slugTaken } from '../brief.mjs';

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

test('vetoDeadline rolls to the next day when the lead time is too short', () => {
  const at = (h, m = 0) => { const d = new Date(2026, 8, 14, h, m, 0, 0); return d; };
  assert.equal(vetoDeadline(at(7), 19).getTime(), at(19).getTime());
  const late = vetoDeadline(at(18), 19);
  assert.equal(late.getDate(), 15); assert.equal(late.getHours(), 19);
  const past = vetoDeadline(at(21), 19);
  assert.equal(past.getDate(), 15);
});

test('slugTaken detects published and live staged slugs but not killed ones', () => {
  assert.equal(slugTaken('a', { published: ['a'], staged: [] }), true);
  assert.equal(slugTaken('b', { published: [], staged: [{ slug: 'b', stage: 'drafted' }] }), true);
  assert.equal(slugTaken('c', { published: [], staged: [{ slug: 'c', killed: true }] }), false);
  assert.equal(slugTaken('d', { published: [], staged: [] }), false);
});
