import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planWork, publishOne, prepareOne, parseFrontmatter } from '../audio.mjs';
import { narrationScript, scriptHash } from '../../../src/lib/narration.mjs';

const body = 'Opening paragraph here.\n\n## Heading\n\nSecond paragraph.';
const hash = scriptHash(narrationScript(body).items);
const ess = (slug, o = {}) => ({ slug, body, draft: false, date: '2026-01-01', ...o });

test('planWork sorts stale, missing and upcoming; ignores other drafts', () => {
  const essays = [
    ess('fresh'), ess('stale'), ess('missing'),
    ess('draft-tomorrow', { draft: true, date: '2026-10-28' }),
    ess('draft-later', { draft: true, date: '2026-11-30' }),
    ess('draft-with-entry', { draft: true, date: '2026-11-30' }),
  ];
  const all = { fresh: { hash }, stale: { hash: 'old' }, 'draft-with-entry': { hash: 'old' } };
  const plan = planWork(essays, all, '2026-10-27');
  assert.deepEqual(plan, { stale: ['stale'], missing: ['missing'], upcoming: ['draft-tomorrow'] });
});

test('publishOne writes no JSON when upload rejects', async () => {
  const written = [];
  const deps = {
    narrate: async () => ({ hash, path: '/x/a.m4a', duration: 5, chapters: [], peaks: [] }),
    upload: async () => { throw new Error('boom'); },
    writeJson: (s, d) => written.push([s, d]),
  };
  await assert.rejects(publishOne('a', deps), /boom/);
  assert.equal(written.length, 0);
});

test('publishOne names the file slug.hash8.m4a and writes after upload', async () => {
  const order = [];
  const deps = {
    narrate: async () => ({ hash: 'abcdef0123456789', path: '/x/a.m4a', duration: 7, chapters: [['Opening', 0]], peaks: [0.1] }),
    upload: async (p) => order.push(['upload', p]),
    writeJson: (s, d) => order.push(['write', s, d]),
  };
  const data = await publishOne('a', deps);
  assert.equal(data.file, 'a.abcdef01.m4a');
  assert.equal(order[0][0], 'upload');
  assert.equal(order[1][0], 'write');
  assert.equal(order[1][2].file, 'a.abcdef01.m4a');
  assert.equal(order[1][2].hash, 'abcdef0123456789');
});

test('prepareOne narrates and writes locally without uploading', async () => {
  const calls = [];
  const deps = {
    narrate: async () => ({ hash: 'abcdef0123456789', path: '/x/a.m4a', duration: 7, chapters: [], peaks: [] }),
    upload: async () => calls.push('upload'),
    writeJson: () => calls.push('repo'),
    writeLocal: (s, d) => calls.push(['local', d.file]),
  };
  await prepareOne('a', deps);
  assert.deepEqual(calls, [['local', 'a.abcdef01.m4a']]);
});

test('narrate failure skips the essay', async () => {
  const deps = { narrate: async () => null, upload: async () => assert.fail(), writeJson: () => assert.fail() };
  assert.equal(await publishOne('a', deps), null);
});

test('publishOne refuses drafts and never narrates or uploads', async () => {
  const deps = { isDraft: () => true, narrate: async () => assert.fail(), upload: async () => assert.fail(), writeJson: () => assert.fail() };
  await assert.rejects(publishOne('a', deps), /draft/);
});

test('frontmatter tolerates CRLF and trailing comments', () => {
  const raw = '---\r\ntitle: "x"\r\ndate: 2026-10-28 # tomorrow\r\ndraft: true # hold\r\n---\r\n\r\nBody.\r\n';
  const f = parseFrontmatter(raw);
  assert.equal(f.draft, true);
  assert.equal(f.date, '2026-10-28');
  assert.match(f.body, /Body\./);
  assert.equal(parseFrontmatter('---\ndraft: false\n---\nx').draft, false);
});
