import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.LINE_STAGING = fs.mkdtempSync(path.join(os.tmpdir(), 'line-'));
const { loadState, saveState, listEssays, STAGES, essayDir } = await import('../state.mjs');

test('state round-trips and lists essays', () => {
  assert.equal(loadState('x').stage, 'new');
  saveState('x', { stage: 'briefed', brief_sent_at: '2026-09-14T06:00:00Z' });
  assert.equal(loadState('x').stage, 'briefed');
  assert.deepEqual(listEssays().map((e) => e.slug), ['x']);
  assert.ok(fs.existsSync(path.join(essayDir('x'), 'state.json')));
  assert.equal(STAGES[0], 'new');
  assert.equal(STAGES.at(-1), 'published');
});

test('STAGES lists every stage the line can actually persist, in order', () => {
  assert.deepEqual(STAGES, [
    'new', 'brief-sending', 'briefed', 'approved', 'drafted', 'gated', 'covered',
    'final-sending', 'final-sent', 'deploying', 'deploy-failed', 'push-failed', 'published',
  ]);
});
