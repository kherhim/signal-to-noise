import test from 'node:test';
import assert from 'node:assert/strict';
import { scanBrE, scanAmbiguous, applySpellingFixes } from '../bre.mjs';

test('scanBrE flags American forms with line numbers and suggests fixes', () => {
  const f = scanBrE('Line one.\nThe behavior of the program is gray.\nWe optimize and analyze.');
  assert.deepEqual(f.map((x) => [x.word, x.line, x.fix]), [
    ['behavior', 2, 'behaviour'], ['gray', 2, 'grey'], ['optimize', 3, 'optimise'], ['analyze', 3, 'analyse'],
  ]);
});

test('scanBrE ignores allowlisted words and code/URLs', () => {
  assert.deepEqual(scanBrE('We learned the terms at https://x.com/color?theme=center and used `color: red`.'), []);
});

test('applySpellingFixes replaces only whole words, preserving case', () => {
  const r = applySpellingFixes('Behavior matters; behavior always did.');
  assert.equal(r.text, 'Behaviour matters; behaviour always did.');
  assert.deepEqual(r.fixed, ['Behavior', 'behavior']);
});

test('scanBrE and applySpellingFixes only touch unprotected text around a bare URL', () => {
  const line = 'See https://example.com/color for the color scheme.';
  const f = scanBrE(line);
  assert.deepEqual(f.map((x) => [x.word, x.line, x.fix]), [['color', 1, 'colour']]);
  const r = applySpellingFixes(line);
  assert.equal(r.text, 'See https://example.com/color for the colour scheme.');
});

test('applySpellingFixes fixes markdown link text but leaves the destination untouched', () => {
  const r = applySpellingFixes('Read the [color guide](https://x.com/color) now.');
  assert.equal(r.text, 'Read the [colour guide](https://x.com/color) now.');
});

test('applySpellingFixes preserves ALL-CAPS', () => {
  const r = applySpellingFixes('THE COLOR OF MONEY');
  assert.equal(r.text, 'THE COLOUR OF MONEY');
});

test('scanAmbiguous flags ambiguous words as warnings, never auto-fixed', () => {
  const text = 'The program crashed; the water meter read 5.';
  const a = scanAmbiguous(text);
  assert.deepEqual(a.map((x) => [x.word, x.line]), [['program', 1], ['meter', 1]]);
  assert.ok(a.every((x) => typeof x.note === 'string' && x.note.length > 0));
  assert.deepEqual(scanBrE(text), []);
  assert.equal(applySpellingFixes(text).text, text);
});

test('house style: "learned" is never flagged or warned', () => {
  assert.deepEqual(scanBrE('We learned a lot.'), []);
  assert.deepEqual(scanAmbiguous('We learned a lot.'), []);
});
