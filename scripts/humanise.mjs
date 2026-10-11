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
//   node scripts/humanise.mjs --text "<reply>" [--apply]     # a LinkedIn comment reply
//   pbpaste | node scripts/humanise.mjs --stdin --apply      # same, from the clipboard
//   npm run humanise -- distribution/ready-to-post/600-year-curve.md --apply
//
// Kind defaults to `post` for anything under distribution/ or _sources/social/
// (repurpose.mjs output) and `essay`
// otherwise. Exit code 1 when any file is held, so publish.sh can stop on it.
import fs from 'node:fs';
import path from 'node:path';
import { RULES, POST_RULES, COMMENT_RULES, scanClaudish, claudishFails, renderClaudish } from './line/claudish.mjs';
import { checkHumaniser, renderHumaniser, humaniserFails } from './line/humaniser.mjs';

// A 200-word post cannot be judged on a per-1,000-word rate: one flag is
// already 5/1k. Posts hold on two or more flags and warn on one.
export const POST_HOLD_FLAGS = 2;
// A comment reply is 20-80 words: one machine-sounding sentence is a third of it.
export const COMMENT_HOLD_FLAGS = 1;
const RULES_FOR = { essay: RULES, post: [...RULES, ...POST_RULES], comment: [...RULES, ...COMMENT_RULES] };
const HOLD_AT = { post: POST_HOLD_FLAGS, comment: COMMENT_HOLD_FLAGS };

