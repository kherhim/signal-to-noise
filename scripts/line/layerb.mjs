import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { log } from './env.mjs';
import { splitFrontmatter, joinFrontmatter, SHIPPING_FIELDS } from './md.mjs';
import { runChild, TIMEOUTS } from './proc.mjs';
import { promptBanText } from './claudish.mjs';
import { loadConfig } from './queue.mjs';

export const LAYERB_MAX_SURVIVAL = 0.35;

// Pinned by the repo since 12 Oct 2026: the global ~/.codex config named a
// model the ChatGPT account no longer accepts and Layer B failed for every
// essay. The repo decides the model; there is no fallback to the global one.
export function layerBModel(cfg = loadConfig()) {
  const m = cfg.models?.layerb;
  if (!m) throw new Error('Layer B: set models.layerb in distribution/line/config.json');
  return m;
}

export const codexArgs = (outFile, model) => {
  if (!model) throw new Error('codexArgs: a model is required');
  return ['exec', '-m', model, '-c', 'service_tier=default', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '-o', outFile];
};

// Share of the original's 3-word runs that survive the rewrite. Runs that
// touch a figure, a proper name, a quotation or a link are left out: those
// are meant to survive. The Layer B prompt asks that "few runs of three words
// survive unchanged"; this measures it.
const EXCLUDE = /\[[^\]]*\]\([^)]*\)|https?:\/\/\S+|"[^"]*"|“[^”]*”/g;
const WORD = /[\p{L}\p{N}%£$€'’.]+/gu;
const words = (s) => (s.match(WORD) ?? []).map((w) => w.replace(/[.]+$/, '').toLowerCase()).filter(Boolean);

function grams(segment) {
  const out = [];
  const toks = [...segment.matchAll(WORD)].map((m) => ({ raw: m[0].replace(/[.]+$/, ''), at: m.index }));
  for (let i = 0; i + 2 < toks.length; i++) {
    const tri = toks.slice(i, i + 3);
    const skip = tri.some((t, j) => {
      if (/[\d%£$€]/.test(t.raw)) return true;
      const sentenceStart = i + j === 0 || /[.!?:]\s*$/.test(segment.slice(0, t.at));
      return /^\p{Lu}/u.test(t.raw) && !sentenceStart;
    });
    if (!skip) out.push(tri.map((t) => t.raw.toLowerCase()).join(' '));
  }
  return out;
}

export function divergence(before, after) {
  const mine = before.split(EXCLUDE).flatMap(grams);
  const w = words(after);
  const theirs = new Set();
  for (let i = 0; i + 2 < w.length; i++) theirs.add(w.slice(i, i + 3).join(' '));
  const survived = mine.filter((g) => theirs.has(g)).length;
  return { survived, total: mine.length, rate: mine.length ? survived / mine.length : 0 };
}

export function buildPrompt(text, kind = 'body') {
  return [
    `Rewrite the ${kind === 'body' ? 'markdown essay' : 'string'} below so that its statistical fingerprint changes while its meaning, structure, facts, figures, quotations, links and citations stay exactly the same.`,
    `Banned constructions, the text is rejected if any appear: ${promptBanText()}.`,
    'Rules: British English spelling and idiom throughout; keep every heading, list, link URL, blockquote and number verbatim; do not change meaning, do not add or remove claims, do not shorten or lengthen by more than 10%; keep the author\'s voice (plain, direct, CFO-to-CFO); no preamble and no commentary, output only the rewritten text.',
    // 23 Sep 2026: "vary sentence openings, clause order" made Layer B the main
    // source of stiff prose. 3 of 3 runs turned "Run the same test on your own
    // company first" into "Your own company should face the same test first".
    // The fingerprint now changes through word choice and sentence joins, never
    // through bent word order.
    'How to change the fingerprint: reword thoroughly, so that apart from figures, names, headings and quotations few runs of three words survive unchanged. Do it with the words themselves: different verbs, nouns and connectives a finance writer would naturally use, and joining or splitting sentences where it reads naturally. Do NOT do it by reordering clauses.',
    'Keep natural word order: whoever acts is the subject, then the verb, then the object. Never front the object, never write "X is what Y does", never turn an active sentence passive. Never give an abstraction or an object a person\'s will (a figure that "deserves", a company that "should face", a question that "lies elsewhere"). Never swing to the reader for effect, never turn a statement into a signpost ("will get you there", "gives you the answer") or an aphorism, and never add drama that is not in the original.',
    'A short plain sentence stays short and plain: change a word or two, or leave it. Read each sentence as one CFO saying it to another; if nobody would say it that way, rewrite it until someone would.',
    '', '<<<', text, '>>>',
  ].join('\n');
}

export function checkOutput(raw, prompt) {
  const result = raw.replace(/^<<<\n?|\n?>>>$/g, '').trim();
  const echoNeedle = prompt.split('\n')[0].slice(0, 60);
  if (result.includes('<<<') || result.includes('>>>') || (echoNeedle && result.includes(echoNeedle))) {
    throw new Error('codex output contains markers or echoes the prompt');
  }
  return result;
}

export function layerBText(text, { kind = 'body' } = {}) {
  const out = path.join(os.tmpdir(), `layerb-${Date.now()}.md`);
  try {
    const prompt = buildPrompt(text, kind);
    const r = runChild('codex', codexArgs(out, layerBModel()), { input: prompt, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }, { timeoutMin: TIMEOUTS.codex, label: 'codex' });
    if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`codex failed (${r.status}): ${(r.stderr || r.stdout).slice(0, 300)}`);
    const result = checkOutput(fs.readFileSync(out, 'utf8'), prompt);
    if (!result || result.length < text.length * 0.6) throw new Error('codex output implausibly short');
    return result;
  } finally {
    if (fs.existsSync(out)) fs.unlinkSync(out);
  }
}

export function layerBEssay(inPath, outPath) {
  const { meta, body, raw } = splitFrontmatter(fs.readFileSync(inPath, 'utf8'));
  let newBody = layerBText(body, { kind: 'body' });
  let d = divergence(body, newBody);
  if (d.rate > LAYERB_MAX_SURVIVAL) {
    log('layerb', `${path.basename(inPath)}: ${(d.rate * 100).toFixed(0)}% of 3-word runs survived; retrying once`);
    const retry = layerBText(body, { kind: 'body' });
    const d2 = divergence(body, retry);
    if (d2.rate < d.rate) { newBody = retry; d = d2; }
  }
  const div = { ...d, warn: d.rate > LAYERB_MAX_SURVIVAL };
  let changed = newBody !== body ? 1 : 0;
  for (const k of SHIPPING_FIELDS) {
    if (typeof meta[k] === 'string' && meta[k].length > 0) {
      const v = layerBText(meta[k], { kind: `frontmatter ${k}` }).replace(/\s+/g, ' ');
      if (v !== meta[k]) { meta[k] = v; changed++; }
    }
  }
  fs.writeFileSync(outPath, joinFrontmatter(meta, newBody, raw));
  log('layerb', `${path.basename(inPath)} → ${path.basename(outPath)}, ${changed} strings changed`);
  return { changed, divergence: div };
}
