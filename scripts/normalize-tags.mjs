#!/usr/bin/env node
/* Normalise article tags toward a canonical taxonomy (docs/plans/SEO-Plan.md 2.5,
 * docs/plans/DISTRIBUTION-Plan.md 2.3).
 *
 * The problem: the 57 articles carry ~20 tags, but four of them are on the
 * overwhelming majority — cfo (43), strategy (40), leadership (39),
 * teams (38) — while a long tail (ipo, culture, execution, ask-warren…)
 * appears once. A tag on three-quarters of the corpus is a label, not a
 * topic: it can't power a useful tag page and it makes the related-insights
 * footer close to random.
 *
 * What this script does (mechanical, safe):
 *   - consolidates synonyms/near-duplicates via MAPPING
 *   - reports the tag distribution before and after
 *   - flags articles that would end up with too few distinct tags
 *
 * What it deliberately does NOT do: invent new differentiating tags. Deciding
 * that a given essay is *really* about "capital-allocation" vs "forecasting"
 * is editorial judgement that needs a human reading the piece. This script
 * gets the mechanical 80% done and shows you exactly which articles still
 * need a human pass.
 *
 * DRY-RUN BY DEFAULT. It prints a diff and writes nothing. Pass --write only
 * after you've read the diff and agree with it.
 *
 * Usage:
 *   node scripts/normalize-tags.mjs            # dry-run: report + proposed diff
 *   node scripts/normalize-tags.mjs --write    # apply the mapping in place
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'src/content/insights');
const WRITE = process.argv.includes('--write');

/* ---- proposed canonical taxonomy ----
 * Edit this to taste before running --write. The right-hand side is the
 * canonical tag; the left is what maps into it. A value of null DROPS the
 * tag (use for the over-broad "subject matter" tags that describe the whole
 * site rather than an individual piece — but only drop them once each
 * affected article has at least one specific tag left, which the report
 * below will tell you). */
const MAPPING = {
  // --- consolidations (synonyms / near-duplicates) ---
  'fp-and-a': 'fp-and-a',
  'capital-markets': 'capital-markets',
  ipo: 'capital-markets',
  buffett: 'buffett',
  'ask-warren': 'buffett',
  'cost-structure': 'ai-economics',
  finance: 'finance-craft',
  execution: 'execution',
  culture: 'culture',
  reflections: 'reflections',
  risk: 'risk',
  ai: 'ai',

  // --- the over-broad four: keep for now, flagged in the report ---
  // Set these to null once you've confirmed (from the report) that dropping
  // them won't leave an article tagless. Left as identity by default so
  // --write is safe out of the box.
  cfo: 'cfo',
  strategy: 'strategy',
  leadership: 'leadership',
  teams: 'teams',
};

const OVER_BROAD = new Set(['cfo', 'strategy', 'leadership', 'teams']);

// ---- parse + rewrite ----

function extractTags(fm) {
  const line = fm.split('\n').find((l) => l.trim().startsWith('tags:'));
  if (!line) return null;
  return line
    .slice(line.indexOf('tags:') + 5)
    .replace(/[[\]"]/g, '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function mapTags(tags) {
  const out = [];
  for (const t of tags) {
    const mapped = t in MAPPING ? MAPPING[t] : t;
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.md'));
const before = {};
const after = {};
const changes = [];
const thin = []; // articles left with < 2 non-over-broad tags

for (const file of files) {
  const path = resolve(DIR, file);
  const raw = readFileSync(path, 'utf8');
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) continue;
  const tags = extractTags(fmMatch[1]);
  if (!tags) continue;

  const mapped = mapTags(tags);
  tags.forEach((t) => (before[t] = (before[t] ?? 0) + 1));
  mapped.forEach((t) => (after[t] = (after[t] ?? 0) + 1));

  const specific = mapped.filter((t) => !OVER_BROAD.has(t));
  if (specific.length < 2) thin.push(`${file.replace('.md', '')}  [${mapped.join(', ')}]`);

  if (JSON.stringify(tags) !== JSON.stringify(mapped)) {
    changes.push({ file, from: tags, to: mapped, path, raw, fm: fmMatch[0] });
  }
}

// ---- report ----

const dist = (obj) =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `  ${String(n).padStart(3)}  ${t}`)
    .join('\n');

console.log('TAG DISTRIBUTION — before:\n' + dist(before));
console.log('\nTAG DISTRIBUTION — after mapping:\n' + dist(after));

console.log(`\n${changes.length} article(s) would change tags:`);
for (const c of changes) {
  console.log(`  ${c.file.replace('.md', '')}`);
  console.log(`    - ${c.from.join(', ')}`);
  console.log(`    + ${c.to.join(', ')}`);
}

if (thin.length) {
  console.log(
    `\n⚠  ${thin.length} article(s) have fewer than 2 specific (non-over-broad) tags.`,
  );
  console.log('   These need a human to add a differentiating tag before you');
  console.log('   drop cfo/strategy/leadership/teams. Read the piece, pick a topic:');
  thin.forEach((t) => console.log(`     ${t}`));
}

// ---- write ----

if (!WRITE) {
  console.log('\nDRY-RUN. Nothing written. Re-run with --write to apply.');
  process.exit(0);
}

let written = 0;
for (const c of changes) {
  const tagLine = `tags: [${c.to.map((t) => `"${t}"`).join(', ')}]`;
  const newFm = c.fm.replace(/tags:.*$/m, tagLine);
  writeFileSync(c.path, c.raw.replace(c.fm, newFm), 'utf8');
  written++;
}
console.log(`\nWrote ${written} file(s). Review with \`git diff\` before committing.`);
