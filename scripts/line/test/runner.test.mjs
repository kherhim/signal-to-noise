// scripts/line/test/runner.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.LINE_STAGING = fs.mkdtempSync(path.join(os.tmpdir(), 'line-runner-'));
const { loadState, saveState } = await import('../state.mjs');
const { nextAction, advance, tick, isoWeek } = await import('../runner.mjs');

const cfg = { veto_hour_local: 19, final_hour_local: 18, publish_hour_uk: 8 };
const at = (s) => new Date(s);
const day = (d) => d.toISOString().slice(0, 10);

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

test('paused: advance returns \'paused\' and tick takes no actions', async () => {
  const slug = 'paused-slug';
  saveState(slug, { stage: 'approved', title: 'T' });
  const advanceDeps = { paused: () => true, runDraft: () => { throw new Error('must not run'); }, sendMail: () => {} };
  assert.equal(advance(slug, at('2026-09-14T20:00:00Z'), { deps: advanceDeps }), 'paused');

  const tickDeps = {
    paused: () => true,
    listEssays: () => [{ slug }],
    scan: () => { throw new Error('must not scan'); },
    runBrief: () => { throw new Error('must not brief'); },
    sendMail: () => {},
  };
  const took = await tick({ now: new Date(2026, 8, 14, 9, 0), deps: tickDeps });
  assert.deepEqual(took, []);
});

test('isoWeek stamps the ISO year and week', () => {
  assert.equal(isoWeek(new Date(2026, 8, 14)), '2026-W38');
});

test('a dry tick on Monday 06:00 calls neither the scanner nor the brief', async () => {
  const called = [];
  const deps = {
    paused: () => false,
    scan: () => { called.push('scan'); }, runBrief: () => { called.push('brief'); },
    listEssays: () => [], boardDate: () => null, sendMail: () => {},
  };
  await tick({ now: new Date(2026, 8, 14, 6, 0), dry: true, deps });
  assert.deepEqual(called, []);
});

test('a missed Monday wake still briefs, once, and not twice in the same ISO week', async () => {
  const now = new Date(2026, 8, 14, 9, 0); // Monday 09:00, brief_hour_local is 06:00
  const briefs = [];
  const base = {
    paused: () => false,
    scan: () => {}, runBrief: () => { briefs.push(1); return null; }, boardDate: () => day(now),
    sendMail: () => {}, loadState: (slug) => ({ slug, stage: 'published' }),
  };
  await tick({ now, deps: { ...base, listEssays: () => [] } });
  assert.equal(briefs.length, 1);

  const thisWeek = { slug: 'x', stage: 'briefed', brief_sent_at: new Date(2026, 8, 14, 6, 0).toISOString() };
  await tick({ now, deps: { ...base, listEssays: () => [thisWeek] } });
  assert.equal(briefs.length, 1, 'a brief already sent this ISO week suppresses a second one');
});

test('check-veto: a hold reply parks the essay and is not re-applied once marked seen', () => {
  const slug = 'veto-hold';
  saveState(slug, { stage: 'briefed', title: 'T', brief_token: 't1', veto_deadline: '2026-09-14T18:00:00.000Z' });
  const deps = { paused: () => false, findReply: () => ({ verdict: 'hold', text: 'hold', date: 'D', from: 'F', key: 'k1' }), sendMail: () => {} };
  advance(slug, at('2026-09-14T19:00:00Z'), { deps });
  assert.equal(loadState(slug).hold, true);
  assert.equal(loadState(slug).brief_reply_seen, 'k1');

  saveState(slug, { hold: false }); // the owner clears the hold by hand
  advance(slug, at('2026-09-14T19:05:00Z'), { deps });
  assert.equal(loadState(slug).hold, false, 'the consumed reply must not park the essay again');
});

