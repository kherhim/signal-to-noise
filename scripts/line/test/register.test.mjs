import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRegister, scanRegister, measureRates, ownerTexts, lineTexts, lineSlugs, lineFile, inflect, topFormal, OWNER_MAX, REGISTER } from '../register.mjs';

const PAIRS = [
  { formal: 'expenditure', plain: 'spending', owner_per_1k: 0, line_per_1k: 1, source: 'seed', except: ['capital expenditure'] },
  { formal: 'acquire', plain: 'buy', owner_per_1k: 0, line_per_1k: 1, source: 'seed' },
  { formal: 'prior to', plain: 'before', owner_per_1k: 0, line_per_1k: 1, source: 'seed' },
  { formal: 'respond to', plain: 'move with', owner_per_1k: 0, line_per_1k: 1, source: 'seed' },
];

test('the data file keeps the contract shape', () => {
  const r = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  assert.match(r.updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(typeof r.note, 'string');
  assert.ok(r.pairs.length >= 30);
  for (const p of r.pairs) {
    assert.equal(p.formal, p.formal.toLowerCase());
    assert.equal(typeof p.plain, 'string');
    assert.equal(typeof p.owner_per_1k, 'number');
    assert.equal(typeof p.line_per_1k, 'number');
    assert.ok(['seed', 'learned'].includes(p.source));
  }
});

test('inflections come from a small stem rule', () => {
  const f = inflect('acquire');
  for (const w of ['acquire', 'acquires', 'acquired', 'acquiring']) assert.ok(f.includes(w), w);
  assert.ok(inflect('modify').includes('modified'));
});

test('the scanner finds formal stand-ins and names the plain word', () => {
  const hits = scanRegister('The firm acquired a rival last year. Prices Respond to rates. Expenditure has become excessive.', PAIRS);
  assert.deepEqual(hits.map((h) => h.formal), ['acquire', 'respond to', 'expenditure']);
  assert.equal(hits[0].plain, 'buy');
  assert.equal(hits[0].sentence, 'The firm acquired a rival last year.');
  assert.equal(hits[1].sentence, 'Prices Respond to rates.');
});

test('the scanner matches whole words only', () => {
  assert.equal(scanRegister('The acquirer paid cash. Expenditures-to-date rose.', PAIRS.slice(0, 2)).length, 0);
});

test('the scanner ignores quotations and terms of art', () => {
  const text = 'Capital expenditure rose by a third. The chief executive said "we expect to acquire more capacity next year".\n\n> Total expenditure was flat.\n';
  assert.deepEqual(scanRegister(text, PAIRS), []);
});

test('measureRates counts per 1,000 words, honouring exceptions', () => {
  const words = Array(98).fill('word').join(' ');
  const r = measureRates([`${words} acquired expenditure`, `---\ntitle: acquired\n---\n${words} capital expenditure`], PAIRS);
  assert.ok(Math.abs(r.acquire - 5) < 0.01);
  assert.ok(Math.abs(r.expenditure - 5) < 0.01);
  assert.equal(r['prior to'], 0);
});

test('owner-rate guard: no kept pair flags the owner\'s own voice', () => {
  const reg = loadRegister();
  const rates = measureRates(ownerTexts(), reg.pairs);
  const over = reg.pairs.filter((p) => rates[p.formal] > OWNER_MAX).map((p) => `${p.formal} ${rates[p.formal].toFixed(2)}`);
  assert.deepEqual(over, []);
});

test('line output is optional: a missing _sources gives no texts', () => {
  assert.deepEqual(lineTexts(path.join(os.tmpdir(), 'no-such-sources-dir')), []);
});

test('topFormal puts the most line-prone words first', () => {
  const reg = { pairs: [{ formal: 'a', line_per_1k: 0.1 }, { formal: 'b', line_per_1k: 0.9 }] };
  assert.deepEqual(topFormal(reg, 1), ['b']);
});

test('line-written slugs: the ledger plus every staging folder', () => {
  const st = fs.mkdtempSync(path.join(os.tmpdir(), 'slugs-'));
  fs.mkdirSync(path.join(st, 'gated-by-hand'));
  fs.writeFileSync(path.join(st, 'loose-file.md'), 'x');
  assert.deepEqual(lineSlugs({ staging: st, ledger: { published: [{ slug: 'from-ledger' }] } }), ['from-ledger', 'gated-by-hand']);
  assert.deepEqual(lineSlugs({ staging: path.join(st, 'absent'), ledger: { published: [{ slug: 'a' }] } }), ['a']);
});

test('line text prefers the newest raw Layer B output over a hand-fixed gated.md', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'linefile-'));
  assert.equal(lineFile(d), null);
  fs.writeFileSync(path.join(d, 'gated.md'), 'fixed');
  assert.equal(path.basename(lineFile(d)), 'gated.md');
  fs.writeFileSync(path.join(d, 'gated.layerb.md'), 'raw');
  fs.utimesSync(path.join(d, 'gated.layerb.md'), 1000, 1000);
  fs.writeFileSync(path.join(d, 'gated.layerb-raw.md'), 'raw2');
  fs.utimesSync(path.join(d, 'gated.layerb-raw.md'), 2000, 2000);
  assert.equal(path.basename(lineFile(d)), 'gated.layerb-raw.md');
});
