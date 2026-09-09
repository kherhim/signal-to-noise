import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';

const LINE = path.join(ROOT, 'distribution', 'line');
export const CONFIG = path.join(LINE, 'config.json');
export const QUEUE = path.join(LINE, 'queue.md');
export const LEDGER = path.join(LINE, 'ledger.json');
export const NEVER = path.join(ROOT, '_sources', 'NEVER-LIST.md');

export const loadConfig = () => JSON.parse(fs.readFileSync(CONFIG, 'utf8'));

export function parseQueue(md) {
  return md.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-|title\s*\|/i.test(l)).map((l) => {
    const c = l.split('|').slice(1, -1).map((s) => s.trim());
    return { title: c[0], family: c[1], trigger: c[2] || null, status: c[3] || 'queued' };
  }).filter((r) => r.title);
}
export const loadQueue = () => parseQueue(fs.readFileSync(QUEUE, 'utf8'));

export function loadNeverList() {
  try {
    return fs.readFileSync(NEVER, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  } catch { return ['Axi']; }
}
export function neverListHits(text, list = loadNeverList()) {
  return list.filter((w) => {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<!\\w)${esc}(?!\\w)`, 'i').test(text);
  });
}

export const loadLedger = () => { try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { published: [] }; } };
export function appendLedger(entry) {
  const l = loadLedger(); l.published.push(entry);
  fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2) + '\n');
}
export function markQueue(title, status) {
  const md = fs.readFileSync(QUEUE, 'utf8').split('\n').map((l) => {
    if (!l.startsWith('|') || !l.includes(`| ${title} |`)) return l;
    const c = l.split('|'); c[4] = ` ${status} `; return c.join('|');
  }).join('\n');
  fs.writeFileSync(QUEUE, md);
}