test('check-veto: a text reply parks the essay and notifies the owner once', () => {
  const slug = 'veto-text';
  saveState(slug, { stage: 'briefed', title: 'T', brief_token: 't2', veto_deadline: '2026-09-14T18:00:00.000Z' });
  const mail = [];
  const deps = {
    paused: () => false,
    findReply: () => ({ verdict: 'text', text: 'Narrow it to one bank.', date: 'D', from: 'F', key: 'k2' }),
    sendMail: (m) => { mail.push(m); },
  };
  advance(slug, at('2026-09-14T19:00:00Z'), { deps });
  const st = loadState(slug);
  assert.equal(st.hold, true);
  assert.equal(st.veto, 'Narrow it to one bank.');
  assert.equal(st.brief_reply_seen, 'k2');
  assert.equal(mail.length, 1);
  assert.match(mail[0].text, /the essay is parked/);
});

test('check-veto: silence means go', () => {
  const slug = 'veto-silent';
  saveState(slug, { stage: 'briefed', title: 'T', brief_token: 't3', veto_deadline: '2026-09-14T18:00:00.000Z' });
  advance(slug, at('2026-09-14T19:00:00Z'), { deps: { paused: () => false, findReply: () => null, sendMail: () => {} } });
  assert.equal(loadState(slug).stage, 'approved');
});

test('check-final: silence holds, "ok" only nudges, "publish" ships', () => {
  const slug = 'final-reply';
  const base = { stage: 'final-sent', approved: false, title: 'T', publish_not_before: '2026-09-16T07:00:00.000Z' };
  saveState(slug, base);
  const when = at('2026-09-15T20:00:00Z');

  advance(slug, when, { deps: { paused: () => false, readFinalReply: () => null, sendMail: () => {} } });
  assert.equal(loadState(slug).approved, false);

  const mail = [];
  advance(slug, when, { deps: { paused: () => false, readFinalReply: () => ({ verdict: 'ok', text: 'ok', date: 'D', from: 'F', key: 'o1' }), sendMail: (m) => { mail.push(m); } } });
  assert.equal(loadState(slug).approved, false, '"ok" is not approval');
  assert.equal(loadState(slug).final_reply_seen, 'o1');
  assert.equal(mail.length, 1);
  assert.match(mail[0].text, /Reply 'publish' to ship/);

  advance(slug, when, { deps: { paused: () => false, readFinalReply: () => ({ verdict: 'publish', text: 'publish', date: 'D', from: 'F', key: 'p1' }), sendMail: () => {} } });
  assert.equal(loadState(slug).approved, true);
});

test('three failures at the same action park the essay, with two notifications', () => {
  const slug = 'retry-cap';
  saveState(slug, { stage: 'final-sent', approved: true, title: 'T', publish_not_before: '2026-09-16T07:00:00.000Z' });
  const mail = [];
  const deps = { paused: () => false, publish: () => { throw new Error('rsync refused'); }, sendMail: (m) => { mail.push(m); } };
  for (let i = 0; i < 3; i++) advance(slug, at('2026-09-16T08:00:00Z'), { deps });
  const st = loadState(slug);
  assert.equal(st.hold, true);
  assert.equal(st.last_error.count, 3);
  assert.ok(st.last_error.notified_at);
  assert.equal(mail.length, 2, 'first failure and the parking, nothing in between');
  assert.match(mail[1].text, /parked after 3 failures at publish/);
});

test('a tick advances at most one essay per wake', async () => {
  saveState('two-a', { stage: 'drafted', title: 'A' });
  saveState('two-b', { stage: 'drafted', title: 'B' });
  const gated = [];
  const deps = {
    paused: () => false,
    listEssays: () => [{ slug: 'two-a' }, { slug: 'two-b' }],
    runGate: () => { gated.push(1); return { verdict: 'pass' }; },
    sendMail: () => {},
  };
  await tick({ now: new Date(2026, 8, 15, 14, 0), deps }); // Tuesday afternoon: no scan, no brief
  assert.equal(gated.length, 1);
});

