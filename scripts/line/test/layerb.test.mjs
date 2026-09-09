import test from 'node:test';
import assert from 'node:assert/strict';
import { codexArgs, buildPrompt } from '../layerb.mjs';

test('codexArgs runs read-only, non-interactive, writing the last message to a file', () => {
  const a = codexArgs('/tmp/out.md');
  assert.ok(a.includes('exec') && a.includes('--sandbox') && a.includes('read-only'));
  assert.ok(a.includes('-o') && a.includes('/tmp/out.md'));
});

test('buildPrompt forbids meaning changes and demands British English', () => {
  const p = buildPrompt('body');
  assert.match(p, /British English/);
  assert.match(p, /do not change (the )?meaning/i);
});
