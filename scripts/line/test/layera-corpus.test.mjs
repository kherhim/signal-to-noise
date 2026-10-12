import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cleanText } from '../layera.mjs';

const DIR = new URL('../../../src/content/insights/', import.meta.url).pathname;

// Owner-reviewed 12 Oct 2026: paste residue in essays written before the
// gate existed. Only these files, and only odd spaces, may differ.
const ODD_SPACE_ALLOWED = new Set([
  '10-commandments-experienced-cfo.md',
  '10-commandments-newbie-cfo.md',
  'importance-treasurers-finance.md',
  'mastering-matrix-how-curiosity-grit-shape-winning-teams.md',
  'reflecting-year-insights-final-thoughts-2024.md',
  'symphony-success-ideas-execution-consistency.md',
]);

test('Layer A leaves every published essay alone, bar the allowlisted odd spaces', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 59);
  for (const f of files) {
    const { findings } = cleanText(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const unexpected = findings.filter((x) => !(x.kind === 'odd-space' && ODD_SPACE_ALLOWED.has(f)));
    assert.deepEqual(unexpected, [], `${f}: ${JSON.stringify(unexpected.slice(0, 3))}`);
  }
});
