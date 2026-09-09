import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFig, checkMotionDeclared, validateModule, CAPTION_RE, unexpectedWrites } from '../cover.mjs';

test('nextFig is one above the highest fig in src/covers', () => {
  assert.match(nextFig(), /^\d{2}$/);
  assert.ok(Number(nextFig()) >= 51);
});

test('checkMotionDeclared reads motionPx from a module source', () => {
  assert.equal(checkMotionDeclared('export const cover = { motionPx: 84, slug: "x" }'), 84);
  assert.equal(checkMotionDeclared('no field'), 0);
});

test('validateModule accepts hyphenated house-style captions and enforces the motion floor', () => {
  assert.deepEqual(validateModule("caption: 'FAITH, CLEAR-EYED', motionPx: 120"), { motionPx: 120, caption: 'FAITH, CLEAR-EYED' });
  assert.throws(() => validateModule("caption: 'Faith, clear', motionPx: 120"), /NOUN, ADJECTIVE/);
  assert.throws(() => validateModule("caption: 'FAITH, CLEAR', motionPx: 20"), /motionPx/);
  assert.ok(CAPTION_RE.test('THINKING, SINGLE-SOURCED'));
});

test('unexpectedWrites reports only new paths outside the allowlist', () => {
  const before = ['?? a.txt'];
  const after = ['?? a.txt', '?? src/covers/x.ts', ' M src/pages/index.astro'];
  assert.deepEqual(unexpectedWrites(before, after, ['src/covers/x.ts']), ['src/pages/index.astro']);
});
