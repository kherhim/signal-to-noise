import test from 'node:test';
import assert from 'node:assert/strict';
import { score, actionFor, renderBoard, topScore, filterNeverList, scan } from '../scan.mjs';

const cfg = { thresholds: { native_post: 50, preempt: 70, fast_piece: 85, min_fit_to_preempt: 8 }, weights: { corpus_fit: 0.35, magnitude: 0.25, velocity: 0.20, number: 0.20 } };

test('score is the weighted sum scaled to 100', () => {
  assert.equal(score({ corpus_fit: 10, magnitude: 10, velocity: 10, number: 10 }, cfg.weights), 100);
  assert.equal(score({ corpus_fit: 10, magnitude: 5, velocity: 0, number: 10 }, cfg.weights), 67.5);
});

test('actionFor applies thresholds and the fit rule', () => {
  assert.equal(actionFor(40, 10, cfg), 'log');
  assert.equal(actionFor(60, 10, cfg), 'native_post');
  assert.equal(actionFor(75, 8, cfg), 'preempt');
  assert.equal(actionFor(75, 6, cfg), 'native_post');
  assert.equal(actionFor(90, 9, cfg), 'fast_piece');
});

test('renderBoard produces a markdown table sorted by score', () => {
  const md = renderBoard({ date: '2026-09-10', items: [{ headline: 'B', score: 40, action: 'log', maps_to: '', url: 'u' }, { headline: 'A', score: 80, action: 'preempt', maps_to: 'X', url: 'v' }] });
  assert.ok(md.indexOf('| A |') < md.indexOf('| B |'));
});

test('topScore is the maximum regardless of order', () => {
  assert.equal(topScore([{ score: 40 }, { score: 85.5 }, { score: 70 }]), 85.5);
  assert.equal(topScore([]), 0);
});

test('filterNeverList checks every string field, with word boundaries', () => {
  const items = [
    { headline: 'A', note: 'n', maps_to: '', proposed_title: 'Axi and the CFO', source: 'x', url: 'u' },
    { headline: 'B', note: 'n', maps_to: '', proposed_title: '', source: 'Axios', url: 'u' },
  ];
  assert.deepEqual(filterNeverList(items, ['Axi']).map((i) => i.headline), ['B']);
});

test('scan({ dry: true }) returns null and never calls the model (no spend)', async () => {
  const board = await scan({ dry: true });
  assert.equal(board, null);
});
