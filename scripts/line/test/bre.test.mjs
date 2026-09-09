import test from 'node:test';
import assert from 'node:assert/strict';
import { scanBrE, applySpellingFixes } from '../bre.mjs';

test('scanBrE flags American forms with line numbers and suggests fixes', () => {
  const f = scanBrE('Line one.\nThe behavior of the program is gray.\nWe optimize and analyze.');
  assert.deepEqual(f.map((x) => [x.word, x.line, x.fix]), [
    ['behavior', 2, 'behaviour'], ['program', 2, 'programme'], ['gray', 2, 'grey'], ['optimize', 3, 'optimise'], ['analyze', 3, 'analyse'],
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
