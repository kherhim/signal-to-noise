// scripts/line/register.mjs
//
// Stiff register (24 Oct 2026). Layer B swaps plain words for formal stand-ins
// the owner rarely uses: "bought" becomes "acquired", "spending" becomes
// "expenditure", "Growth needs" becomes "Expansion requires". The humaniser
// flagged 2 such sentences in one essay; about 25 had to be fixed by hand.
//
// data/register.json holds the pairs, each with the owner's rate and the line's
// rate per 1,000 words. A pair stays only while the owner's own rate is at or
// below OWNER_MAX, so his real voice is never flagged. The scanner does not
// fail anything: its hits go to the humaniser, which judges each in context,
// and the list goes to Layer B as words not to introduce.
//
// Matching: whole words, case-insensitive, on the scannable text (quotations,
// blockquotes, code and link targets already gone). A single word also matches
// its simple inflections: +s, +es, +ed, +d, +ing, a dropped final e before
// -ing/-ed, and y to -ies/-ied ("acquire" finds acquires, acquired, acquiring).
// A phrase inflects its last word, or its first when it ends on a preposition
// ("respond to" finds "responds to"); any whitespace between its words.
// Optional per-pair fields: `forms` (explicit list, replaces the stem rule)
// and `except` (phrases that are terms of art, e.g. "capital expenditure",
// blanked before matching in both the scanner and the measurement).
//
//   node scripts/line/register.mjs measure [--sources <dir>] [--dry]
//
// recomputes owner_per_1k from the owner's hand-written essays and line_per_1k
// from the line's gated output in <sources>/staging-articles/*/gated.md
// (default: the repo's _sources, which is gitignored and may be absent; the
// stored line rates are then kept).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';
import { scannableText } from './claudish.mjs';
import { loadLedger } from './queue.mjs';

export const REGISTER = path.join(ROOT, 'scripts', 'line', 'data', 'register.json');
const INSIGHTS = path.join(ROOT, 'src', 'content', 'insights');
export const OWNER_MAX = 0.3;

// Essays that went through the gate (and Layer B) outside the line's ledger.
// Their published text is not the owner's plain register.
export const GATED_OUTSIDE_LEDGER = ['two-banks-one-start-line'];

export function loadRegister(file = REGISTER) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { pairs: [] }; }
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function inflect(word) {
  const w = word.toLowerCase();
  const out = new Set([w, `${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`]);
  if (w.endsWith('e')) { out.add(`${w.slice(0, -1)}ing`); out.add(`${w.slice(0, -1)}ed`); }
  if (/[^aeiou]y$/.test(w)) { out.add(`${w.slice(0, -1)}ies`); out.add(`${w.slice(0, -1)}ied`); }
  return [...out];
}

// A phrase inflects its last word ("capital expenditures"), or its first when
// it ends on a preposition ("responds to"); short leading words stay fixed.
function phraseForms(phrase) {
  const parts = phrase.trim().toLowerCase().split(/\s+/);
  if (parts.length > 1 && /^(?:to|of|for|with|than|on|in)$/.test(parts.at(-1))) {
    return parts[0].length > 3 ? inflect(parts[0]).map((f) => [f, ...parts.slice(1)].join(' ')) : [parts.join(' ')];
  }
  return inflect(parts.at(-1)).map((f) => [...parts.slice(0, -1), f].join(' '));
}

const formsOf = (p) => (p.forms?.length ? p.forms.map((f) => f.toLowerCase()) : phraseForms(p.formal));
const alt = (forms) => forms.sort((a, b) => b.length - a.length).map((f) => f.split(/\s+/).map(esc).join('\\s+')).join('|');

export function pairRegex(p) {
  return new RegExp(`(?<![\\p{L}\\p{N}'’-])(?:${alt(formsOf(p))})(?![\\p{L}\\p{N}'’-])`, 'giu');
}