export const kindFor = (file) => (/(^|\/)(?:distribution|_sources\/social)\//.test(path.relative(process.cwd(), path.resolve(file))) ? 'post' : 'essay');

const splitFm = (md) => {
  const m = md.match(/^---\n[\s\S]*?\n---\n/);
  return m ? { fm: m[0], body: md.slice(m[0].length) } : { fm: '', body: md };
};

// Swap each flagged sentence for its rewrite, in the body only. A flag whose
// rewrite was withheld (it tripped Claudish) or whose sentence no longer
// appears verbatim is left for the owner and reported as unapplied.
const words = (t) => new Set(t.toLowerCase().match(/[a-z0-9%']+/g) ?? []);
const sentences = (t) => t.split(/(?<=[.!?])\s+/).filter(Boolean);

// A rewrite that borrows most of a neighbouring sentence would print the same
// idea twice once swapped in (seen live, 11 Oct 2026). Share of the
// neighbour's words that the rewrite repeats; above this it is not applied.
export const OVERLAP_LIMIT = 0.6;
function duplicatesNeighbour(rewrite, text, sentence) {
  const rw = words(rewrite);
  return sentences(text).some((s) => {
    if (s === sentence || sentence.includes(s)) return false;
    const sw = words(s);
    if (sw.size < 4) return false;
    let shared = 0;
    for (const w of sw) if (rw.has(w)) shared++;
    return shared / sw.size > OVERLAP_LIMIT;
  });
}

// Swap each flagged sentence for its rewrite, in the body only. `DELETE`
// removes the sentence. A flag whose rewrite was withheld (it tripped
// Claudish), whose sentence no longer appears verbatim, or whose rewrite
// would duplicate a neighbouring sentence is left for the owner.
export function applyRewrites(md, flags) {
  const { fm, body } = splitFm(md);
  let out = body;
  const applied = [], unapplied = [];
  for (const f of flags) {
    if (!f.rewrite) { unapplied.push(f); continue; }
    const at = out.indexOf(f.sentence);
    if (at < 0) { unapplied.push(f); continue; }
    if (f.rewrite.trim() === 'DELETE') {
      const end = at + f.sentence.length;
      const tail = out.slice(end).match(/^\s*/)[0].length;
      out = out.slice(0, at) + out.slice(end + tail);
      applied.push(f);
      continue;
    }
    if (duplicatesNeighbour(f.rewrite, out, f.sentence)) { unapplied.push({ ...f, reason: 'duplicates a neighbouring sentence' }); continue; }
    out = out.slice(0, at) + f.rewrite + out.slice(at + f.sentence.length);
    applied.push(f);
  }
  return { md: fm + out.replace(/\s+$/, body.endsWith('\n') ? '\n' : ''), applied, unapplied };
}

// Comment replies are typed, not saved, so they arrive as text. --apply prints
// the rewritten reply instead of writing a file.
export function humaniseText(text, { kind = 'comment', useModel = true, apply = false, check = checkHumaniser } = {}) {
  const r = humaniseBody(text, { kind, useModel, check });
  if (apply && r.read?.flags.length) {
    const a = applyRewrites(text, r.read.flags);
    r.out = { text: a.md, applied: a.applied.length, unapplied: a.unapplied.length };
  }
  return { file: '(reply text)', ...r };
}

function humaniseBody(body, { kind, useModel, check }) {
  const rules = RULES_FOR[kind] ?? RULES;
  const hits = scanClaudish(body, { rules });
  const claudish = claudishFails(hits);
  const read = useModel ? check(body, { kind }) : null;
  const readHolds = read ? (HOLD_AT[kind] ? read.flags.length >= HOLD_AT[kind] : humaniserFails(read)) : false;
  return { kind, hits, claudishFails: claudish.length, read, hold: claudish.length > 0 || readHolds, out: null };
}

export function humaniseFile(file, { kind = kindFor(file), useModel = true, apply = false, check = checkHumaniser } = {}) {
  const md = fs.readFileSync(file, 'utf8');
  const { body } = splitFm(md);
  const rules = RULES_FOR[kind] ?? RULES;
  const hits = scanClaudish(body, { rules });
  const claudish = claudishFails(hits);
  const read = useModel ? check(body, { kind }) : null;
  const readHolds = read ? (HOLD_AT[kind] ? read.flags.length >= HOLD_AT[kind] : humaniserFails(read)) : false;
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
    const at = HOLD_AT[r.kind];
    const note = at ? ` (${r.kind}s hold on ${at}+ flag${at > 1 ? 's' : ''})` : '';
    let txt = renderHumaniser(r.read);
    // The essay header quotes a per-1,000-word threshold; posts hold on a count.
    if (at) txt = txt.replace(/^.*\n/, `${r.read.flags.length >= at ? '❌ HOLD' : r.read.flags.length ? '⚠️ warning only' : '✅'}: ${r.read.flags.length} flags\n`);
    L.push(`### Humaniser read${note}`, txt, '');
  } else {
    L.push('### Humaniser read', 'skipped (--no-model)', '');
  }
  if (r.out?.text !== undefined) L.push('### Rewritten reply', '', r.out.text, '', r.out.unapplied ? `${r.out.unapplied} flag(s) left for you (see above).` : '', 'Claudish hits are not auto-fixed.', '');
  else if (r.out) L.push(`### Rewrite`, `${r.out.applied} sentences rewritten → ${r.out.path}${r.out.unapplied ? `; ${r.out.unapplied} left for you (see above)` : ''}`, 'Diff it against the original before you use it. Claudish hits are not auto-fixed.', '');
  return L.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const args = process.argv.slice(2);
  const ki = args.indexOf('--kind');
  const kind = ki >= 0 ? args[ki + 1] : null;
  const ti = args.indexOf('--text');
  const opts = { useModel: !args.includes('--no-model'), apply: args.includes('--apply') };
  if (ti >= 0 || args.includes('--stdin')) {
    const text = ti >= 0 ? args[ti + 1] : fs.readFileSync(0, 'utf8');
    const r = humaniseText(text, { kind: kind ?? 'comment', ...opts });
    console.log(renderResult(r));
    process.exit(r.hold ? 1 : 0);
  }
  const files = args.filter((a, i) => !a.startsWith('--') && !(ki >= 0 && i === ki + 1));
  if (!files.length) {
    console.error('Usage: node scripts/humanise.mjs <file...> [--kind essay|post] [--apply] [--no-model]\n       node scripts/humanise.mjs --text "<reply>" | --stdin  [--apply] [--no-model]   (comment replies)');
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
