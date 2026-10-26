import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { quarterIndex, qLabel, qFull, windowed, prepare, tiles, commonQuarters, combined, yMax } from '../../../src/lib/hyperscalers.mjs';

// Frozen copy of the data as published, so later refreshes never move these numbers.
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/hyperscalers-2026-10-26.json', import.meta.url)));
const rows = prepare(fixture);
const latest = (name) => rows.find((r) => r.name === name).qs.at(-1);

test('quarter labels sit on one calendar axis', () => {
  assert.equal(quarterIndex('Q1 2025'), 8100);
  assert.equal(quarterIndex('Q3 2026'), 2026 * 4 + 2);
  assert.equal(qLabel(quarterIndex('Q3 2026')), 'Q3 26');
  assert.equal(qFull(quarterIndex('Q4 2024')), 'Q4 2024');
});

test('companies come in the fixed order', () => {
  assert.deepEqual(rows.map((r) => r.name), ['Microsoft', 'Alphabet', 'Amazon', 'Meta', 'Oracle']);
});

test('free cash flow is each company\'s own definition', () => {
  assert.equal(latest('Meta').fcf, -2.12);
  assert.equal(latest('Amazon').fcf, -7.69);
  const m = latest('Meta');
  assert.equal(m.capexShown, +(m.ocf - m.fcf).toFixed(2));
});

test('headline tiles match the approved mockup', () => {
  const t = tiles(rows);
  assert.equal(Math.round(t.capexShare * 100), 85);
  assert.deepEqual(t.negative, ['Alphabet', 'Amazon', 'Meta', 'Oracle']);
  assert.deepEqual(t.buyingBack, ['Microsoft']);
  assert.equal(Math.round(t.debtAdded), 231);
  assert.equal(Math.round(t.debtNow), 457);
});

test('a ninth quarter pushes out the oldest', () => {
  const qs = Array.from({ length: 9 }, (_, k) => ({ q: `Q${(k % 4) + 1} ${2024 + Math.floor(k / 4)}` }));
  const w = windowed(qs);
  assert.equal(w.length, 8);
  assert.equal(w[0].q, 'Q2 2024');
});

test('combined series use only quarters every company reported', () => {
  const common = commonQuarters(rows);
  assert.equal(qFull(common[0]), 'Q4 2024');
  assert.equal(qFull(common.at(-1)), 'Q2 2026');
  const extra = [...rows, { name: 'X', qs: [{ i: common[0], buybacks: 0, debt: 0 }] }];
  assert.deepEqual(commonQuarters(extra), [common[0]]);
});

test('combined sums never produce NaN, and all-zero quarters give 0', () => {
  const bb = combined(rows, 'buybacks');
  assert.ok(bb.every((d) => Number.isFinite(d.v)));
  const zero = rows.map((r) => ({ ...r, qs: r.qs.map((q) => ({ ...q, buybacks: 0 })) }));
  assert.ok(combined(zero, 'buybacks').every((d) => d.v === 0));
  assert.equal(Math.round(bb[0].v * 10) / 10, 20.7);
});

test('y scale is a round number above every value', () => {
  const m = yMax(rows);
  assert.equal(m % 20, 0);
  assert.ok(rows.every((r) => r.qs.every((q) => q.ocf <= m && q.capexShown <= m)));
});
