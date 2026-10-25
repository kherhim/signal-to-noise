// scripts/line/test/figures.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFacts, compareFacts, renderFacts } from '../figures.mjs';

const keys = (t) => extractFacts(t).flatMap((s) => s.figures.map((f) => f.key));
const kinds = (a, b) => compareFacts(a, b).map((f) => f.kind);

test('normalises currency, scale, unit and ranges', () => {
  assert.deepEqual(keys('Capex of $135 to $145 billion, up 26% since 2004.'), ['$135000000000', '$145000000000', '26%', '2004']);
  assert.deepEqual(keys('Revenue of $24.8bn on 1,500 staff.'), keys('Revenue of $24.8 billion on 1500 staff.'));
  assert.deepEqual(keys('A margin of 12 per cent.'), keys('A margin of 12%.'));
  assert.deepEqual(keys('A range of £20–30m.'), ['£20000000', '£30000000']);
  assert.deepEqual(keys('Two-thirds of three lenders, in Q3.'), ['2/3', '3', 'Q3']);
});

test('ignores digits in link targets, footnotes and list markers', () => {
  assert.deepEqual(keys('1. See [the filing](https://example.com/2024/10-k)[^3] for 40bps.'), ['40bps']);
});

test('catches raised becoming reduced (24 Oct 2026)', () => {
  const f = compareFacts('Northwind raised the bottom of its capital budget.', 'Northwind reduced its capital budget range.');
  assert.deepEqual(f.map((x) => x.kind), ['direction-flip']);
  assert.match(f[0].detail, /raised.*reduced/);
});

test('catches a dropped figure', () => {
  const f = compareFacts('Sales rose 8% to $3.2bn in the year.', 'Sales climbed during the year to $3.2bn.');
  assert.deepEqual(f.map((x) => x.kind), ['figure-missing']);
  assert.match(f[0].detail, /8%/);
});

test('catches a changed figure as one missing and one added', () => {
  const f = kinds('Operating profit was $19.1bn.', 'Operating profit came to $19.4bn.');
  assert.deepEqual(f.sort(), ['figure-added', 'figure-missing']);
});

test('"bn" and "billion" are the same figure', () => {
  assert.deepEqual(kinds('Fabrikam spent $24.8bn and kept 1,500 staff.', 'Fabrikam laid out $24.8 billion and retained 1500 staff.'), []);
});

test('reordered clauses with the same figures pass', () => {
  assert.deepEqual(kinds(
    'Deposits rose 4% in 2025 while lending fell 2%.',
    'Lending fell 2% in 2025, while deposits rose 4%.'), []);
});

test('a pure synonym rewrite passes', () => {
  const draft = 'Contoso increased its dividend by 10% in 2024. Costs fell, and margins widened to 31%.\n\nThe board was not worried.';
  const out = 'Contoso lifted its dividend by 10% in 2024. Expenses dropped, and margins widened to 31%.\n\nThe directors were not concerned.';
  assert.deepEqual(kinds(draft, out), []);
});

test('catches opposites on the other axes', () => {
  assert.deepEqual(kinds('The spread widened to 40bps.', 'The spread narrowed to 40bps.'), ['direction-flip']);
  assert.deepEqual(kinds('Litware made a profit of $2m.', 'Litware made a loss of $2m.'), ['direction-flip']);
  assert.deepEqual(kinds('Shares were up 5% on the day.', 'Shares were down 5% on the day.'), ['direction-flip']);
});

test('spelled figures match their digits', () => {
  assert.deepEqual(kinds('Returns were seventeen per cent in 2025.', 'Returns came to 17% in 2025.'), []);
  assert.deepEqual(kinds('It took twenty-two years.', 'It took 22 years.'), []);
});

test('"up" beside a figure still counts after a contraction', () => {
  assert.deepEqual(kinds("Costs didn't move, but shares weren't flat: they were up 5%.", "Costs didn't move, but shares weren't flat: they were down 5%."), ['direction-flip']);
});

test('"up" and "down" as particles do not count', () => {
  assert.deepEqual(kinds('They set up a fund of $5m.', 'They broke down a fund of $5m.'), []);
});

test('catches negation appearing or vanishing beside a figure', () => {
  assert.deepEqual(kinds('The bank did not hit its 15% target.', 'The bank hit its 15% target.'), ['negation']);
  assert.deepEqual(kinds('The bank met its 15% target.', 'The bank never met its 15% target.'), ['negation']);
});

test('joined and split sentences keep their facts', () => {
  assert.deepEqual(kinds(
    'Revenue rose 6% to $4bn. Costs fell 3%. The CFO was pleased.',
    'Revenue grew 6% to $4bn and costs dropped 3%. The finance chief was pleased.'), []);
});

test('renderFacts covers every state', () => {
  assert.equal(renderFacts(undefined), 'not reached');
  assert.match(renderFacts({ skipped: true, findings: [] }), /skipped/);
  assert.match(renderFacts({ findings: [] }), /survives/);
  assert.match(renderFacts({ findings: [{ kind: 'figure-missing', field: 'excerpt', draft: 'x', output: null, detail: '"8%" gone' }] }), /figure-missing \[excerpt\]: "8%" gone/);
});
