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

export function stripMarkup(body) {
  return body
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, '');
}

export function pickSentences(body, n = 8) {
  body = stripMarkup(body);
  const prose = body.split('\n').filter((l) => l.trim() && !/^(#|>|-|\d+\.|!\[|\|)/.test(l.trim())).join(' ');
  return prose.replace(/\*\*?|(?<![\w])_(?=\S)|(?<=\S)_(?![\w])/g, '').split(/(?<=[.!?])\s+/)
    .map((s) => s.trim()).filter((s) => s.length >= 5 && !s.includes(']('))
    .sort((a, b) => b.length - a.length).slice(0, n);
}

export function extractQuotes(body) {
  body = stripMarkup(body);
  const out = [];
  for (const m of body.matchAll(/["“]([^"”\n]{12,})["”](?:\s*\(\[[^\]]*\]\((https?:[^)]+)\))?/g)) out.push({ quote: m[1], url: m[2] ?? null });
  for (const m of body.matchAll(/^(?:>[^\n]*(?:\n|$))+/gm)) {
    const lines = m[0].split('\n').map((l) => l.replace(/^>\s?/, '').trim()).filter(Boolean);
    if (!lines.length) continue;
    // The attribution is the last line when it opens with any dash or "Source:", or, after at
    // least one line of quotation, carries a link. Layer B and the Claudish rewrite strip em
    // dashes, so the dash alone cannot be what pairs a quotation with its source.
    const last = lines[lines.length - 1];
    const link = last.match(/\[[^\]]*\]\((https?:[^)]+)\)/);
    let url = null;
    if (/^(?:—|–|-{1,2})\s|^source:/i.test(last) || (lines.length > 1 && link)) {
      lines.pop();
      url = link?.[1] ?? null;
    } else {
      const tail = last.match(/\s*\(\[[^\]]*\]\((https?:[^)]+)\)\)\.?$/);
      if (tail) { lines[lines.length - 1] = last.slice(0, tail.index); url = tail[1]; }
    }
    if (lines.length) out.push({ quote: lines.join(' '), url });
  }
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
