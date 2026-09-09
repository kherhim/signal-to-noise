import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { log } from './env.mjs';
import { splitFrontmatter, joinFrontmatter, SHIPPING_FIELDS } from './md.mjs';

export const codexArgs = (outFile) => ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '-o', outFile];

export function buildPrompt(text, kind = 'body') {
  return [
    `Rewrite the ${kind === 'body' ? 'markdown essay' : 'string'} below so that its statistical fingerprint changes while its meaning, structure, facts, figures, quotations, links and citations stay exactly the same.`,
    'Rules: British English spelling and idiom throughout; keep every heading, list, link URL, blockquote and number verbatim; do not change meaning, do not add or remove claims, do not shorten or lengthen by more than 10%; vary sentence openings, clause order and word choice; keep the author\'s voice (plain, direct, CFO-to-CFO); no preamble and no commentary, output only the rewritten text.',
    '', '<<<', text, '>>>',
  ].join('\n');
}

export function layerBText(text, { kind = 'body' } = {}) {
  const out = path.join(os.tmpdir(), `layerb-${Date.now()}.md`);
  const r = spawnSync('codex', codexArgs(out), { input: buildPrompt(text, kind), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`codex failed (${r.status}): ${(r.stderr || r.stdout).slice(0, 300)}`);
  const result = fs.readFileSync(out, 'utf8').replace(/^<<<\n?|\n?>>>$/g, '').trim();
  fs.unlinkSync(out);
  if (!result || result.length < text.length * 0.6) throw new Error('codex output implausibly short');
  return result;
}

export function layerBEssay(inPath, outPath) {
  const { meta, body, order } = splitFrontmatter(fs.readFileSync(inPath, 'utf8'));
  const newBody = layerBText(body, { kind: 'body' });
  let changed = newBody !== body ? 1 : 0;
  for (const k of SHIPPING_FIELDS) {
    if (typeof meta[k] === 'string' && meta[k].length > 0) {
      const v = layerBText(meta[k], { kind: `frontmatter ${k}` }).replace(/\s+/g, ' ');
      if (v !== meta[k]) { meta[k] = v; changed++; }
    }
  }
  fs.writeFileSync(outPath, joinFrontmatter(meta, newBody, order));
  log('layerb', `${path.basename(inPath)} → ${path.basename(outPath)}, ${changed} strings changed`);
  return { changed };
}
