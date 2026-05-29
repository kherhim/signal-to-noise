// scripts/add-series-metadata.mjs
// Adds `series:` block to specified files' frontmatter.
// Idempotent: if a series block already exists on a file, it's left alone.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SERIES_ID = 'leadership-lessons';
const SERIES_NAME = 'Leadership lessons I wish I knew earlier';

const files = [
  // Parent (no `part`)
  { slug: 'leadership-lessons-i-wish-knew-earlier' },
  // Children
  { slug: '1-leadership-sum-your-trade-offs', part: 1 },
  { slug: '2-most-expensive-decision-lets-wait', part: 2 },
  { slug: '3-culture-incentives-posters', part: 3 },
  { slug: '4-cross-functional-trust-superpower', part: 4 },
  { slug: '5-when-kpis-become-strategy-dies', part: 5 },
  { slug: '6-great-leaders-explain-constraints-just', part: 6 },
  { slug: '7-crisis-reveals-people-clearly', part: 7 },
  { slug: '8-biases-sitting-every-boardroom', part: 8 },
  { slug: '9-resilience-optionality-toughness', part: 9 },
  { slug: '10-scaling-stopping-adding', part: 10 },
];

function buildSeriesBlock(part) {
  const lines = [
    'series:',
    `  id: ${SERIES_ID}`,
    `  name: ${JSON.stringify(SERIES_NAME)}`,
  ];
  if (part !== undefined) lines.push(`  part: ${part}`);
  return lines.join('\n');
}

let updated = 0;
let skipped = 0;

for (const f of files) {
  const path = resolve('src/content/insights', `${f.slug}.md`);
  let content = await readFile(path, 'utf-8');

  if (/^series:/m.test(content)) {
    console.log(`skip   ${f.slug}.md (already has series:)`);
    skipped++;
    continue;
  }

  // Insert the series block right before the `draft:` line in the frontmatter.
  const seriesBlock = buildSeriesBlock(f.part);
  const updatedContent = content.replace(/^(draft:)/m, `${seriesBlock}\n$1`);

  if (updatedContent === content) {
    console.log(`miss   ${f.slug}.md (no draft: line to anchor against)`);
    skipped++;
    continue;
  }

  await writeFile(path, updatedContent);
  console.log(`ok     ${f.slug}.md${f.part !== undefined ? `  part ${f.part}` : `  (parent)`}`);
  updated++;
}

console.log(`\n${updated} updated, ${skipped} skipped of ${files.length} total`);
