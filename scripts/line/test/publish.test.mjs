import test from 'node:test';
import assert from 'node:assert/strict';
import { registryEntry, commitMessage, preflight, addPaths, redact, upsertRegistry, upsertLedger } from '../publish.mjs';

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
test('upsertRegistry appends once and is a no-op on a retry of the same essay', () => {
  const empty = { posts: [] };
  const entry = registryEntry({ slug: 's', title: 'T', date: '2026-09-16' });
  const once = upsertRegistry(empty, entry);
  assert.equal(once.posts.length, 1);
  const twice = upsertRegistry(once, registryEntry({ slug: 's', title: 'T (retitled)', date: '2026-09-23' }));
  assert.equal(twice.posts.length, 1, 'a re-run must not add a second row for the same essay');
  assert.equal(twice.posts[0].label, 'T (native post, pending)', 'the first entry wins; a retry never rewrites it');
  assert.equal(empty.posts.length, 0, 'the input is not mutated');
  assert.equal(upsertRegistry(once, registryEntry({ slug: 'other', title: 'O', date: '2026-09-23' })).posts.length, 2);
});

test('upsertLedger appends once and is a no-op on a retry of the same slug', () => {
  const empty = { published: [] };
  const entry = { slug: 's', title: 'T', family: 'F', date: '2026-09-16', url: 'u', cost_usd: 1 };
  const once = upsertLedger(empty, entry);
  assert.equal(once.published.length, 1);
  assert.equal(upsertLedger(once, { ...entry, cost_usd: 99 }).published.length, 1);
  assert.equal(upsertLedger(once, { ...entry, cost_usd: 99 }).published[0].cost_usd, 1);
  assert.equal(empty.published.length, 0, 'the input is not mutated');
  assert.equal(upsertLedger(once, { ...entry, slug: 'other' }).published.length, 2);
});

test('upsert helpers tolerate a registry or ledger with no array yet', () => {
  assert.equal(upsertRegistry({}, registryEntry({ slug: 's', title: 'T', date: 'd' })).posts.length, 1);
  assert.equal(upsertLedger({}, { slug: 's' }).published.length, 1);
});

test('redact masks token-shaped runs', () => {
  assert.equal(redact('token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEF ok'), 'token=[redacted] ok');
  assert.equal(redact('short abc123'), 'short abc123');
});
