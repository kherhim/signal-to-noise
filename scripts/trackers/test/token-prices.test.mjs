import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blended, priceOf, newerThanLineup, snapshot, staleOverrides } from '../token-prices.mjs';

const m = (id, input, output, created = 1) => ({ id, name: id, created, pricing: { prompt: String(input / 1e6), completion: String(output / 1e6) } });
const lineup = {
  tiers: ['premium', 'flagship', 'budget'],
  labs: [{ lab: 'Acme', premium: null, flagship: 'acme/big', budget: 'acme/small' }],
  reviewed_out: { 'acme/big-fast': 'speed tier' },
  overrides: { 'acme/small': { input: 0.2, output: 0.8, source: 'https://acme.example/pricing' } },
};

test('blended weights input three to one', () => {
  assert.equal(blended(2, 10), 4);
});

test('priceOf converts per-token to per-million and rejects free or missing prices', () => {
  assert.deepEqual(priceOf(m('a/b', 2, 10)), { id: 'a/b', name: 'a/b', input: 2, output: 10, blended: 4, source: 'openrouter' });
  assert.equal(priceOf(m('a/free', 0, 0)), null);
  assert.equal(priceOf(undefined), null);
});

test('snapshot fills each tier, applies overrides and lists missing ids', () => {
  const s = snapshot([m('acme/big', 2, 10), m('acme/small', 0.01, 0.2)], lineup, 'T');
  const [acme] = s.labs;
  assert.equal(acme.premium, null);
  assert.equal(acme.flagship.blended, 4);
  assert.equal(acme.budget.source, 'https://acme.example/pricing');
  assert.equal(acme.budget.input, 0.2);
  assert.deepEqual(snapshot([m('acme/big', 2, 10)], lineup, 'T').labs[0].missing, ['acme/small']);
});

test('newerThanLineup flags unreviewed newer models only', () => {
  const models = [m('acme/big', 2, 10, 5), m('acme/small', 0.1, 0.4, 5), m('acme/big-fast', 4, 20, 9), m('acme/next', 2, 10, 9), m('acme/old', 1, 1, 1)];
  assert.deepEqual(newerThanLineup(models, lineup), ['Acme: acme/next']);
});

test('staleOverrides reports overrides OpenRouter now matches', () => {
  assert.deepEqual(staleOverrides([m('acme/small', 0.01, 0.2)], lineup), []);
  assert.deepEqual(staleOverrides([m('acme/small', 0.2, 0.8)], lineup), ['acme/small']);
});
