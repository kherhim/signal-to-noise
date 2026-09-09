import test from 'node:test';
import assert from 'node:assert/strict';
import { runChild, timeoutMessage, TIMEOUTS } from '../proc.mjs';

test('timeoutMessage names the label and the budget in minutes', () => {
  assert.equal(timeoutMessage('codex', 15), 'codex timed out after 15 min');
});

test('runChild throws "timed out after N min" when the child outlives its budget', () => {
  assert.throws(
    () => runChild('sleep', ['5'], { encoding: 'utf8' }, { timeoutMin: 0.001, label: 'sleep' }),
    /sleep timed out after 0\.001 min/,
  );
});

test('runChild returns the spawnSync result untouched when the child finishes in time', () => {
  const r = runChild('echo', ['hi'], { encoding: 'utf8' }, { timeoutMin: 1, label: 'echo' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'hi');
});

test('runChild still surfaces a non-timeout spawn failure through the result, not a timeout message', () => {
  const r = runChild('sh', ['-c', 'exit 3'], { encoding: 'utf8' }, { timeoutMin: 1, label: 'sh' });
  assert.equal(r.status, 3);
});

test('the agreed per-child budgets are the ones the review asked for', () => {
  assert.deepEqual(TIMEOUTS, { claude: 25, codex: 15, publish: 20, cover: 10, git: 2 });
});
