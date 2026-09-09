import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log, paused } from './env.mjs';
import { runSkill } from './claude.mjs';
import { loadConfig, loadQueue, loadNeverList, neverListHits } from './queue.mjs';

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

export const topScore = (items) => items.reduce((max, i) => Math.max(max, i.score), 0);

export function filterNeverList(items, never) {
  return items.filter((i) => {
    const text = Object.values(i).filter((v) => typeof v === 'string').join(' ');
    return neverListHits(text, never).length === 0;
  });
}

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

export const PROPOSALS_HEADING = '## Scanner proposals';
export const IDEAS_MD = path.join(ROOT, 'distribution', 'ARTICLE-IDEAS.md');
const TABLE_HEAD_ROW = '| Idea | Angle | Axes | Status |';
const TABLE_HEAD = `${TABLE_HEAD_ROW}\n|---|---|---|---|`;
// A headline is scraped from the wild and a proposed title is model output.
// A literal pipe in either would split the row into phantom columns and corrupt
// the rendered table, so it is escaped the way GitHub-flavoured markdown wants.
const escapePipes = (s) => String(s ?? '').replace(/\|/g, '\\|');
const proposalRow = (i) => `| ${escapePipes(i.proposed_title)} | ${escapePipes(i.headline)} — ${i.url} | scanner | idea |`;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Compared against the escaped form, because that is how the row was written.
const alreadyListed = (md, title) => new RegExp(`^\\|\\s*${escapeRe(escapePipes(title).trim())}\\s*\\|`, 'mi').test(md);

// A peg the scanner scored at preempt level but that maps to nothing in the
// queue is an essay idea nobody has written down. The board is overwritten every
// morning, so without this the idea is gone by tomorrow. Pure, so it can be
// tested without touching the backlog.
export function mergeProposals(ideasMd, items, threshold) {
  const rows = [];
  const seen = new Set();
  for (const i of items ?? []) {
    const title = String(i.proposed_title ?? '').trim();
    if (!title || Number(i.score) < threshold) continue;
    const key = title.toLowerCase();
    if (seen.has(key) || alreadyListed(ideasMd, title)) continue;
    seen.add(key);
    rows.push(proposalRow(i));
  }
  if (!rows.length) return ideasMd;
  if (!ideasMd.includes(PROPOSALS_HEADING)) {
    return `${ideasMd.replace(/\s+$/, '')}\n\n${PROPOSALS_HEADING}\n\nTitles the scanner proposed that no queue item covers. Unreviewed — prune as ruthlessly as the rest.\n\n${TABLE_HEAD}\n${rows.join('\n')}\n`;
  }
  // Append at the end of the existing section, never past the next heading.
  const start = ideasMd.indexOf(PROPOSALS_HEADING) + PROPOSALS_HEADING.length;
  const next = ideasMd.slice(start).search(/\n## /);
  const cut = next === -1 ? ideasMd.length : start + next;
  // A section someone left headerless (a hand-written heading, prose and no
  // table) would otherwise collect orphan rows that render as plain text.
  const head = ideasMd.slice(start, cut).includes(TABLE_HEAD_ROW) ? '' : `\n${TABLE_HEAD}`;
  return `${ideasMd.slice(0, cut).replace(/\s+$/, '')}${head}\n${rows.join('\n')}\n${ideasMd.slice(cut)}`;
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
  if (dry) {
    log('scan', `DRY: would call the scan skill with input of ${input.length} chars`);
    return null;
  }

  let out;
  let rawItems;
  try {
    out = runSkill({ skill: 'scan', input, tools: ['WebSearch', 'WebFetch'], schema: SCHEMA, model: cfg.models?.scan ?? null, maxTurns: cfg.scan_max_turns ?? 40 });
    rawItems = out.json?.items;
    if (!Array.isArray(rawItems)) throw new Error('scan skill did not return an items array');
  } catch (err) {
    log('scan', `FAILED: ${err.message}`);
    throw err;
  }

  const items = filterNeverList(rawItems, never)
    .map((i) => ({ ...i, score: score(i, cfg.weights) }))
    .map((i) => ({ ...i, action: actionFor(i.score, i.corpus_fit, cfg) }));
  const board = { date: new Date().toISOString().slice(0, 10), cost_usd: out.cost_usd, items };
  fs.writeFileSync(BOARD_JSON, JSON.stringify(board, null, 2) + '\n');
  fs.writeFileSync(BOARD_MD, renderBoard(board));
  try {
    const before = fs.readFileSync(IDEAS_MD, 'utf8');
    const after = mergeProposals(before, items, cfg.thresholds.preempt);
    if (after !== before) { fs.writeFileSync(IDEAS_MD, after); log('scan', 'new proposals appended to ARTICLE-IDEAS.md'); }
  } catch (err) {
    log('scan', `could not merge proposals into ARTICLE-IDEAS.md: ${err.message}`); // never fail a scan over the backlog file
  }
  log('scan', `${items.length} items, top ${topScore(items)}, $${out.cost_usd.toFixed(3)}`);
  return board;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const board = await scan({ dry: process.argv.includes('--dry') });
  if (board) console.log(renderBoard(board));
}
