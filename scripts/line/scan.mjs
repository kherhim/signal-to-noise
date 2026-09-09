import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log, paused } from './env.mjs';
import { runSkill } from './claude.mjs';
import { loadConfig, loadQueue, loadNeverList, neverListHits, loadLedger } from './queue.mjs';

const LINE = path.join(ROOT, 'distribution', 'line');
export const BOARD_JSON = path.join(LINE, 'peg-board.json');
export const BOARD_MD = path.join(LINE, 'peg-board.md');

const SCHEMA = {
  type: 'object', required: ['items'],
  properties: { items: { type: 'array', maxItems: 8, items: {
    type: 'object', required: ['headline', 'url', 'source', 'date', 'corpus_fit', 'magnitude', 'velocity', 'number', 'maps_to', 'note'],
    properties: {
      headline: { type: 'string' }, url: { type: 'string' }, source: { type: 'string' }, date: { type: 'string' },
      corpus_fit: { type: 'integer', minimum: 0, maximum: 10 }, magnitude: { type: 'integer', minimum: 0, maximum: 10 },
      velocity: { type: 'integer', minimum: 0, maximum: 10 }, number: { type: 'integer', minimum: 0, maximum: 10 },
      maps_to: { type: 'string' }, proposed_title: { type: 'string' }, note: { type: 'string' },
    } } } },
};

export const score = (it, w) => Math.round((it.corpus_fit * w.corpus_fit + it.magnitude * w.magnitude + it.velocity * w.velocity + it.number * w.number) * 100) / 10;

export function actionFor(s, fit, cfg) {
  const t = cfg.thresholds;
  if (s >= t.fast_piece && fit >= t.min_fit_to_preempt) return 'fast_piece';
  if (s >= t.preempt && fit >= t.min_fit_to_preempt) return 'preempt';
  if (s >= t.native_post) return 'native_post';
  return 'log';
}

export function renderBoard(board) {
  const rows = [...board.items].sort((a, b) => b.score - a.score)
    .map((i) => `| ${i.headline} | ${i.score} | ${i.action} | ${i.maps_to || i.proposed_title || ''} | [source](${i.url}) |`);
  return `# Peg board — ${board.date}\n\n| Story | Score | Action | Maps to | Link |\n|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

export async function scan({ dry = false } = {}) {
  if (paused()) { log('scan', 'PAUSE present'); return null; }
  const cfg = loadConfig();
  const queue = loadQueue();
  const published = fs.readdirSync(path.join(ROOT, 'src', 'content', 'insights')).map((f) => f.replace(/\.md$/, ''));
  const never = loadNeverList();
  const input = [
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    `Themes:\n${fs.readFileSync(path.join(LINE, 'themes.md'), 'utf8')}`,
    `Queue and holding pen:\n${queue.map((q) => `- ${q.title} [${q.family}]${q.trigger ? ` trigger: ${q.trigger}` : ''}`).join('\n')}`,
    `Published essay slugs:\n${published.join(', ')}`,
    `Never-list:\n${never.join(', ')}`,
  ].join('\n\n');
  const out = runSkill({ skill: 'scan', input, tools: ['WebSearch', 'WebFetch'], schema: SCHEMA, maxTurns: 40 });
  const items = out.json.items
    .filter((i) => neverListHits(`${i.headline} ${i.note}`, never).length === 0)
    .map((i) => ({ ...i, score: score(i, cfg.weights) }))
    .map((i) => ({ ...i, action: actionFor(i.score, i.corpus_fit, cfg) }));
  const board = { date: new Date().toISOString().slice(0, 10), cost_usd: out.cost_usd, items };
  if (!dry) {
    fs.writeFileSync(BOARD_JSON, JSON.stringify(board, null, 2) + '\n');
    fs.writeFileSync(BOARD_MD, renderBoard(board));
  }
  log('scan', `${items.length} items, top ${items[0]?.score ?? 0}, $${out.cost_usd.toFixed(3)}`);
  return board;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const board = await scan({ dry: process.argv.includes('--dry') });
  if (board) console.log(renderBoard(board));
}
