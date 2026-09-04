#!/usr/bin/env node
/* Verifies that every curated Buffett excerpt is verbatim from the corpus.

   Checks src/data/buffett/line.json and src/data/buffett/topics/*.json.
   Text is normalised (whitespace, quote and dash variants, case) and must
   be an exact substring of the letter. Entries marked `corrected: true`
   in pdf-ocr letters pass at ≥ 0.9 similarity against the best-matching
   window instead. Also enforces word caps and one entry per year.

   Exits non-zero on any failure, so it can run as part of prebuild.

   Run:  node scripts/buffett/verify-excerpts.mjs */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = new URL('../../_sources/buffett-letters/', import.meta.url).pathname;
const DATA = new URL('../../src/data/buffett/', import.meta.url).pathname;
const letters = Object.fromEntries(JSON.parse(readFileSync(join(DATA, 'letters.json'), 'utf8')).map((l) => [l.id, l]));

const norm = (s) => s
  .replace(/[‘’‚‛`´]/g, "'")
  .replace(/[“”„‟]/g, '"')
  .replace(/[–—−]/g, '-')
  .replace(/…/g, '...')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const bodies = {};
const body = (id) => {
  if (!(id in bodies)) {
    const f = join(SRC, `${id}.md`);
    bodies[id] = existsSync(f) ? norm(readFileSync(f, 'utf8').replace(/^---\n[\s\S]*?\n---\n?/, '')) : null;
  }
  return bodies[id];
};

function similarity(a, b) {
  // Levenshtein ratio on characters; fine for excerpts under 400 chars.
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

function bestWindowSimilarity(hay, needle) {
  // Anchor on the needle's first three words, then compare windows.
  const words = needle.split(' ');
  const anchor = words.slice(0, 3).join(' ');
  let best = 0;
  let from = 0;
  while (from < hay.length) {
    const at = hay.indexOf(anchor, from);
    if (at < 0) break;
    // Compare windows of a few lengths around the needle's own, so a
    // one-character OCR fix in a short quote is not swamped by trailing text.
    for (let extra = -4; extra <= 8; extra += 2) {
      best = Math.max(best, similarity(hay.slice(at, at + needle.length + extra), needle));
    }
    from = at + 1;
  }
  if (best === 0) {
    // No anchor hit: slide coarsely.
    for (let at = 0; at < hay.length - needle.length; at += 20) {
      best = Math.max(best, similarity(hay.slice(at, at + needle.length), needle));
      if (best >= 0.9) break;
    }
  }
  return best;
}

const problems = [];
function check(file, entry, text, minW, maxW) {
  const label = `${basename(file)} → ${entry.id}`;
  const l = letters[entry.id];
  if (!l) return problems.push(`${label}: unknown letter id`);
  if (entry.year !== l.year) problems.push(`${label}: year ${entry.year} ≠ letter year ${l.year}`);
  const w = text.trim().split(/\s+/).length;
  if (w < minW || w > maxW) problems.push(`${label}: ${w} words (allowed ${minW}–${maxW})`);
  const hay = body(entry.id);
  if (!hay) return problems.push(`${label}: corpus file missing`);
  const needle = norm(text).replace(/^\.\.\.\s*/, '').replace(/\s*\.\.\.$/, '');
  if (hay.includes(needle)) return;
  if (entry.corrected && l.format === 'pdf-ocr') {
    const s = bestWindowSimilarity(hay, needle);
    if (s >= 0.9) return;
    return problems.push(`${label}: corrected excerpt only ${(s * 100).toFixed(0)}% similar to the corpus`);
  }
  problems.push(`${label}: not verbatim${entry.corrected ? ' (corrected only allowed for pdf-ocr letters)' : ''}`);
}

let entries = 0;
const lineFile = join(DATA, 'line.json');
if (existsSync(lineFile)) {
  const line = JSON.parse(readFileSync(lineFile, 'utf8'));
  for (const e of line) { check(lineFile, e, e.quote, 8, 40); entries++; }
}
const topicsDir = join(DATA, 'topics');
if (existsSync(topicsDir)) {
  for (const f of readdirSync(topicsDir).filter((n) => n.endsWith('.json'))) {
    const t = JSON.parse(readFileSync(join(topicsDir, f), 'utf8'));
    const years = new Set();
    for (const e of t.entries) {
      check(f, e, e.excerpt, 15, 50);
      if (years.has(e.year)) problems.push(`${f} → ${e.id}: second entry for ${e.year}`);
      years.add(e.year);
      entries++;
    }
  }
}

if (problems.length) {
  console.error(`verify-excerpts: ${problems.length} problem(s) in ${entries} entries`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`verify-excerpts: ${entries} entries verbatim`);
