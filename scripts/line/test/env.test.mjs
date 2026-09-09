import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldWriteLog } from '../env.mjs';

test('shouldWriteLog writes by default', () => {
  assert.equal(shouldWriteLog({}), true);
});

test('shouldWriteLog skips the file under the node test runner', () => {
  assert.equal(shouldWriteLog({ NODE_TEST_CONTEXT: 'child' }), false);
});

test('shouldWriteLog skips the file when LINE_NO_FILE_LOG=1', () => {
  assert.equal(shouldWriteLog({ LINE_NO_FILE_LOG: '1' }), false);
});
