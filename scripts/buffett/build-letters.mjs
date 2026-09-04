#!/usr/bin/env node
/* Builds src/data/buffett/letters.json from the corpus frontmatter in
   _sources/buffett-letters/: one record per letter with id, year, date,
   kind, entity, format, word count and, for Berkshire annual letters, the
   URL of the original on berkshirehathaway.com.

   Berkshire's URL pattern varies by year (<year>.html for the older
   letters, <year>ltr.pdf later), so each candidate is probed with a HEAD
   request and the first that answers 200 is kept. Pass --offline to skip
   the probe and keep whatever letters.json already records.

   Run:  node scripts/buffett/build-letters.mjs [--offline] */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFile } from 'node:child_process';

const SRC = new URL('../../_sources/buffett-letters/', import.meta.url).pathname;
const OUT = new URL('../../src/data/buffett/letters.json', import.meta.url).pathname;
const offline = process.argv.includes('--offline');
const previous = existsSync(OUT) ? Object.fromEntries(JSON.parse(readFileSync(OUT, 'utf8')).map((l) => [l.id, l])) : {};

const fm = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^"|"$/g, '');
  }
  return out;
};

/* Berkshire's server answers curl but not Node's fetch, so probe with curl,
   asking for the first byte only so PDFs are not downloaded. */
function status(url) {
  return new Promise((resolve) => {
    execFile('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-r', '0-0', '--max-time', '12', url], (err, out) => {
      resolve(err ? '000' : String(out).trim());
    });
  });
}
async function probe(year) {
  for (const p of [`${year}.html`, `${year}ltr.pdf`, `${year}pdf.pdf`]) {
    const url = `https://www.berkshirehathaway.com/letters/${p}`;
    const s = await status(url);
    if (s === '200' || s === '206') return url;
  }
  return null;
}

const files = readdirSync(SRC).filter((n) => n.endsWith('.md')).sort();
// Probe every annual letter's URL concurrently.
const probeYears = new Set();
for (const f of files) {
  const meta = fm(readFileSync(join(SRC, f), 'utf8'));
  const id = basename(f, '.md');
  const kind = meta.letter_kind ?? (id.includes('berkshire') ? 'annual' : 'unknown');
  const year = Number(meta.year ?? id.slice(0, 4));
  if (kind === 'annual' && year >= 1977 && !offline) probeYears.add(year);
}
const probed = Object.fromEntries(await Promise.all([...probeYears].map(async (y) => [y, await probe(y)])));

const letters = [];
for (const f of files) {
  const text = readFileSync(join(SRC, f), 'utf8');
  const meta = fm(text);
  const id = basename(f, '.md');
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const kind = meta.letter_kind ?? (id.includes('berkshire') ? 'annual' : 'unknown');
  const year = Number(meta.year ?? id.slice(0, 4));
  let source = previous[id]?.source ?? null;
  // Probed URL first, then whatever a previous run found, then the pattern
  // the site has used for years: <year>.html up to 2003, <year>ltr.pdf after.
  if (kind === 'annual' && year >= 1977) {
    source = (!offline && probed[year]) || source
      || `https://www.berkshirehathaway.com/letters/${year}${year <= 2003 ? '.html' : 'ltr.pdf'}`;
  }
  letters.push({
    id, year, date: meta.date ?? null, kind,
    entity: meta.entity ?? (kind === 'partnership' ? 'Buffett Partnership Ltd.' : 'Berkshire Hathaway Inc.'),
    format: meta.format ?? null,
    words: body.split(/\s+/).filter(Boolean).length,
    source,
  });
}

writeFileSync(OUT, JSON.stringify(letters, null, 1) + '\n');
const linked = letters.filter((l) => l.source).length;
console.log(`letters.json: ${letters.length} letters, ${linked} with a source URL`);
