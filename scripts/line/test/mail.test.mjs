import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseReply, classify, buildMime, buildSearchNeedle, findReply } from '../mail.mjs';

const raw = fs.readFileSync(new URL('./fixtures/reply-ok.eml', import.meta.url), 'utf8');
const rawWrapped = fs.readFileSync(new URL('./fixtures/reply-ok-wrapped.eml', import.meta.url), 'utf8');

test('parseReply extracts the plain-text reply above the quote and decodes QP', () => {
  const r = parseReply(raw);
  assert.equal(r.headers['in-reply-to'], '<line-abc123-1788961685@signal-to-noise.co>');
  assert.equal(r.text, 'Publish, but change the second heading to “Two clocks”.');
});

test('parseReply cuts a hard-wrapped "On ... wrote:" attribution line spanning a line break', () => {
  const r = parseReply(rawWrapped);
  assert.equal(r.text, 'ok');
  assert.equal(classify(r.text), 'ok');
});

test('classify recognises the keywords and treats anything else as text', () => {
  assert.equal(classify('ok'), 'ok');
  assert.equal(classify(' Publish '), 'publish');
  assert.equal(classify('HOLD'), 'hold');
  assert.equal(classify('no'), 'no');
  assert.equal(classify('Publish, but change the heading'), 'text');
});

test('buildMime sets Reply-To to the alias and embeds an attachment', () => {
  const mime = buildMime({
    from: 'a@x.co', to: 'b@y.com', replyTo: 'essay-line@x.co', subject: 'S', messageId: '<m@x.co>',
    text: 'hello', attachments: [{ name: 'c.webp', type: 'image/webp', data: Buffer.from('xyz') }],
  });
  assert.match(mime, /^Reply-To: essay-line@x\.co$/m);
  assert.match(mime, /Content-Disposition: attachment; filename="c\.webp"/);
  assert.match(mime, /eHl6/); // base64 of xyz
});

test('buildSearchNeedle derives [S2N <token>] or passes subjectNeedle through verbatim', () => {
  assert.equal(buildSearchNeedle({ token: 'abc123' }), '[S2N abc123]');
  assert.equal(buildSearchNeedle({ subjectNeedle: 'essay-line test 2' }), 'essay-line test 2');
});

test('findReply throws when neither token nor subjectNeedle is given, with no network call', () => {
  assert.throws(() => findReply({}), /findReply needs token or subjectNeedle/);
});
