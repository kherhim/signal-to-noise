import fs from 'node:fs';
import { runSkill } from './claude.mjs';
import { splitFrontmatter } from './md.mjs';
import { loadConfig } from './queue.mjs';

const SCHEMA = {
  type: 'object', required: ['sentences', 'citations'],
  properties: {
    sentences: { type: 'array', items: { type: 'object', required: ['text', 'hit', 'url'], properties: { text: { type: 'string' }, hit: { type: 'boolean' }, url: { type: 'string' } } } },
    citations: { type: 'array', items: { type: 'object', required: ['quote', 'url', 'verified', 'note'], properties: { quote: { type: 'string' }, url: { type: 'string' }, verified: { type: 'boolean' }, note: { type: 'string' } } } },
  },
};

export function pickSentences(body, n = 8) {
  const prose = body.split('\n').filter((l) => l.trim() && !/^(#|>|-|\d+\.|!\[|\|)/.test(l.trim())).join(' ');
  return prose.replace(/\*\*?|_/g, '').split(/(?<=[.!?])\s+/)
    .map((s) => s.trim()).filter((s) => s.length > 0 && !s.includes(']('))
    .sort((a, b) => b.length - a.length).slice(0, n);
}

export function extractQuotes(body) {
  const out = [];
  for (const m of body.matchAll(/"([^"]{12,})"(?:\s*\(\[[^\]]*\]\((https?:[^)]+)\))?/g)) out.push({ quote: m[1], url: m[2] ?? null });
  for (const m of body.matchAll(/^> ([^\n>][^\n]+)\n(?:>\s*\n)?(?:> — [^\n]*?\[[^\]]*\]\((https?:[^)]+)\))?/gm)) out.push({ quote: m[1].trim(), url: m[2] ?? null });
  return out;
}

export const verdictFrom = (r) => (r.sentences.some((s) => s.hit) || r.citations.some((c) => !c.verified)) ? 'fail' : 'pass';

export function checkPlagiarism(mdPath) {
  const cfg = loadConfig();
  const { body } = splitFrontmatter(fs.readFileSync(mdPath, 'utf8'));
  const sentences = pickSentences(body), citations = extractQuotes(body);
  const out = runSkill({ skill: 'plagiarism', input: JSON.stringify({ sentences, citations }, null, 2), tools: ['WebSearch', 'WebFetch'], schema: SCHEMA, maxTurns: 60, model: cfg.models?.plagiarism ?? null });
  return { verdict: verdictFrom(out.json), ...out.json, cost_usd: out.cost_usd };
}