function blankExcepts(text, p) {
  if (!p.except?.length) return text;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt(p.except.flatMap(phraseForms))})(?![\\p{L}\\p{N}])`, 'giu');
  return text.replace(re, (m) => ' '.repeat(m.length));
}

const pairsOf = (register) => (Array.isArray(register) ? register : register?.pairs ?? []);
const stripFrontmatter = (md) => md.replace(/^---[\s\S]*?\n---\n/, '');
export const countWords = (t) => t.split(/\s+/).filter(Boolean).length;
const prep = (md) => scannableText(stripFrontmatter(md));

// Per-1,000-word rate of each pair across all texts taken together, keyed by
// `formal`. Words are counted on the scannable text, the same denominator the
// humaniser uses.
export function measureRates(texts, pairs) {
  const clean = texts.map(prep);
  const words = clean.reduce((n, t) => n + countWords(t), 0);
  const rates = {};
  for (const p of pairsOf(pairs)) {
    const re = pairRegex(p);
    const n = clean.reduce((k, t) => k + (blankExcepts(t, p).match(re)?.length ?? 0), 0);
    rates[p.formal] = words ? (n / words) * 1000 : 0;
  }
  return rates;
}

const sentences = (text) => text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

export const MAX_HITS = 40;

// One hit per pair per sentence, `sentence` quoted from the scannable text.
export function scanRegister(text, register = loadRegister(), { max = MAX_HITS } = {}) {
  const hits = [];
  for (const s of sentences(scannableText(text))) {
    for (const p of pairsOf(register)) {
      if (blankExcepts(s, p).match(pairRegex(p))) hits.push({ formal: p.formal, plain: p.plain, sentence: s });
      if (hits.length >= max) return hits;
    }
  }
  return hits;
}

// Most line-prone first: the words Layer B is told never to introduce.
export function topFormal(register = loadRegister(), n = 20) {
  return [...pairsOf(register)].sort((a, b) => (b.line_per_1k ?? 0) - (a.line_per_1k ?? 0) || a.formal.localeCompare(b.formal))
    .slice(0, n).map((p) => p.formal);
}

export function ownerTexts({ dir = INSIGHTS, exclude = [...loadLedger().published.map((p) => p.slug), ...GATED_OUTSIDE_LEDGER] } = {}) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !exclude.includes(f.slice(0, -3))).sort()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
}

export function lineTexts(sources = path.join(ROOT, '_sources')) {
  const dir = path.join(sources, 'staging-articles');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().map((d) => path.join(dir, d, 'gated.md')).filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, 'utf8'));
}

const r2 = (x) => Math.round(x * 100) / 100;

export function measure({ file = REGISTER, sources, dry = false, today = new Date().toISOString().slice(0, 10) } = {}) {
  const reg = loadRegister(file);
  const owner = ownerTexts();
  const line = lineTexts(sources);
  const o = measureRates(owner, reg.pairs);
  const l = line.length ? measureRates(line, reg.pairs) : null;
  if (!l) console.warn('register: no line output found; keeping stored line_per_1k');
  reg.pairs = reg.pairs.map((p) => ({ ...p, owner_per_1k: r2(o[p.formal]), line_per_1k: l ? r2(l[p.formal]) : p.line_per_1k }));
  reg.updated = today;
  if (!dry) fs.writeFileSync(file, JSON.stringify(reg, null, 2) + '\n');
  console.log(`owner: ${owner.length} essays, ${owner.reduce((n, t) => n + countWords(prep(t)), 0)} words; line: ${line.length} essays, ${line.reduce((n, t) => n + countWords(prep(t)), 0)} words`);
  for (const p of reg.pairs) console.log(`${p.owner_per_1k > OWNER_MAX ? 'OVER' : '    '} ${p.formal.padEnd(16)} owner ${p.owner_per_1k.toFixed(2)}  line ${Number(p.line_per_1k ?? 0).toFixed(2)}  → ${p.plain}`);
  return reg;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const si = process.argv.indexOf('--sources');
  if (process.argv[2] !== 'measure') { console.error('usage: node scripts/line/register.mjs measure [--sources <dir>] [--dry]'); process.exit(2); }
  measure({ sources: si > 0 ? process.argv[si + 1] : undefined, dry: process.argv.includes('--dry') });
}
