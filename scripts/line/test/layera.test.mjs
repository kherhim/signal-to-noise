import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectText, cleanText, inspectFile, cleanFile, serviceUp, plausibleClean, summariseFindings } from '../layera.mjs';

const kinds = (r) => r.findings.map((f) => f.kind);

test('each invisible carrier is found and removed', () => {
  const cases = [
    ['a​b', 'zero-width'], ['a⁠b', 'zero-width'], ['a﻿b', 'zero-width'],
    ['a‮b', 'bidi'], ['a⁦b', 'bidi'], ['a­b', 'soft-hyphen'],
    ['a\u{E0041}b', 'tag'], ['a᠎b', 'mvs'], ['a️b', 'variation-selector'],
    ['a‍b', 'zero-width'],
  ];
  for (const [input, kind] of cases) {
    assert.deepEqual(kinds(inspectText(input)), [kind], input);
    const c = cleanText(input);
    assert.equal(c.text, 'ab', input);
    assert.equal(c.removed, 1, input);
  }
});

test('odd spaces become plain spaces', () => {
  for (const sp of [' ', ' ', ' ', ' ', ' ', '　']) {
    const c = cleanText(`a${sp}b`);
    assert.equal(c.text, 'a b');
    assert.equal(c.replaced, 1);
    assert.deepEqual(kinds(c), ['odd-space']);
  }
});

test('Cyrillic or Greek look-alikes inside a Latin word become Latin', () => {
  const c = cleanText('the pаyment and cοst');
  assert.equal(c.text, 'the payment and cost');
  assert.equal(c.replaced, 2);
  assert.deepEqual(kinds(c), ['homoglyph', 'homoglyph']);
});

test('words written wholly in Cyrillic or Greek are left alone', () => {
  for (const s of ['сор', 'Москва', 'λόγος']) assert.equal(cleanText(s).text, s);
});

test('emoji sequences, keycaps and ordinary typography survive', () => {
  const keep = '👨‍👩‍👧 👉 ⚠️ 1️⃣ ❤️‍🔥 £20 café “quoted” – … 🙂';
  const r = inspectText(keep);
  assert.equal(r.suspicious, false, JSON.stringify(r.findings));
  assert.equal(cleanText(keep).text, keep);
});

test('a BOM at offset 0 is left alone', () => {
  assert.equal(inspectText('﻿hello').suspicious, false);
});

test('AI frontmatter keys go; other keys, their values and order stay', () => {
  const md = '---\ntitle: "Claude and OpenAI, compared"\ngenerator: "some tool"\nai_model: x\nexcerpt: "An Anthropic story"\nprompt: |\n  write me\n  an essay\ntags: ["ai"]\n---\n\nBody.\n';
  const c = cleanText(md);
  assert.equal(c.text, '---\ntitle: "Claude and OpenAI, compared"\nexcerpt: "An Anthropic story"\ntags: ["ai"]\n---\n\nBody.\n');
  assert.deepEqual(kinds(c), ['ai-frontmatter', 'ai-frontmatter', 'ai-frontmatter']);
  assert.equal(c.removed, 3);
});

test('data URIs are stripped, alt text kept', () => {
  const c = cleanText('See ![chart](data:image/png;base64,AAAA) and <img src="data:image/gif;base64,R0">.');
  assert.equal(c.text, 'See chart and <img src="">.');
  assert.deepEqual(kinds(c), ['data-uri', 'data-uri']);
});

test('findings carry line numbers and a summary', () => {
  const r = inspectText('one\ntw​o\nthree‮​');
  assert.deepEqual(r.findings.map((f) => f.line), [2, 3, 3]);
  assert.equal(r.findings[0].codepoint, 'U+200B');
  assert.equal(summariseFindings(r.findings), '2 zero-width, 1 bidi');
  assert.equal(summariseFindings([]), '');
});

test('inspectFile / cleanFile work on a file and clean in place', () => {
  const tmp = path.join(os.tmpdir(), `layera-${Date.now()}.md`);
  fs.writeFileSync(tmp, 'Clean text​ with a zero-width space.\n');
  try {
    assert.equal(inspectFile(tmp).suspicious, true);
    const c = cleanFile(tmp);
    assert.equal(c.changed, true);
    assert.equal(c.report.removed, 1);
    assert.equal(fs.readFileSync(tmp, 'utf8'), 'Clean text with a zero-width space.\n');
    assert.equal(inspectFile(tmp).suspicious, false);
    assert.equal(cleanFile(tmp).changed, false);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

test('serviceUp is an in-repo self-check and passes', () => {
  assert.equal(serviceUp(), true);
});

test('plausibleClean rejects empty or heavily shortened output', () => {
  assert.equal(plausibleClean(1000, 998), true);
  assert.equal(plausibleClean(1000, 0), false);
  assert.equal(plausibleClean(1000, 500), false);
});
