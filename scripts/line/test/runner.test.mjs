// scripts/line/test/runner.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextAction } from '../runner.mjs';

const cfg = { veto_hour_local: 19, final_hour_local: 18, publish_hour_uk: 8 };
const at = (s) => new Date(s);

test('briefed waits for the veto deadline then checks', () => {
  const st = { stage: 'briefed', veto_deadline: '2026-09-14T18:00:00.000Z' };
  assert.equal(nextAction(st, at('2026-09-14T17:00:00Z'), cfg), null);
  assert.equal(nextAction(st, at('2026-09-14T18:05:00Z'), cfg), 'check-veto');
});

test('approved → draft → gate → cover → send-final in order', () => {
  assert.equal(nextAction({ stage: 'approved' }, at('2026-09-14T20:00:00Z'), cfg), 'draft');
  assert.equal(nextAction({ stage: 'drafted' }, at('2026-09-15T01:00:00Z'), cfg), 'gate');
  assert.equal(nextAction({ stage: 'gated', gate_verdict: 'pass' }, at('2026-09-15T02:00:00Z'), cfg), 'cover');
  assert.equal(nextAction({ stage: 'gated', gate_verdict: 'fail' }, at('2026-09-15T02:00:00Z'), cfg), null);
  assert.equal(nextAction({ stage: 'covered' }, at('2026-09-15T03:00:00Z'), cfg), 'send-final');
});

test('final-sent polls for a reply; publishes only when approved and after the slot', () => {
  const st = { stage: 'final-sent', approved: false, publish_not_before: '2026-09-16T07:00:00.000Z' };
  assert.equal(nextAction(st, at('2026-09-15T20:00:00Z'), cfg), 'check-final');
  assert.equal(nextAction({ ...st, approved: true }, at('2026-09-16T06:00:00Z'), cfg), null);
  assert.equal(nextAction({ ...st, approved: true }, at('2026-09-16T07:30:00Z'), cfg), 'publish');
});

test('a failed deploy or push retries publish on the next wake', () => {
  assert.equal(nextAction({ stage: 'deploy-failed', approved: true }, at('2026-09-16T09:00:00Z'), cfg), 'publish');
  assert.equal(nextAction({ stage: 'push-failed', approved: true }, at('2026-09-16T09:00:00Z'), cfg), 'publish');
});

test('hold, killed and published do nothing', () => {
  assert.equal(nextAction({ stage: 'approved', hold: true }, at('2026-09-14T20:00:00Z'), cfg), null);
  assert.equal(nextAction({ stage: 'approved', killed: true }, at('2026-09-14T20:00:00Z'), cfg), null);
  assert.equal(nextAction({ stage: 'published' }, at('2026-09-14T20:00:00Z'), cfg), null);
});
