import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runTuesday, pickBranch } from '../tuesday.mjs';

function fakes(o = {}) {
  const calls = { prepare: [], publish: [], mail: [], pr: [], pull: 0 };
  const deps = {
    today: () => '2026-10-27',
    pull: () => { calls.pull++; },
    plan: () => o.plan ?? { stale: ['s1'], missing: ['m1'], upcoming: ['d1'] },
    prepare: async (slug) => { calls.prepare.push(slug); if (o.failPrepare === slug) throw new Error('nope'); },
    publish: async (slug) => { calls.publish.push(slug); if (o.failPublish === slug) throw new Error('boom'); },
    changedFiles: () => o.changed ?? ['src/data/audio/s1.json'],
    openPr: (info) => { calls.pr.push(info); return 'https://example/pr/1'; },
    sendMail: (m) => { calls.mail.push(m); },
    log: () => {},
    ...(o.deps ?? {}),
  };
  return { deps, calls };
}

test('a failure produces exactly one sendMail call', async () => {
  const { deps, calls } = fakes({ failPublish: 's1' });
  const r = await runTuesday(deps);
  assert.deepEqual(r.failed, ['s1']);
  assert.equal(calls.mail.length, 1);
  assert.equal(calls.mail[0].subject, 'Essay audio: 1 failed');
  assert.match(calls.mail[0].text, /s1/);
});

test('a clean run sends no mail', async () => {
  const { deps, calls } = fakes();
  const r = await runTuesday(deps);
  assert.deepEqual(r, { prepared: ['d1'], published: ['s1', 'm1'], failed: [] });
  assert.equal(calls.mail.length, 0);
  assert.equal(calls.pull, 1);
  assert.equal(calls.pr.length, 1);
});

test('upcoming drafts go to prepare and never to publish', async () => {
  const { deps, calls } = fakes();
  await runTuesday(deps);
  assert.deepEqual(calls.prepare, ['d1']);
  assert.deepEqual(calls.publish, ['s1', 'm1']);
});

test('no PR is opened when nothing changed', async () => {
  const { deps, calls } = fakes({ changed: [], plan: { stale: [], missing: [], upcoming: [] } });
  await runTuesday(deps);
  assert.equal(calls.pr.length, 0);
  assert.equal(calls.mail.length, 0);
});

test('a throw mails once and rethrows', async () => {
  const { deps, calls } = fakes({ deps: { plan: () => { throw new Error('git fell over'); } } });
  await assert.rejects(runTuesday(deps), /git fell over/);
  assert.equal(calls.mail.length, 1);
  assert.match(calls.mail[0].text, /git fell over/);
});

test('one failure does not stop later essays', async () => {
  const { deps, calls } = fakes({ failPrepare: 'd1' });
  const r = await runTuesday(deps);
  assert.deepEqual(r.failed, ['d1']);
  assert.deepEqual(r.published, ['s1', 'm1']);
  assert.equal(calls.mail.length, 1);
});

test('pickBranch suffixes the time only when the remote branch exists', () => {
  assert.equal(pickBranch('2026-10-27', () => false, '1905'), 'audio-2026-10-27');
  assert.equal(pickBranch('2026-10-27', (b) => b === 'audio-2026-10-27', '1905'), 'audio-2026-10-27-1905');
});

test('a sendMail failure does not mask the original error', async () => {
  const { deps } = fakes({ deps: { plan: () => { throw new Error('git fell over'); }, sendMail: () => { throw new Error('smtp down'); } } });
  await assert.rejects(runTuesday(deps), /git fell over/);
});

test('a sendMail failure on the failed path still returns the result', async () => {
  const { deps } = fakes({ failPublish: 's1', deps: { sendMail: () => { throw new Error('smtp down'); } } });
  const r = await runTuesday(deps);
  assert.deepEqual(r.failed, ['s1']);
});
