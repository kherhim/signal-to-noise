import test from 'node:test';
import assert from 'node:assert/strict';
import { finalEmailText, nextPublishSlot } from '../final.mjs';

test('finalEmailText carries the instructions, the text and the report', () => {
  const t = finalEmailText({ title: 'T', final: '---\ntitle: "T"\n---\n\nBody', report: '# Gate report\n\n## Verdict: PASS' });
  assert.match(t, /Reply "publish" to ship/);
  assert.match(t, /No reply means hold/);
  assert.ok(t.indexOf('Body') < t.indexOf('# Gate report'));
});

test('nextPublishSlot returns today when it is Wednesday and the hour has not passed', () => {
  const now = new Date(2026, 8, 9, 7, 30); // Wed 9 Sep 2026, 07:30 local
  const slot = nextPublishSlot(now, 8);
  assert.equal(slot.getFullYear(), 2026);
  assert.equal(slot.getMonth(), 8);
  assert.equal(slot.getDate(), 9);
  assert.equal(slot.getHours(), 8);
  assert.equal(slot.getMinutes(), 0);
});

test('nextPublishSlot rolls to next Wednesday when it is Wednesday but the hour has passed', () => {
  const now = new Date(2026, 8, 9, 9, 0); // Wed 9 Sep 2026, 09:00 local — past the 08:00 slot
  const slot = nextPublishSlot(now, 8);
  assert.equal(slot.getDate(), 16); // next Wednesday
  assert.equal(slot.getHours(), 8);
});

test('nextPublishSlot rolls to next Wednesday from any other day', () => {
  const mon = new Date(2026, 8, 7, 12, 0); // Mon 7 Sep 2026
  const slotFromMon = nextPublishSlot(mon, 8);
  assert.equal(slotFromMon.getDate(), 9);
  assert.equal(slotFromMon.getHours(), 8);

  const thu = new Date(2026, 8, 10, 12, 0); // Thu 10 Sep 2026
  const slotFromThu = nextPublishSlot(thu, 8);
  assert.equal(slotFromThu.getDate(), 16);
});
