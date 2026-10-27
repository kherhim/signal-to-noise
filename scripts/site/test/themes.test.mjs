import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { THEMES, themeOf, homepagePlan } from '../../../src/lib/themes.mjs';

const post = (id, tags, extra = {}) => ({ id, data: { tags, date: new Date(Date.UTC(2026, 0, 1) - +id.replace(/\D/g, '') * 864e5), ...extra } });

test('themes come in a fixed order with their colours', () => {
  assert.deepEqual(THEMES.map((t) => t.key), ['ai', 'cap', 'fpa', 'lead']);
  assert.deepEqual(THEMES.map((t) => t.color), ['#3F86D0', '#C0822A', '#3FA58C', '#d8d2c4']);
});

test('theme precedence: explicit, series, capital, AI, FP&A, leadership', () => {
  assert.equal(themeOf({ tags: ['ai'], series: { id: 's' } }), 'lead');
  assert.equal(themeOf({ tags: ['buffett', 'ai'] }), 'cap');
  assert.equal(themeOf({ tags: ['ai', 'fp-and-a'] }), 'ai');
  assert.equal(themeOf({ tags: ['budgeting'] }), 'fpa');
  assert.equal(themeOf({ tags: ['teams'] }), 'lead');
  assert.equal(themeOf({ tags: ['something-new'] }), 'lead');
  assert.equal(themeOf({}), 'lead');
  assert.equal(themeOf({ tags: ['ai'], theme: 'fpa' }), 'fpa');
});

test('homepage plan never repeats an essay and caps each row', () => {
  const tagsets = [['ai'], ['buffett'], ['budgeting'], ['teams']];
  const posts = Array.from({ length: 30 }, (_, k) => post(`p${k}`, tagsets[k % 4]));
  const plan = homepagePlan(posts, 'p3');
  assert.equal(plan.lead.id, 'p3');
  const ids = [plan.lead, ...plan.latest, ...plan.rails.flatMap((r) => r.items)].map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(plan.latest.length <= 5);
  assert.ok(plan.rails.every((r) => r.items.length <= 6));
  assert.deepEqual(plan.rails.map((r) => r.theme.key), ['ai', 'cap', 'fpa', 'lead']);
});

test('real essays: series children stay off the homepage, counts match the design', () => {
  const essays = JSON.parse(fs.readFileSync(new URL('./fixtures/essays-2026-10-27.json', import.meta.url)));
  const shown = essays.filter((e) => e.data.series?.part === undefined);
  const count = (k) => shown.filter((e) => themeOf(e.data) === k).length;
  assert.deepEqual([count('ai'), count('cap'), count('fpa'), count('lead')], [26, 8, 7, 14]);
});
