import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseReply, classify, buildMime, buildSearchNeedle, findReply, isOwnCopy, senderAllowed, isAutoReply, extractAddress } from '../mail.mjs';

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

test('isOwnCopy flags the automation\'s own sent copy but not a real reply from the same address', () => {
  assert.equal(isOwnCopy({ from: 'Signal to Noise <himanshu@signal-to-noise.co>' }, 'himanshu@signal-to-noise.co'), true);
  assert.equal(isOwnCopy({ from: 'Signal to Noise <himanshu@signal-to-noise.co>', 'in-reply-to': '<x>' }, 'himanshu@signal-to-noise.co'), false);
  assert.equal(isOwnCopy({ from: 'a@gmail.com' }, 'himanshu@signal-to-noise.co'), false);
});

const addrs = { owner: 'owner@example.com', self: 'himanshu@signal-to-noise.co' };

test('senderAllowed admits only the owner or the site address, case-insensitively', () => {
  assert.equal(senderAllowed('The Owner <Owner@Example.com>', addrs), true);
  assert.equal(senderAllowed('Signal to Noise <HIMANSHU@SIGNAL-TO-NOISE.CO>', addrs), true);
  assert.equal(senderAllowed('owner@example.com', addrs), true);
});

test('senderAllowed rejects a stranger, a missing From, a lookalike domain and a spoofed display name', () => {
  assert.equal(senderAllowed('spammer@example.net', addrs), false);
  assert.equal(senderAllowed(null, addrs), false);
  assert.equal(senderAllowed('', addrs), false);
  assert.equal(senderAllowed('owner@example.com.evil.net', addrs), false, 'a suffixed lookalike domain is not the owner');
  assert.equal(senderAllowed('notowner@example.com', addrs), false, 'a prefixed lookalike local part is not the owner');
  assert.equal(senderAllowed('"owner@example.com" <attacker@evil.net>', addrs), false, 'the display name is not the address');
});

test('extractAddress pulls the bare address out of the From formats Zoho and Gmail send', () => {
  assert.equal(extractAddress('The Owner <Owner@Example.com>'), 'owner@example.com');
  assert.equal(extractAddress('owner@example.com'), 'owner@example.com');
  assert.equal(extractAddress('owner@example.com (The Owner)'), 'owner@example.com');
  assert.equal(extractAddress(null), '');
});

test('isAutoReply spots the standard vacation-responder headers', () => {
  assert.equal(isAutoReply({ 'auto-submitted': 'auto-replied' }), true);
  assert.equal(isAutoReply({ 'auto-submitted': 'auto-generated' }), true);
  assert.equal(isAutoReply({ 'x-autoreply': 'yes' }), true);
  assert.equal(isAutoReply({ 'x-autorespond': 'Out of office' }), true);
});

test('isAutoReply lets an ordinary reply through, including auto-submitted: no', () => {
  assert.equal(isAutoReply({}), false);
  assert.equal(isAutoReply({ 'auto-submitted': 'no' }), false);
  assert.equal(isAutoReply({ 'auto-submitted': ' No ' }), false);
  assert.equal(isAutoReply({ from: 'a@b.c', subject: 'Re: x' }), false);
});
