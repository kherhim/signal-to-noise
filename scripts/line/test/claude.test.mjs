import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArgs, parseOutput } from '../claude.mjs';

test('buildArgs composes a headless invocation', () => {
  const a = buildArgs({ prompt: 'P', tools: ['WebSearch', 'Read'], schema: { type: 'object' }, maxTurns: 5, model: 'claude-fable-5-1' });
  assert.deepEqual(a.slice(0, 4), ['-p', 'P', '--output-format', 'json']);
  assert.ok(a.includes('--allowedTools') && a.includes('WebSearch,Read'));
  assert.ok(a.includes('--json-schema'));
  assert.ok(a.includes('--max-turns') && a.includes('5'));
  assert.ok(a.includes('--model') && a.includes('claude-fable-5-1'));
});

test('parseOutput reads the trailing result message', () => {
  const out = JSON.stringify([{ type: 'system' }, { type: 'result', result: '{"a":1}', total_cost_usd: 0.12, session_id: 's', is_error: false }]);
  const r = parseOutput(out, true);
  assert.equal(r.cost_usd, 0.12);
  assert.deepEqual(r.json, { a: 1 });
});
