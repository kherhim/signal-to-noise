import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFig, checkMotionDeclared } from '../cover.mjs';

test('nextFig is one above the highest fig in src/covers', () => {
  assert.match(nextFig(), /^\d{2}$/);
  assert.ok(Number(nextFig()) >= 51);
});

test('checkMotionDeclared reads motionPx from a module source', () => {
  assert.equal(checkMotionDeclared('export const cover = { motionPx: 84, slug: "x" }'), 84);
  assert.equal(checkMotionDeclared('no field'), 0);
});
