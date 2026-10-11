#!/usr/bin/env node
// scripts/humanise.mjs
//
// The humaniser for everything that gets posted (owner rule, 11 Oct 2026).
// Until now the Claudish test and the humaniser read ran only inside the essay
// line's gate. Hand-written essays dropped in through publish.sh, LinkedIn feed
// posts, newsletter editions and carousel text shipped unchecked.
//
// Flag, then rewrite. For each file:
//   1. the Claudish test (regex, free, deterministic);
//   2. the humaniser read (a model reads the text against excerpts of the
//      owner's own hand-written essays and quotes each machine-sounding
//      sentence with a plain rewrite);
//   3. with --apply, a copy at <name>.humanised.md with every rewrite swapped
//      in. The original is never touched; the owner diffs and decides.
//
// Usage:
//   node scripts/humanise.mjs <file...> [--kind essay|post] [--apply] [--no-model]
//   npm run humanise -- distribution/ready-to-post/600-year-curve.md --apply
//
// Kind defaults to `post` for anything under distribution/ or _sources/social/
// (repurpose.mjs output) and `essay`
// otherwise. Exit code 1 when any file is held, so publish.sh can stop on it.
import fs from 'node:fs';
import path from 'node:path';
import { RULES, POST_RULES, scanClaudish, claudishFails, renderClaudish } from './line/claudish.mjs';
import { checkHumaniser, renderHumaniser, humaniserFails } from './line/humaniser.mjs';

// A 200-word post cannot be judged on a per-1,000-word rate: one flag is
// already 5/1k. Posts hold on two or more flags and warn on one.
export const POST_HOLD_FLAGS = 2;

export const kindFor = (file) => (/(^|\/)(?:distribution|_sources\/social)\//.test(path.relative(process.cwd(), path.resolve(file))) ? 'post' : 'essay');

const splitFm = (md) => {
  const m = md.match(/^---\n[\s\S]*?\n---\n/);
  return m ? { fm: m[0], body: md.slice(m[0].length) } : { fm: '', body: md };
};

// Swap each flagged sentence for its rewrite, in the body only. A flag whose
// rewrite was withheld (it tripped Claudish) or whose sentence no longer
// appears verbatim is left for the owner and reported as unapplied.
export function applyRewrites(md, flags) {
  const { fm, body } = splitFm(md);
  let out = body;
  const applied = [], unapplied = [];
  for (const f of flags) {
    if (!f.rewrite) { unapplied.push(f); continue; }
    const at = out.indexOf(f.sentence);
    if (at < 0) { unapplied.push(f); continue; }
    out = out.slice(0, at) + f.rewrite + out.slice(at + f.sentence.length);
    applied.push(f);
  }
  return { md: fm + out, applied, unapplied };
}

export function humaniseFile(file, { kind = kindFor(file), useModel = true, apply = false, check = checkHumaniser } = {}) {
  const md = fs.readFileSync(file, 'utf8');
  const { body } = splitFm(md);
  const rules = kind === 'post' ? [...RULES, ...POST_RULES] : RULES;
  const hits = scanClaudish(body, { rules });
  const claudish = claudishFails(hits);
  const read = useModel ? check(body, { kind }) : null;
  const readHolds = read ? (kind === 'post' ? read.flags.length >= POST_HOLD_FLAGS : humaniserFails(read)) : false;
  const hold = claudish.length > 0 || readHolds;
  let out = null;
  if (apply && read?.flags.length) {
    const r = applyRewrites(md, read.flags);
    out = file.replace(/\.md$/, '') + '.humanised.md';
    fs.writeFileSync(out, r.md);
    out = { path: out, applied: r.applied.length, unapplied: r.unapplied.length };
  }
  return { file, kind, hits, claudishFails: claudish.length, read, hold, out };
}

export function renderResult(r) {
  const L = [`## ${r.hold ? '❌ HOLD' : '✅ PASS'} — ${r.file} (${r.kind})`, '', '### Claudish test', renderClaudish(r.hits), ''];
  if (r.read) {
    const note = r.kind === 'post' ? ` (posts hold on ${POST_HOLD_FLAGS}+ flags)` : '';
    let txt = renderHumaniser(r.read);
    // The essay header quotes a per-1,000-word threshold; posts hold on a count.
    if (r.kind === 'post') txt = txt.replace(/^.*\n/, `${r.read.flags.length >= POST_HOLD_FLAGS ? '❌ HOLD' : r.read.flags.length ? '⚠️ warning only' : '✅'}: ${r.read.flags.length} flags\n`);
    L.push(`### Humaniser read${note}`, txt, '');
  } else {
    L.push('### Humaniser read', 'skipped (--no-model)', '');
  }
  if (r.out) L.push(`### Rewrite`, `${r.out.applied} sentences rewritten → ${r.out.path}${r.out.unapplied ? `; ${r.out.unapplied} left for you (see above)` : ''}`, 'Diff it against the original before you use it. Claudish hits are not auto-fixed.', '');
  return L.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const args = process.argv.slice(2);
  const ki = args.indexOf('--kind');
  const kind = ki >= 0 ? args[ki + 1] : null;
  const files = args.filter((a, i) => !a.startsWith('--') && !(ki >= 0 && i === ki + 1));
  if (!files.length) {
    console.error('Usage: node scripts/humanise.mjs <file...> [--kind essay|post] [--apply] [--no-model]');
    process.exit(2);
  }
  let held = 0;
  for (const f of files) {
    const r = humaniseFile(f, { ...(kind ? { kind } : {}), useModel: !args.includes('--no-model'), apply: args.includes('--apply') });
    if (r.hold) held++;
    console.log(renderResult(r));
  }
  if (files.length > 1) console.log(`${held} of ${files.length} held.`);
  process.exit(held ? 1 : 0);
}
