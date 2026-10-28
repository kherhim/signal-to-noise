// Narration script for essay audio. Shared by the site build and the Node CLI,
// so it stays dependency-free (node:crypto only).
import { createHash } from 'node:crypto';

const UNITS = { trillion: 'trillion', billion: 'billion', million: 'million', thousand: 'thousand', tn: 'trillion', bn: 'billion', m: 'million', k: 'thousand' };
const CURRENCY = { '$': 'dollars', '£': 'pounds', '€': 'euros' };
const QUARTERS = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth' };
const NUM = String.raw`\d[\d,]*(?:\.\d+)?`;

const PAREN = String.raw`\((?:[^()]|\([^()]*\))*\)`; // one level of nested parentheses
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…',
};

function decodeEntities(t) {
  return t
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] ?? m))
    .replace(/ /g, ' ');
}

export function spokenForm(text, pron = {}) {
  let t = text;
  t = t.replace(/\\([\\`*_{}\[\]()#+\-.!>|<~$&])/g, '$1');
  t = t.replace(new RegExp(String.raw`\s*\(\[Source\]${PAREN}\)`, 'g'), '');
  t = t.replace(/\s*\(Source\)/g, '');
  t = t.replace(new RegExp(String.raw`!\[[^\]]*\]${PAREN}`, 'g'), '');
  t = t.replace(new RegExp(String.raw`\[([^\]]+)\]${PAREN}`, 'g'), '$1');
  t = t.replace(/<[^>]+>/g, '');
  t = decodeEntities(t);
  t = t.replace(/\*\*|\*|_/g, '');
  t = t.replace(/(?:\uD83D\uDD1F|\d\uFE0F?\u20E3)(?=\s*\d)/g, ''); // decorative keycap before a number: 🔟1. -> 1.
  t = t.replace(/\uD83D\uDD1F/g, '10').replace(/(\d)\uFE0F?\u20E3/g, '$1'); // keycap emoji: 4️⃣ -> 4, 🔟 -> 10
  t = t.replace(/\p{Extended_Pictographic}\uFE0F?/gu, '');
  t = t.replace(/\bvs\.?(?=\s)/gi, 'versus');
  const unitRe = new RegExp(String.raw`([$£€])(${NUM})\s*(trillion|billion|million|thousand|tn|bn|m|k)\b`, 'gi');
  t = t.replace(unitRe, (_, c, n, u) => `${n} ${UNITS[u.toLowerCase()]} ${CURRENCY[c]}`);
  const decRe = new RegExp(String.raw`([$£€])(\d[\d,]*)\.(\d\d)\b`, 'g');
  const CENTS = { '$': 'cents', '£': 'pence', '€': 'cents' };
  t = t.replace(decRe, (_, c, n, p) => {
    if (p === '00') return `${n} ${CURRENCY[c]}`;
    if (n === '0') return `${parseInt(p, 10)} ${CENTS[c]}`;
    return `${n} ${CURRENCY[c]} ${parseInt(p, 10)}`;
  });
  t = t.replace(new RegExp(String.raw`([$£€])(${NUM})`, 'g'), (_, c, n) => `${n} ${CURRENCY[c]}`);
  t = t.replace(/(\d)\s*–\s*(\d)/g, '$1 to $2');
  t = t.replace(/%/g, ' per cent');
  t = t.replace(/\b([A-Z]{1,3})&([A-Z]{1,3})\b/g, '$1 and $2').replace(/&/g, 'and'); // S&P, FP&A, M&A
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

const LIST_MARK = /^\s*([-*+]|\d{1,2}[.)])\s+/;

export function narrationScript(body, pron = {}) {
  const src = body
    .replace(/<figure[\s\S]*?<\/figure>/g, '')
    .replace(/<details[\s\S]*?<\/details>/g, '');
  const items = [];
  const push = (kind, raw) => {
    const text = spokenForm(raw, pron);
    if (!text || text.toLowerCase().startsWith('methodology')) return;
    items.push({ kind, text });
  };
  for (const block of src.split(/\n\s*\n/)) {
    let lines = block.trim().split('\n');
    if (!lines[0] || /^(\||import |---+$)/.test(lines[0].trim())) continue;
    if (/^(#\w+\s*)+$/.test(block.trim())) continue;
    if (/^#+\s/.test(lines[0])) {
      push('h', lines[0].replace(/^#+\s*/, ''));
      lines = lines.slice(1);
      if (!lines.length) continue;
    }
    lines = lines.map((l) => l.replace(/^(\s*>)+\s?/, ''));
    if (lines.every((l) => LIST_MARK.test(l))) {
      for (const l of lines) push('p', l.replace(LIST_MARK, ''));
    } else {
      push('p', lines.map((l) => l.replace(LIST_MARK, '')).join(' '));
    }
  }
  const chapters = items.filter((i) => i.kind === 'h').map((i) => i.text);
  if (items.length && items[0].kind !== 'h') chapters.unshift('Opening');
  return { items, chapters };
}

export function scriptHash(items) {
  return createHash('sha256').update(items.map((i) => i.kind + ':' + i.text).join('\n')).digest('hex');
}

const ABBREV = new Set(['dr', 'mr', 'mrs', 'st', 'vs']);

export function splitSentences(text) {
  const out = [];
  let start = 0;
  const re = /[.!?]+["'”’)\]]*(?=\s)/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[0][0] === '.' && /^\.["'”’)\]]*$/.test(m[0])) {
      const before = text.slice(start, m.index);
      const word = (before.match(/([A-Za-z]+)$/) || [])[1];
      const prev = word ? before[before.length - word.length - 1] : undefined;
      const isToken = !prev || /\s/.test(prev);
      if (word && isToken && ABBREV.has(word.toLowerCase())) continue;
      if (word === 'c' && isToken && /^\s+\d/.test(text.slice(m.index + m[0].length))) continue;
      if (/(^|[^A-Za-z])[A-Za-z]\.[A-Za-z]$/.test(before)) continue; // U.S., J.K., e.g., i.e.
      if (/^\s*\d{1,2}$/.test(before)) continue; // list number: 2. Methodology
      const after = text.slice(m.index + m[0].length);
      if (/(^|\s)[A-Z]$/.test(before) && (/^\s+[A-Z]\./.test(after) || /[A-Z]\.\s+[A-Z]$/.test(before))) continue; // initials: I. J. Good
    }
    const end = m.index + m[0].length;
    out.push(text.slice(start, end).trim());
    start = end;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}
