import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedQuarter, missingCompanies, planIssue } from '../hyperscalers-reminder.mjs';

test('expectedQuarter', () => {
  assert.equal(expectedQuarter(new Date('2026-11-01T09:00:00Z')), 'Q3 2026');
  assert.equal(expectedQuarter(new Date('2027-02-01T09:00:00Z')), 'Q4 2026');
  assert.equal(expectedQuarter(new Date('2026-05-01T09:00:00Z')), 'Q1 2026');
  assert.equal(expectedQuarter(new Date('2026-08-01T09:00:00Z')), 'Q2 2026');
});

const co = (name, ...qs) => ({ name, quarters: qs.map((q) => ({ q })) });
const NOW = new Date('2026-11-01T09:00:00Z');

test('missingCompanies lists those behind', () => {
  const data = { companies: [
    co('Alphabet', 'Q1 2026', 'Q2 2026'), co('Microsoft', 'Q2 2026'), co('Amazon', 'Q2 2026'),
    co('Meta', 'Q2 2026', 'Q3 2026'), co('Oracle', 'Q3 2026'),
  ] };
  assert.deepEqual(missingCompanies(data, NOW), ['Alphabet', 'Microsoft', 'Amazon']);
});

test('missingCompanies empty when all current, and year boundary compares numerically', () => {
  const all = { companies: [co('A', 'Q3 2026'), co('B', 'Q4 2025', 'Q3 2026')] };
  assert.deepEqual(missingCompanies(all, NOW), []);
  const feb = new Date('2027-02-01T09:00:00Z');
  assert.deepEqual(missingCompanies({ companies: [co('A', 'Q1 2026', 'Q3 2026')] }, feb), ['A']);
});

test('planIssue: none when nothing missing', () => {
  assert.equal(planIssue({ missing: [], quarter: 'Q3 2026', openIssues: [] }).action, 'none');
});

test('planIssue: open when no matching open issue', () => {
  const p = planIssue({ missing: ['Alphabet', 'Meta'], quarter: 'Q3 2026', openIssues: [{ number: 3, title: 'Other' }] });
  assert.equal(p.action, 'open');
  assert.equal(p.title, 'Hyperscaler tracker: Q3 2026 results to add');
  assert.match(p.body, /Alphabet/);
  assert.match(p.body, /Meta/);
  assert.match(p.body, /https:\/\/github\.com\/kherhim\/signal-to-noise\/blob\/main\/src\/data\/hyperscalers\/quarters\.json/);
  assert.equal(p.number, undefined);
});

test('planIssue: comment on the open issue with the exact title', () => {
  const title = 'Hyperscaler tracker: Q3 2026 results to add';
  const p = planIssue({ missing: ['Oracle'], quarter: 'Q3 2026', openIssues: [{ number: 7, title: 'x' }, { number: 9, title }] });
  assert.equal(p.action, 'comment');
  assert.equal(p.number, 9);
  assert.match(p.body, /Oracle/);
});

test('body style: no em dashes, no ledger', () => {
  const p = planIssue({ missing: ['Alphabet'], quarter: 'Q3 2026', openIssues: [] });
  assert.ok(!p.body.includes('—'));
  assert.ok(!/ledger/i.test(p.body + p.title));
});
