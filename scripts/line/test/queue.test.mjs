import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQueue, neverListHits } from '../queue.mjs';

test('parseQueue reads title, family, trigger, status', () => {
  const q = parseQueue(`| title | family | trigger | status |\n|---|---|---|---|\n| A | metered cognition | | queued |\n| B | capital allocation | Bank Q3 results | pen |`);
  assert.deepEqual(q, [
    { title: 'A', family: 'metered cognition', trigger: null, status: 'queued' },
    { title: 'B', family: 'capital allocation', trigger: 'Bank Q3 results', status: 'pen' },
  ]);
});

test('neverListHits is case-insensitive and whole-word', () => {
  assert.deepEqual(neverListHits('We spoke to AXI about taxis.', ['Axi']), ['Axi']);
  assert.deepEqual(neverListHits('Taxis only.', ['Axi']), []);
});

test('neverListHits matches entries with trailing punctuation and multi-word names', () => {
  assert.deepEqual(neverListHits('Acme Inc. reported earnings today.', ['Acme Inc.']), ['Acme Inc.']);
  assert.deepEqual(neverListHits('We met Big Bank plc at lunch.', ['Big Bank plc']), ['Big Bank plc']);
  assert.deepEqual(neverListHits('Taxis and maxims.', ['Axi']), []);
});
