import fs from 'node:fs';
import path from 'node:path';
import { ROOT, nowIso } from './env.mjs';

export const STAGING = process.env.LINE_STAGING ?? path.join(ROOT, '_sources', 'staging-articles');
export const STAGES = ['new', 'briefed', 'approved', 'drafted', 'gated', 'covered', 'final-sent', 'published'];

export const essayDir = (slug) => path.join(STAGING, slug);
const stateFile = (slug) => path.join(essayDir(slug), 'state.json');

export function loadState(slug) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(slug), 'utf8'));
  } catch {
    return { slug, stage: 'new', hold: false, killed: false, cost_usd: 0, history: [] };
  }
}

export function saveState(slug, patch) {
  const cur = loadState(slug);
  const next = { ...cur, ...patch, slug, updated_at: nowIso() };
  if (patch.stage && patch.stage !== cur.stage) next.history = [...(cur.history ?? []), { stage: patch.stage, at: next.updated_at }];
  fs.mkdirSync(essayDir(slug), { recursive: true });
  fs.writeFileSync(stateFile(slug), JSON.stringify(next, null, 2) + '\n');
  return next;
}

export function addCost(slug, usd) {
  const cur = loadState(slug);
  return saveState(slug, { cost_usd: Math.round(((cur.cost_usd ?? 0) + (usd ?? 0)) * 10000) / 10000 });
}

export function listEssays() {
  if (!fs.existsSync(STAGING)) return [];
  return fs.readdirSync(STAGING, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(stateFile(d.name)))
    .map((d) => loadState(d.name));
}
