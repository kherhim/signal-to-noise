import fs from 'node:fs';
import path from 'node:path';
import { log } from './env.mjs';

// Layer A, in-repo since 12 Oct 2026. It used to call the watermarks-remover
// Docker service; that service's 9 Oct release changed its reply shape and
// failed every essay. This module is pure and synchronous: no network, no
// service. It removes invisible carriers, normalises odd spaces and
// look-alike letters, and strips AI-provenance frontmatter keys and data
// URIs. Frontmatter VALUES are never inspected: essays about Anthropic or
// OpenAI name them in title, excerpt and seoDescription.

const PICTO = /\p{Extended_Pictographic}/u;
const SKIN = /[\u{1F3FB}-\u{1F3FF}]/u;
const KEYCAP_BASE = /^[0-9#*]$/;
const LATIN = /\p{Script=Latin}/u;
const ODD_SPACE = new Set([' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', '　']);

// Cyrillic and Greek letters that render as a Latin letter.
const CONFUSABLES = {
  'а': 'a', 'в': 'B', 'е': 'e', 'к': 'k', 'м': 'M', 'н': 'H', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 'T', 'у': 'y', 'х': 'x',
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X',
  'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'І': 'I', 'Ј': 'J', 'Ѕ': 'S',
  'ο': 'o', 'ν': 'v', 'ρ': 'p', 'τ': 't', 'α': 'a', 'ι': 'i', 'κ': 'k', 'υ': 'u',
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X',
};

const AI_KEY = /^(generator|generated_by|ai_[\w-]*|model|prompt|llm|assistant)$/i;

const hex = (ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

// What to do with one code point, given its neighbours: null (keep), or
// [kind, replacement] where replacement '' removes it.
function classify(ch, prev, next, atStart) {
  const cp = ch.codePointAt(0);
  if (cp === 0xFEFF) return atStart ? null : ['zero-width', ''];
  if (cp === 0x200D) {
    const emojiBefore = prev && (PICTO.test(prev) || prev === '️' || SKIN.test(prev));
    return emojiBefore && next && PICTO.test(next) ? null : ['zero-width', ''];
  }
  if ((cp >= 0x200B && cp <= 0x200F) || (cp >= 0x2060 && cp <= 0x2064)) return ['zero-width', ''];
  if ((cp >= 0x202A && cp <= 0x202E) || (cp >= 0x2066 && cp <= 0x2069)) return ['bidi', ''];
  if (cp === 0x00AD) return ['soft-hyphen', ''];
  if (cp >= 0xE0000 && cp <= 0xE007F) return ['tag', ''];
  if (cp === 0x180E) return ['mvs', ''];
  if ((cp >= 0xFE00 && cp <= 0xFE0F) || (cp >= 0xE0100 && cp <= 0xE01EF)) {
    if (prev && PICTO.test(prev)) return null;
    if (prev && KEYCAP_BASE.test(prev) && next === '⃣') return null;
    return ['variation-selector', ''];
  }
  if (ODD_SPACE.has(ch)) return ['odd-space', ' '];
  return null;
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

function charPass(text, findings) {
  const chars = Array.from(text);
  let out = '', idx = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const c = classify(ch, chars[i - 1], chars[i + 1], i === 0);
    if (c) { findings.push({ kind: c[0], codepoint: hex(ch), line: lineAt(text, idx) }); out += c[1]; } else out += ch;
    idx += ch.length;
  }
  return out;
}

function homoglyphPass(text, findings) {
  return text.replace(/[\p{L}\p{M}]+/gu, (word, offset) => {
    const letters = Array.from(word);
    const odd = letters.filter((l) => CONFUSABLES[l]);
    if (!odd.length) return word;
    const rest = letters.filter((l) => !CONFUSABLES[l] && /\p{L}/u.test(l));
    if (!rest.length || !rest.every((l) => LATIN.test(l))) return word;
    return letters.map((l) => {
      if (!CONFUSABLES[l]) return l;
      findings.push({ kind: 'homoglyph', codepoint: hex(l), line: lineAt(text, offset) });
      return CONFUSABLES[l];
    }).join('');
  });
}

function frontmatterPass(text, findings) {
  const m = text.match(/^(﻿?---\n)([\s\S]*?\n)(---\n)/);
  if (!m) return text;
  const lines = m[2].split('\n');
  const kept = [];
  let dropping = false;
  lines.forEach((l, i) => {
    const key = l.match(/^([A-Za-z0-9_-]+):/);
    if (key) dropping = AI_KEY.test(key[1]);
    else if (!/^\s/.test(l)) dropping = false;
    if (dropping) { if (key) findings.push({ kind: 'ai-frontmatter', codepoint: key[1], line: i + 2 }); return; }
    kept.push(l);
  });
  return m[1] + kept.join('\n') + m[3] + text.slice(m[0].length);
}

function dataUriPass(text, findings) {
  return text
    .replace(/!?\[([^\]]*)\]\(data:[^)]*\)/g, (s, alt, offset) => { findings.push({ kind: 'data-uri', codepoint: 'data:', line: lineAt(text, offset) }); return alt; })
    .replace(/(src|href)="data:[^"]*"/g, (s, attr, offset) => { findings.push({ kind: 'data-uri', codepoint: 'data:', line: lineAt(text, offset) }); return `${attr}=""`; });
}

const REPLACING = new Set(['odd-space', 'homoglyph']);

export function cleanText(text) {
  const findings = [];
  let out = charPass(text, findings);
  out = homoglyphPass(out, findings);
  out = frontmatterPass(out, findings);
  out = dataUriPass(out, findings);
  const replaced = findings.filter((f) => REPLACING.has(f.kind)).length;
  return { text: out, removed: findings.length - replaced, replaced, findings };
}

export function inspectText(text) {
  const { findings } = cleanText(text);
  return { suspicious: findings.length > 0, findings };
}

export function summariseFindings(findings = []) {
  const n = new Map();
  for (const f of findings) n.set(f.kind, (n.get(f.kind) ?? 0) + 1);
  return [...n].map(([k, v]) => `${v} ${k}`).join(', ');
}

export function plausibleClean(beforeLen, afterLen) {
  return afterLen > 0 && afterLen >= beforeLen * 0.9;
}

export function inspectFile(file) {
  const r = inspectText(fs.readFileSync(file, 'utf8'));
  return { suspicious: r.suspicious, report: { findings: r.findings }, kind: 'text' };
}

export function cleanFile(file) {
  const before = fs.readFileSync(file, 'utf8');
  const c = cleanText(before);
  if (!plausibleClean(before.length, c.text.length)) {
    throw new Error(`Layer A produced an implausible result (${c.text.length} chars vs ${before.length})`);
  }
  const changed = c.text !== before;
  if (changed) fs.writeFileSync(file, c.text);
  log('layera', `${path.basename(file)} ${changed ? `cleaned (${summariseFindings(c.findings)})` : 'already clean'}`);
  return { changed, report: { removed: c.removed, replaced: c.replaced, findings: c.findings } };
}

// Kept under its old name so the gate's prerequisite check still guards
// spend: the in-repo cleaner must remove a planted zero-width space.
export function serviceUp() {
  try {
    return cleanText('a​b').text === 'ab';
  } catch {
    return false;
  }
}