test('an idle poll (no fresh reply) does not consume the wake: the next essay still advances', async () => {
  const drafted = [];
  const states = {
    'poll-a': { stage: 'final-sent', approved: false, title: 'A', publish_not_before: '2026-09-16T07:00:00.000Z' },
    'poll-b': { stage: 'approved', title: 'B' },
  };
  const deps = {
    paused: () => false,
    listEssays: () => [{ slug: 'poll-a' }, { slug: 'poll-b' }],
    loadState: (slug) => states[slug],
    readFinalReply: () => null,
    runDraft: (slug) => { drafted.push(slug); },
    sendMail: () => {},
  };
  const took = await tick({ now: new Date(2026, 8, 15, 14, 0), deps });
  assert.deepEqual(drafted, ['poll-b']);
  assert.deepEqual(took, [{ slug: 'poll-b', action: 'draft' }]);
});

test('isoWeek at year boundaries', () => {
  assert.equal(isoWeek(new Date(2027, 0, 1)), '2026-W53');
  assert.equal(isoWeek(new Date(2025, 11, 29)), '2026-W01');
  assert.equal(isoWeek(new Date(2024, 11, 30)), '2025-W01');
});

test('check-final: an "ok" reply notifies once even if the same message is seen again', () => {
  const slug = 'final-ok-dedup';
  saveState(slug, { stage: 'final-sent', approved: false, title: 'T', publish_not_before: '2026-09-16T07:00:00.000Z' });
  const mail = [];
  const deps = {
    paused: () => false,
    readFinalReply: () => ({ verdict: 'ok', text: 'ok', date: 'D', from: 'F', key: 'dup1' }),
    sendMail: (m) => { mail.push(m); },
  };
  advance(slug, at('2026-09-15T20:00:00Z'), { deps });
  advance(slug, at('2026-09-15T20:05:00Z'), { deps });
  assert.equal(mail.length, 1, 'the second advance sees the same key and must not re-notify');
});

test('a failure streak resets when the action changes', () => {
  const slug = 'streak-reset';
  saveState(slug, { stage: 'drafted', title: 'T' });
  advance(slug, at('2026-09-16T08:00:00Z'), { deps: { paused: () => false, runGate: () => { throw new Error('gate boom'); }, sendMail: () => {} } });
  assert.equal(loadState(slug).last_error.count, 1);
  assert.equal(loadState(slug).last_error.action, 'gate');

  saveState(slug, { stage: 'gated', gate_verdict: 'pass' });
  advance(slug, at('2026-09-16T08:05:00Z'), { deps: { paused: () => false, makeCover: () => { throw new Error('cover boom'); }, sendMail: () => {} } });
  const st = loadState(slug);
  assert.equal(st.last_error.count, 1, 'a different action does not inherit the previous streak');
  assert.equal(st.last_error.action, 'cover');
});

test('two failures at publish then a success clears last_error', () => {
  const slug = 'streak-clear';
  saveState(slug, { stage: 'final-sent', approved: true, title: 'T', publish_not_before: '2026-09-16T07:00:00.000Z' });
  const failing = { paused: () => false, publish: () => { throw new Error('rsync refused'); }, sendMail: () => {} };
  advance(slug, at('2026-09-16T08:00:00Z'), { deps: failing });
  advance(slug, at('2026-09-16T08:05:00Z'), { deps: failing });
  assert.equal(loadState(slug).last_error.count, 2);

  const okDeps = { paused: () => false, publish: () => ({ url: 'https://x', commit: 'abc' }), sendMail: () => {} };
  advance(slug, at('2026-09-16T08:10:00Z'), { deps: okDeps });
  assert.equal(loadState(slug).last_error, null, 'a clean publish clears the streak');
});

test('a dry tick collects every essay\'s would-be action, not just the first', async () => {
  saveState('dry-a', { stage: 'drafted', title: 'A' });
  saveState('dry-b', { stage: 'drafted', title: 'B' });
  const deps = {
    paused: () => false,
    listEssays: () => [{ slug: 'dry-a' }, { slug: 'dry-b' }],
    sendMail: () => {},
  };
  const took = await tick({ now: new Date(2026, 8, 15, 14, 0), dry: true, deps });
  assert.deepEqual(took, [{ slug: 'dry-a', action: 'gate' }, { slug: 'dry-b', action: 'gate' }]);
});
