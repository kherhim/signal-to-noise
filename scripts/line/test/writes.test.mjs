import test from 'node:test';
import assert from 'node:assert/strict';
import { unexpectedWrites, snapshotTree } from '../writes.mjs';

test('unexpectedWrites reports new paths outside the allowlist', () => {
  assert.deepEqual(unexpectedWrites(['?? a'], ['?? a', '?? b', ' M c'], ['b']), ['c']);
});

test('snapshotTree returns porcelain lines', () => {
  assert.ok(Array.isArray(snapshotTree()));
});
