import test from 'node:test';
import assert from 'node:assert/strict';
import { registryEntry, commitMessage } from '../publish.mjs';

test('registryEntry shape', () => {
  assert.deepEqual(registryEntry({ slug: 's', title: 'T', date: '2026-09-16' }), { label: 'T (native post, pending)', posted: '', activity: '', essay: 's', added: '2026-09-16' });
});

test('commitMessage carries the gate summary', () => {
  const m = commitMessage({ title: 'T', slug: 's', report: '# Gate report\n\n## Verdict: PASS\nAll four checks clean.' });
  assert.match(m, /^Essay: T \(s\)/);
  assert.match(m, /Gate: PASS/);
});
