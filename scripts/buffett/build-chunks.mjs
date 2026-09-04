#!/usr/bin/env node
/* Builds the corpus file the browser searches: public/buffett/chunks.json,
   an array of paragraph-sized chunks (≤ ~120 words) with compact keys:
   l = letter id, y = year, k = kind, t = text. The search component
   fetches it on the first keystroke (Cloudflare gzips it in transit) and
   ranks chunks by term matches, showing ≤ 60-word excerpts.

   Run:  node scripts/buffett/build-chunks.mjs */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = new URL('../../_sources/buffett-letters/', import.meta.url).pathname;
const OUT_DIR = new URL('../../public/buffett/', import.meta.url).pathname;
const LETTERS = JSON.parse(readFileSync(new URL('../../src/data/buffett/letters.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(LETTERS.map((l) => [l.id, l]));

const TARGET = 120;

function chunk(text) {
  const paras = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.split(' ').length >= 6);
  const out = [];
  let buf = [], n = 0;
  const flush = () => { if (buf.length) out.push(buf.join(' ')); buf = []; n = 0; };
  for (const p of paras) {
    const w = p.split(' ');
    if (w.length > TARGET * 1.6) {
      flush();
      for (let i = 0; i < w.length; i += TARGET) out.push(w.slice(i, i + TARGET).join(' '));
      continue;
    }
    if (n + w.length > TARGET) flush();
    buf.push(p);
    n += w.length;
  }
  flush();
  return out;
}

const chunks = [];
for (const f of readdirSync(SRC).filter((x) => x.endsWith('.md')).sort()) {
  const id = basename(f, '.md');
  const meta = byId[id];
  if (!meta) continue;
  const body = readFileSync(join(SRC, f), 'utf8').replace(/^---\n[\s\S]*?\n---\n?/, '');
  for (const t of chunk(body)) chunks.push({ l: id, y: meta.year, k: meta.kind, t });
}

mkdirSync(OUT_DIR, { recursive: true });
const json = JSON.stringify(chunks);
writeFileSync(join(OUT_DIR, 'chunks.json'), json);
console.log(`chunks.json: ${chunks.length} chunks from ${LETTERS.length} letters, ${(json.length / 1e6).toFixed(1)} MB raw`);
