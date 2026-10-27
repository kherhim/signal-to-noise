// Narration script for essay audio. Shared by the site build and the Node CLI,
// so it stays dependency-free (node:crypto only).
import { createHash } from 'node:crypto';

const UNITS = { trillion: 'trillion', billion: 'billion', million: 'million', bn: 'billion', m: 'million' };
const CURRENCY = { '$': 'dollars', '£': 'pounds', '€': 'euros' };
const QUARTERS = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth' };
const NUM = String.raw`\d[\d,]*(?:\.\d+)?`;

export function spokenForm(text, pron = {}) {
  let t = text;
  t = t.replace(/\s*\(\[Source\]\([^)]*\)\)/g, '');
  t = t.replace(/\s*\(Source\)/g, '');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  t = t.replace(/<[^>]+>/g, '');
  t = t.replace(/\*\*|\*|_/g, '');
  const unitRe = new RegExp(String.raw`([$£€])(${NUM})\s*(trillion|billion|million|bn|m)\b`, 'gi');
  t = t.replace(unitRe, (_, c, n, u) => `${n} ${UNITS[u.toLowerCase()]} ${CURRENCY[c]}`);
  const decRe = new RegExp(String.raw`([$£€])(\d[\d,]*)\.(\d\d)\b`, 'g');
  t = t.replace(decRe, (_, c, n, p) => (p === '00' ? `${n} ${CURRENCY[c]}` : `${n} ${CURRENCY[c]} ${parseInt(p, 10)}`));
  t = t.replace(new RegExp(String.raw`([$£€])(${NUM})`, 'g'), (_, c, n) => `${n} ${CURRENCY[c]}`);
  t = t.replace(/(\d)\s*[–-]\s*(\d)/g, '$1 to $2');
  t = t.replace(/%/g, ' per cent');
  t = t.replace(/S&P/g, 'S and P').replace(/&amp;/g, 'and').replace(/&/g, 'and');
  t = t.replace(/~/g, 'about ');
  t = t.replace(/\b(\d+(?:\.\d+)?)x\b/g, '$1 times');
  t = t.replace(/\bQ([1-4])\b/g, (_, q) => `${QUARTERS[q]} quarter`);
  t = t.replace(/\bFY(\d{4})\b/g, 'financial year $1');
  t = t.replace(/\s+/g, ' ').trim();
  for (const [word, say] of Object.entries(pron)) {
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(String.raw`(?<![\w])${esc}(?![\w])`, 'g'), say);
  }
  return t;
}

export function narrationScript(body, pron = {}) {
  const src = body
    .replace(/<figure[\s\S]*?<\/figure>/g, '')
    .replace(/<details[\s\S]*?<\/details>/g, '');
  const items = [];
  for (const block of src.split(/\n\s*\n/)) {
    const b = block.trim();
    if (!b || /^(\||<|!|import |---)/.test(b)) continue;
    if (b.startsWith('#')) {
      const text = spokenForm(b.replace(/^#+\s*/, ''), pron);
      if (text) items.push({ kind: 'h', text });
      continue;
    }
    const text = spokenForm(b.replace(/^(>\s?)+/gm, ''), pron);
    if (!text || text.toLowerCase().startsWith('methodology')) continue;
    items.push({ kind: 'p', text });
  }
  const chapters = items.filter((i) => i.kind === 'h').map((i) => i.text);
  if (items.length && items[0].kind !== 'h') chapters.unshift('Opening');
  return { items, chapters };
}

export function scriptHash(items) {
  return createHash('sha256').update(items.map((i) => i.kind + ':' + i.text).join('\n')).digest('hex');
}

const ABBREV = new Set(['dr', 'mr', 'mrs', 'st', 'vs', 'c']);

export function splitSentences(text) {
  const out = [];
  let start = 0;
  const re = /[.!?]+(?=\s)/g;
  let m;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    const word = (text.slice(start, m.index).match(/([A-Za-z]+)$/) || [])[1];
    if (m[0] === '.' && word && ABBREV.has(word.toLowerCase()) && /(^|\s)[A-Za-z]+$/.test(text.slice(start, m.index))) continue;
    out.push(text.slice(start, end).trim());
    start = end;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}
