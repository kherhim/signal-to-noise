import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log } from './env.mjs';
import { runSkill } from './claude.mjs';
import { essayDir, loadState, saveState, addCost } from './state.mjs';
import { loadNeverList, neverListHits, loadConfig } from './queue.mjs';
import { splitFrontmatter } from './md.mjs';

const INSIGHTS = path.join(ROOT, 'src', 'content', 'insights');
export const REQUIRED = ['title', 'date', 'excerpt', 'seoDescription', 'tags', 'draft', 'coverImage', 'coverImageAlt', 'coverAnimation'];

export function exemplars(n = 4) {
  const essays = fs.readdirSync(INSIGHTS).filter((f) => f.endsWith('.md')).map((f) => {
    const { meta, body } = splitFrontmatter(fs.readFileSync(path.join(INSIGHTS, f), 'utf8'));
    return { title: meta.title, date: String(meta.date), body };
  }).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, n);
  return essays.map((e) => `### ${e.title} (${e.date})\n\n${e.body.split(/\s+/).slice(0, 600).join(' ')}\n`).join('\n');
}

export const validateFrontmatter = (md) => { const { meta } = splitFrontmatter(md); return REQUIRED.filter((k) => !(k in meta)); };

export function nextWednesday(from = new Date()) {
  const d = new Date(from); d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7)); return d.toISOString().slice(0, 10);
}

export function runDraft(slug) {
  const dir = essayDir(slug), st = loadState(slug);
  const brief = fs.readFileSync(path.join(dir, 'brief.md'), 'utf8');
  const never = loadNeverList();
  const input = [
    `Output directory: ${dir}`, `Slug: ${slug}`, `Publish date: ${nextWednesday()}`,
    `Never-list: ${never.join(', ')}`, `Formatting rules:\n${fs.readFileSync(path.join(ROOT, 'docs', 'specs', 'article-formatting.md'), 'utf8').slice(0, 6000)}`,
    `Brief:\n${brief}`, `Exemplars of the voice:\n${exemplars(4)}`,
  ].join('\n\n');
  const cfg = loadConfig();
  const out = runSkill({ skill: 'write-essay', input, tools: ['WebSearch', 'WebFetch', 'Read', 'Write'], maxTurns: 60, model: cfg.models?.write ?? null });
  const outlinePath = path.join(dir, 'OUTLINE.md'), draftPath = path.join(dir, 'draft.md');
  if (!fs.existsSync(outlinePath) || !fs.existsSync(draftPath)) throw new Error('write-essay skill did not produce OUTLINE.md and draft.md');
  const md = fs.readFileSync(draftPath, 'utf8');
  const missing = validateFrontmatter(md);
  if (missing.length) throw new Error(`draft frontmatter missing: ${missing.join(', ')}`);
  const hits = neverListHits(md, never);
  if (hits.length) throw new Error(`draft mentions never-list: ${hits.join(', ')}`);
  const words = splitFrontmatter(md).body.split(/\s+/).length;
  if (words < 1100 || words > 2100) throw new Error(`draft is ${words} words, outside 1,100–2,100`);
  addCost(slug, out.cost_usd);
  saveState(slug, { stage: 'drafted', words });
  log('draft', `${slug} drafted, ${words} words, $${out.cost_usd.toFixed(3)}`);
  return { outlinePath, draftPath, cost_usd: out.cost_usd };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  console.log(runDraft(process.argv[2]));
}
