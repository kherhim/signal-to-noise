import test from 'node:test';
import assert from 'node:assert/strict';
import { registryEntry, commitMessage, preflight, addPaths, redact } from '../publish.mjs';

test('registryEntry shape', () => {
  assert.deepEqual(registryEntry({ slug: 's', title: 'T', date: '2026-09-16' }), { label: 'T (native post, pending)', posted: '', activity: '', essay: 's', added: '2026-09-16' });
});

test('commitMessage carries the gate summary', () => {
  const m = commitMessage({ title: 'T', slug: 's', report: '# Gate report\n\n## Verdict: PASS\nAll four checks clean.' });
  assert.match(m, /^Essay: T \(s\)/);
  assert.match(m, /Gate: PASS/);
});

test('preflight is state-driven and resumable', () => {
  assert.throws(() => preflight({ stage: 'final-sent' }, { finalExists: true }), /title\/family/);
  assert.throws(() => preflight({ stage: 'final-sent', title: 'T', family: 'F' }, { finalExists: false }), /final\.md missing/);
  const st = { title: 'T', family: 'F' };
  assert.equal(preflight({ ...st, stage: 'final-sent' }, { finalExists: true }), 'start');
  assert.equal(preflight({ ...st, stage: 'deploy-failed' }, { finalExists: true }), 'deploy');
  assert.equal(preflight({ ...st, stage: 'push-failed' }, { finalExists: true }), 'push');
  assert.equal(preflight({ ...st, stage: 'published' }, { finalExists: true }), 'done');
});
test('addPaths lists only explicit per-essay and bookkeeping files', () => {
  const p = addPaths('x');
  assert.ok(p.every((f) => !f.endsWith('/') && (f.includes('/x.') || f.endsWith('.json') || f.endsWith('.md'))));
  assert.ok(!p.includes('public/og') && !p.includes('distribution/line'));
});
test('redact masks token-shaped runs', () => {
  assert.equal(redact('token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEF ok'), 'token=[redacted] ok');
  assert.equal(redact('short abc123'), 'short abc123');
});
