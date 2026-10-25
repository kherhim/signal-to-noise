// scripts/line/humaniser-learn.mjs
//
// The humaniser learns from the owner's edits, weekly, with his approval
// (owner rule: silence never means consent). Every sentence the owner changed
// between the gate's output and the essay that shipped is evidence of a tell
// the gate missed. A model sorts each change into fact fix, owner taste or
// machine tell; machine tells become proposed register pairs (formal → plain)
// and proposed humaniser tells. Every register pair must survive an evidence
// check against the owner's hand-written essays.
//
// Nothing changes the checker until the owner merges the PR this opens. It
// runs in a throwaway git worktree so the owner's checkout is never touched.
//
//   node scripts/line/humaniser-learn.mjs [--dry] [--since YYYY-MM-DD]
//
// --dry: no model call, no git, no files written; prints the proposals file.
// The repo is public. Gated text is unpublished drafting, so the output only
// ever quotes the published sentence and shows the changed words of the
// before; a shingle filter and the never-list check enforce that.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, log } from './env.mjs';
import { runSkill } from './claude.mjs';
import { runChild, TIMEOUTS } from './proc.mjs';
import { scannableText } from './claudish.mjs';
import { splitFrontmatter } from './md.mjs';
import { loadConfig, loadLedger, loadNeverList, neverListHits } from './queue.mjs';
import { STAGING } from './state.mjs';
import { loadRegister, measureRates, ownerTexts, lineTexts, lineSlugs, pairRegex, OWNER_MAX } from './register.mjs';

export const OWNER_MAX_PER_1K = OWNER_MAX; // register.mjs owns the limit
export const LOOKBACK_DAYS = 8;
const SHINGLE = 5;          // a run of this many unpublished words is a leak
const MAX_HUNK_WORDS = 4;   // a changed-words hunk longer than this is described, not shown
const MAX_BEFORE_WORDS = 8; // owner rule for describing an unpublished before
const MAX_PAIRS = 60;

const REL = {
  insights: 'src/content/insights',
  state: 'distribution/line/humaniser-learn-state.json',
  proposals: 'distribution/line/humaniser-proposals',
  quiet: '_sources/humaniser-learn', // gitignored: no-PR weeks
  register: 'scripts/line/data/register.json',
  skill: '.claude/skills/essay-line/humaniser/SKILL.md',
};

// ---------- text ----------

const SKIP_LINE = /^\s*(?:#|\||!\[|<|\[\^)/;

// Prose sentences of a markdown essay: frontmatter, quotations, code, HTML,
// headings, tables and images out; list markers and emphasis stripped.
export function sentences(md) {
  const body = splitFrontmatter(md).body;
  const text = scannableText(body).split('\n')
    .filter((l) => !SKIP_LINE.test(l))
    .map((l) => l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '').replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1').replace(/[[\]]/g, ''))
    .join('\n');
  return text.split(/\n\s*\n/).flatMap((p) => p.replace(/\s+/g, ' ').trim()
    .split(/(?<=[.!?…](?:["”’)])?)\s+(?=["“‘(]?[A-Z0-9£$€])/))
    .map((s) => s.trim()).filter((s) => words(s).length >= 3);
}

export const words = (s) => s.toLowerCase().replace(/[‘’]/g, "'").match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu) ?? [];
const key = (s) => words(s).join(' ');
const wordCount = (t) => t.split(/\s+/).filter(Boolean).length;

function dice(a, b) {
  const wa = words(a), wb = words(b);
  if (!wa.length || !wb.length) return 0;
  const m = new Map();
  for (const w of wa) m.set(w, (m.get(w) ?? 0) + 1);
  let common = 0;
  for (const w of wb) if (m.get(w) > 0) { common++; m.set(w, m.get(w) - 1); }
  return (2 * common) / (wa.length + wb.length);
}

function lcs(a, b, eq) {
  const n = a.length, m = b.length;
  const t = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    t[i][j] = eq(a[i], b[j]) ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const out = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (eq(a[i], b[j])) { out.push([i, j]); i++; j++; } else if (t[i + 1][j] >= t[i][j + 1]) i++; else j++;
  }
  return out;
}

// Sentence aligner. Identical sentences (by words, so typography and
// punctuation do not count) anchor the alignment; inside each gap between
// anchors, a before is paired in order with its most similar after. Below
// `threshold` it is a deletion, and an unpaired after is an addition.
export function alignSentences(before, after, { threshold = 0.5 } = {}) {
  const anchors = lcs(before, after, (x, y) => key(x) === key(y));
  const changed = [], removed = [], added = [];
  let pi = 0, pj = 0;
  for (const [ai, aj] of [...anchors, [before.length, after.length]]) {
    const gb = before.slice(pi, ai), ga = after.slice(pj, aj);
    const used = new Set();
    let floor = 0;
    for (const b of gb) {
      let best = -1, score = threshold;
      for (let k = floor; k < ga.length; k++) {
        const d = dice(b, ga[k]);
        if (!used.has(k) && d >= score) { best = k; score = d; }
      }
      if (best < 0) { removed.push(b); continue; }
      used.add(best); floor = best + 1;
      changed.push({ before: b, after: ga[best], score: Math.round(score * 100) / 100 });
    }
    ga.forEach((a, k) => { if (!used.has(k)) added.push(a); });
    pi = ai + 1; pj = aj + 1;
  }
  return { same: anchors.length, changed, removed, added };
}

// The words the owner changed, as hunks. Only these, never the before
// sentence, may appear in public output.
export function wordDiff(before, after) {
  const tok = (s) => s.split(/\s+/).filter(Boolean);
  const norm = (w) => words(w).join(' ');
  const a = tok(before), b = tok(after);
  const hunks = [];
  let i = 0, j = 0;
  for (const [ai, bj] of [...lcs(a, b, (x, y) => norm(x) === norm(y)), [a.length, b.length]]) {
    if (ai > i || bj > j) hunks.push({ from: a.slice(i, ai).join(' '), to: b.slice(j, bj).join(' ') });
    i = ai + 1; j = bj + 1;
  }
  return hunks.filter((h) => norm(h.from) !== norm(h.to));
}

// "acquired → bought; the firm → it", or a description when the change is
// too large to show without quoting the draft.
export function describeChange(before, after) {
  const hunks = wordDiff(before, after);
  const removed = hunks.reduce((n, h) => n + words(h.from).length, 0);
  if (hunks.length && removed <= MAX_BEFORE_WORDS && hunks.every((h) => words(h.from).length <= MAX_HUNK_WORDS))
    return hunks.map((h) => `${h.from || '(nothing)'} → ${h.to || '(cut)'}`).join('; ');
  return `sentence rewritten (${removed} of ${words(before).length} words changed)`;
}

// ---------- privacy ----------

const shingles = (s, n = SHINGLE) => { const w = words(s); return w.length < n ? [] : w.slice(0, w.length - n + 1).map((_, i) => w.slice(i, i + n).join(' ')); };

// Runs of SHINGLE words that exist in the unpublished drafts and nowhere in
// the published text. Any output string containing one quotes the draft.
export function unpublishedShingles(befores, publishedText) {
  const pub = new Set(shingles(publishedText));
  return new Set(befores.flatMap((b) => shingles(b)).filter((s) => !pub.has(s)));
}
export const leaks = (text, set) => shingles(text).some((s) => set.has(s));

const neverList = (load) => [...new Set([...load(), 'Axi'])];

// ---------- evidence ----------

function readEssays(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const md = fs.readFileSync(path.join(dir, f), 'utf8');
    const { meta, body } = splitFrontmatter(md);
    return { slug: f.slice(0, -3), meta, md, text: scannableText(body), date: String(meta.date ?? '').slice(0, 10), draft: meta.draft === true };
  }).filter((e) => !e.draft);
}

// The gate output the owner edited from: the newest *.gated.md (by mtime)
// whose prose differs from the published essay. A re-gate run after the
// owner's edits matches what shipped and teaches nothing, so it is passed
// over; if every one matches, the essay had no owner edits ({ same: true }).
// A gated snippet (a chart caption, a paragraph) under MIN_GATED_WORDS is not
// the essay. With no whole *.gated.md: gated.md, else final.md.
const MIN_GATED_WORDS = 200;
const prose = (md) => sentences(md).map(key).join('\n');
export function gatedFile(staging, slug, publishedMd = null) {
  const dir = path.join(staging, slug);
  if (!fs.existsSync(dir)) return null;
  const whole = fs.readdirSync(dir).filter((f) => /^.+\.gated\.md$/.test(f)).map((f) => path.join(dir, f))
    .filter((f) => wordCount(fs.readFileSync(f, 'utf8')) >= MIN_GATED_WORDS)
    .sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs);
  if (whole.length) {
    if (publishedMd === null) return whole[0];
    const pub = prose(publishedMd);
    return whole.find((f) => prose(fs.readFileSync(f, 'utf8')) !== pub) ?? { same: true, checked: whole.length };
  }
  for (const f of ['gated.md', 'final.md']) if (fs.existsSync(path.join(dir, f))) return path.join(dir, f);
  return null;
}

// ---------- model ----------

const SCHEMA = {
  type: 'object', required: ['items'],
  properties: { items: { type: 'array', maxItems: MAX_PAIRS, items: {
    type: 'object', required: ['pair', 'class'],
    properties: {
      pair: { type: 'integer' },
      class: { type: 'string', enum: ['fact', 'taste', 'tell'] },
      tell: { type: 'string' },
      rule: { type: 'string' },
      register: { type: 'array', maxItems: 5, items: { type: 'object', required: ['formal', 'plain'], properties: { formal: { type: 'string' }, plain: { type: 'string' } } } },
    },
  } } },
};

// register.mjs's matcher, so a proposal is judged by the rule that will scan.
const has = (phrase, s) => pairRegex({ formal: phrase }).test(s);

// Keep only what the evidence supports: a real pair, a formal word the owner
// removed and a plain word he put in, a short rule.
export function vetItems(items, pairs) {
  const tells = [], register = [], classes = { fact: 0, taste: 0, tell: 0 }, dropped = [];
  for (const it of items) {
    const p = pairs[it.pair];
    if (!p || !(it.class in classes)) { dropped.push({ ...it, why: 'no such pair' }); continue; }
    classes[it.class]++;
    if (it.class !== 'tell') continue;
    for (const r of it.register ?? []) {
      const formal = (r.formal ?? '').trim().toLowerCase(), plain = (r.plain ?? '').trim().toLowerCase();
      if (!formal || !plain || formal === plain || words(formal).length > 3 || words(plain).length > 4) { dropped.push({ pair: it.pair, why: 'malformed register pair' }); continue; }
      if (!has(formal, p.before) || has(formal, p.after) || !has(plain, p.after)) { dropped.push({ pair: it.pair, why: `"${formal} → ${plain}" is not the owner's edit` }); continue; }
      register.push({ formal, plain, pair: it.pair });
    }
    const tell = (it.tell ?? '').trim(), rule = (it.rule ?? '').trim();
    if (tell && rule && words(tell).length <= 8 && words(rule).length <= 30) tells.push({ tell, rule, pair: it.pair });
  }
  return { tells, register, classes, dropped };
}

// ---------- register.json ----------

export function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

// Kept pairs keep every field (forms, except, source); only their rates are
// refreshed when re-measured.
export function applyRegister(reg, { add, drop, rates = {}, today }) {
  const gone = new Set(drop.map((d) => d.formal));
  return { ...reg, updated: today, pairs: [...reg.pairs.filter((p) => !gone.has(p.formal)).map((p) => ({ ...p, ...(rates[p.formal] ?? {}) })),
    ...add.map((a) => ({ formal: a.formal, plain: a.plain, owner_per_1k: a.owner_per_1k, line_per_1k: a.line_per_1k, source: 'learned' }))] };
}

// Learned tells sit inside the humaniser prompt, before its closing JSON
// instruction, so that instruction stays last.
export function appendTells(skillMd, bullets) {
  const lines = skillMd.split('\n');
  const head = lines.findIndex((l) => /^## Learned tells\s*$/.test(l));
  const closing = lines.findIndex((l) => /^Return only the JSON/.test(l));
  if (head < 0) {
    const at = closing < 0 ? lines.length : closing;
    lines.splice(at, 0, '## Learned tells', '', 'Proposed by the weekly learn job from the owner\'s edits; each one is live because the owner merged it. Flag these as you flag the tells above.', '', ...bullets, '');
    return lines.join('\n');
  }
  let end = lines.findIndex((l, i) => i > head && (/^## /.test(l) || /^Return only the JSON/.test(l)));
  if (end < 0) end = lines.length;
  while (end > head + 1 && lines[end - 1].trim() === '') end--;
  lines.splice(end, 0, ...bullets);
  return lines.join('\n');
}

// ---------- the run ----------

const r2 = (x) => Math.round(x * 100) / 100;
const isoDay = (d) => d.toISOString().slice(0, 10);
const addDays = (day, n) => isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000));

function sh(cmd, args, opts = {}) {
  const slow = cmd === 'gh' || args.includes('push') || args.includes('fetch');
  const r = runChild(cmd, args, { encoding: 'utf8', ...opts }, { timeoutMin: slow ? TIMEOUTS.publish : TIMEOUTS.git, label: `${cmd} ${args.find((a) => !a.startsWith('-') && !a.includes('/')) ?? ''}`.trim() });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(' ')} exited ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 300)}`);
  return r.stdout ?? '';
}

function notify(msg) {
  const q = (s) => `"${String(s).replace(/[\\"]/g, '\\$&')}"`;
  try { runChild('osascript', ['-e', `display notification ${q(msg)} with title "Humaniser learn"`], {}, { timeoutMin: 1 }); } catch { /* a notification must never fail the job */ }
}

// Every side-effecting collaborator, so tests reach no network, model or git.
export const LEARN_DEPS = { runSkill, sh, notify, loadLedger, loadNeverList, neverListHits, loadConfig, now: () => new Date() };

export function runLearn({ dry = false, since = null, root = ROOT, staging = STAGING, deps: injected = {} } = {}) {
  const deps = { ...LEARN_DEPS, ...injected };
  const today = isoDay(deps.now());
  const branch = `humaniser-learn-${today}`;
  const never = neverList(deps.loadNeverList);
  let wt = null, prUrl = null;
  try {
    // Base = origin/main in a throwaway worktree; a dry run reads the checkout.
    let base = root;
    if (!dry) {
      deps.sh('git', ['-C', root, 'fetch', '-q', 'origin', 'main']);
      if (deps.sh('git', ['-C', root, 'branch', '--list', branch]).trim() || deps.sh('git', ['-C', root, 'ls-remote', '--heads', 'origin', branch]).trim())
        throw new Error(`branch ${branch} already exists; today's proposals were already made`);
      wt = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'humaniser-learn-')), 'wt');
      deps.sh('git', ['-C', root, 'worktree', 'prune']); // a crashed run's registration
      deps.sh('git', ['-C', root, 'worktree', 'add', '-q', '-b', branch, wt, 'origin/main']);
      base = wt;
    }
    const state = readJson(path.join(base, REL.state)) ?? { last_run: null, learned: [] };
    const from = since ?? state.last_run ?? addDays(today, -LOOKBACK_DAYS);

    // 1. Published essays in the window, and the gated text that preceded them.
    const essays = readEssays(path.join(base, REL.insights)); // what is on main, not the checkout
    const lineWritten = lineSlugs({ staging, ledger: deps.loadLedger() });
    const notes = [], pairs = [], drafts = [];
    const inWindow = essays.filter((e) => e.date > from && e.date <= today);
    for (const e of inWindow) {
      const marker = path.join(staging, e.slug, 'humaniser-learn.json');
      if (!since && fs.existsSync(marker)) { notes.push(`${e.slug}: already learned from (${path.basename(marker)}); pass --since to redo`); continue; }
      const g = gatedFile(staging, e.slug, e.md);
      if (!g) { notes.push(`${e.slug}: no gate output in staging; skipped`); continue; }
      if (g.same) { notes.push(`${e.slug}: no owner edits (all ${g.checked} gated versions match the published text)`); continue; }
      const gated = sentences(fs.readFileSync(g, 'utf8'));
      drafts.push(...gated);
      const a = alignSentences(gated, sentences(e.md));
      const real = a.changed.filter((c) => key(c.before) !== key(c.after));
      notes.push(`${e.slug}: ${path.basename(g)} vs published: ${a.same} unchanged, ${real.length} changed, ${a.removed.length} cut, ${a.added.length} added`);
      for (const c of real) pairs.push({ slug: e.slug, ...c, change: describeChange(c.before, c.after) });
    }
    const evidence = pairs.slice(0, MAX_PAIRS);
    if (pairs.length > MAX_PAIRS) notes.push(`${pairs.length - MAX_PAIRS} further edits not sent to the model (cap ${MAX_PAIRS})`);
    const publishedText = essays.map((e) => e.text).join('\n');
    // Every gated sentence counts as secret, not only the ones sent as evidence.
    const secret = unpublishedShingles(drafts, publishedText);
    const safe = (s) => !leaks(s, secret) && !deps.neverListHits(s, never).length;
    // A changed-words line that still carries a draft run is described instead.
    for (const p of evidence) if (!safe(p.change)) p.change = `sentence rewritten (${words(p.before).length} words before)`;

    // 2. The model sorts the changes. Skipped in a dry run (no spend).
    const regPath = path.join(base, REL.register);
    const reg = fs.existsSync(regPath) ? loadRegister(regPath) : null;
    let vet = { tells: [], register: [], classes: { fact: 0, taste: 0, tell: 0 }, dropped: [] }, cost = 0;
    if (evidence.length && !dry) {
      const skill = fs.readFileSync(path.join(base, REL.skill), 'utf8');
      const out = deps.runSkill({ skill: 'humaniser-learn', schema: SCHEMA, maxTurns: 5, model: deps.loadConfig().models?.humaniser ?? null,
        input: JSON.stringify({ existing_tells: skill, existing_register: (reg?.pairs ?? []).map((p) => `${p.formal} → ${p.plain}`), pairs: evidence.map((p, i) => ({ pair: i, before: p.before, after: p.after })) }, null, 2) });
      cost = out.cost_usd ?? 0;
      vet = vetItems(out.json?.items ?? [], evidence);
    }

    // 3. Evidence check on the owner's hand-written essays.
    // Same corpora and matcher as `register.mjs measure`.
    const owner = ownerTexts({ dir: path.join(base, REL.insights), exclude: lineWritten });
    const line = lineTexts(path.dirname(staging));
    const rate = (texts, pairs) => { const r = measureRates(texts, pairs); return (f) => r2(r[f] ?? 0); };
    const covered = (f) => (reg?.pairs ?? []).some((p) => pairRegex(p).test(f));
    const addReg = [], rejected = [];
    for (const r of vet.register) {
      if (covered(r.formal) || addReg.some((a) => a.formal === r.formal)) continue;
      const cand = { ...r, owner_per_1k: rate(owner, [r])(r.formal), line_per_1k: rate(line, [r])(r.formal) };
      if (!safe(`${r.formal} ${r.plain}`)) rejected.push({ formal: '(withheld)', why: 'privacy or never-list' });
      else if (cand.owner_per_1k > OWNER_MAX_PER_1K) rejected.push({ ...cand, why: `owner uses it ${cand.owner_per_1k}/1k (limit ${OWNER_MAX_PER_1K})` });
      else addReg.push(cand);
    }
    const oNow = rate(owner, reg?.pairs ?? []), lNow = line.length ? rate(line, reg?.pairs ?? []) : null;
    const remeasured = (reg?.pairs ?? []).map((p) => ({ ...p, owner_now: oNow(p.formal), line_now: lNow ? lNow(p.formal) : p.line_per_1k }));
    const dropReg = remeasured.filter((p) => p.owner_now > OWNER_MAX_PER_1K);

    const addTells = [], seenTell = new Set();
    for (const t of vet.tells) {
      const k = t.tell.toLowerCase();
      if (seenTell.has(k)) continue;
      if (!safe(`${t.tell}. ${t.rule}`)) { rejected.push({ formal: '(withheld tell)', why: 'tell text quoted the unpublished draft or a never-listed name' }); continue; }
      seenTell.add(k);
      const p = evidence[t.pair];
      addTells.push({ ...t, example: `as published: "${p.after}" (owner changed: ${p.change})` });
    }
    const count = addReg.length + dropReg.length + addTells.length;

    // 4. The proposals file. Only published sentences and changed words.
    const md = renderProposals({ today, from, notes, evidence, vet, addReg, dropReg, remeasured, addTells, rejected, regMissing: !reg, dry, cost });
    if (leaks(md, secret)) throw new Error('privacy check failed: the proposals file quotes unpublished draft text; nothing written');
    const hits = deps.neverListHits(md, never);
    if (hits.length) throw new Error(`never-list check failed (${hits.length} hit${hits.length > 1 ? 's' : ''}); nothing written`);
    if (dry) return { dry: true, md, count, evidence: evidence.length, notes };

    const rel = path.join(REL.proposals, `${today}.md`);
    const markers = (where) => inWindow.forEach((e) => { const d = path.join(staging, e.slug); if (gatedFile(staging, e.slug)) fs.writeFileSync(path.join(d, 'humaniser-learn.json'), JSON.stringify({ learned_at: today, proposals: where }, null, 2) + '\n'); });
    if (!count) {
      // No PR: the file goes to gitignored _sources, never loose in the checkout.
      const local = path.join(REL.quiet, `${today}.md`);
      fs.mkdirSync(path.join(root, REL.quiet), { recursive: true });
      fs.writeFileSync(path.join(root, local), md);
      markers(local);
      log('learn', `nothing to propose (${evidence.length} changed sentences); wrote ${local}, no PR`);
      deps.notify(`Nothing to propose this week (${evidence.length} owner edits read).`);
      return { md, count, pr: null };
    }

    // 5. Apply on the branch, commit, push, open the PR. Never merge.
    fs.mkdirSync(path.join(wt, REL.proposals), { recursive: true });
    fs.writeFileSync(path.join(wt, rel), md);
    const touched = [rel];
    if (reg && (addReg.length || dropReg.length)) {
      const rates = Object.fromEntries(remeasured.map((p) => [p.formal, { owner_per_1k: p.owner_now, line_per_1k: p.line_now }]));
      fs.writeFileSync(regPath, JSON.stringify(applyRegister(reg, { add: addReg, drop: dropReg, rates, today }), null, 2) + '\n');
      touched.push(REL.register);
    }
    if (addTells.length) {
      const skillPath = path.join(wt, REL.skill);
      fs.writeFileSync(skillPath, appendTells(fs.readFileSync(skillPath, 'utf8'), addTells.map((t) => `- **${t.tell}** (${today}): ${t.rule} Example, ${t.example}`)));
      touched.push(REL.skill);
    }
    fs.writeFileSync(path.join(wt, REL.state), JSON.stringify({ last_run: today, learned: [...new Set([...(state.learned ?? []), ...inWindow.map((e) => e.slug)])] }, null, 2) + '\n');
    touched.push(REL.state);
    const title = `Humaniser weekly proposals ${today}`;
    const body = [`Proposals from the owner's edits to essays published ${from} to ${today}: ${addReg.length} register additions, ${dropReg.length} register drops, ${addTells.length} new tells.`, '',
      `Evidence and rejected candidates: \`${rel}\`.`, '', 'Merge to approve. Close to reject. Nothing changes the checker until this is merged; silence changes nothing.'].join('\n');
    if (!safe(body)) throw new Error('privacy check failed on the PR body');
    deps.sh('git', ['-C', wt, 'add', ...touched]);
    deps.sh('git', ['-C', wt, 'commit', '-q', '-m', `${title}\n\n${body}`]);
    deps.sh('git', ['-C', wt, 'push', '-q', '-u', 'origin', branch]);
    prUrl = deps.sh('gh', ['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body', body], { cwd: wt }).trim();
    markers(rel);
    log('learn', `${count} proposals; PR ${prUrl} ($${cost.toFixed(3)})`);
    deps.notify(`${count} proposals to review: ${prUrl}`);
    return { md, count, pr: prUrl };
  } catch (err) {
    log('learn', `ERROR: ${err.message}`);
    if (!dry) deps.notify(`Humaniser learn failed: ${String(err.message).slice(0, 120)}`);
    throw err;
  } finally {
    if (wt) {
      try { deps.sh('git', ['-C', root, 'worktree', 'remove', '--force', wt]); } catch { /* best effort */ }
      fs.rmSync(path.dirname(wt), { recursive: true, force: true });
      try { deps.sh('git', ['-C', root, 'branch', '-D', branch]); } catch { /* never created; a pushed branch lives on origin */ }
    }
  }
}

export function renderProposals({ today, from, notes, evidence, vet, addReg, dropReg, remeasured, addTells, rejected, regMissing, dry, cost }) {
  const L = [`# Humaniser proposals ${today}`, '',
    `Essays published after ${from} up to ${today}. Before-text is unpublished drafting, so only the published sentence and the changed words appear here.`, ''];
  if (dry) L.push('**Dry run:** no model call, so no classification or proposals.', '');
  L.push('## Essays read', '', ...(notes.length ? notes.map((n) => `- ${n}`) : ['- None published in the window.']), '');
  L.push('## Owner edits (evidence)', '');
  if (!evidence.length) L.push('No changed sentences.', '');
  else {
    if (!dry) L.push(`Model sorting: ${vet.classes.fact} fact fixes, ${vet.classes.taste} owner taste, ${vet.classes.tell} machine tells${cost ? ` ($${cost.toFixed(3)})` : ''}.`, '');
    evidence.forEach((p, i) => L.push(`${i}. ${p.slug}: "${p.after}"`, `   Changed: ${p.change}`));
    L.push('');
  }
  const total = addReg.length + dropReg.length + addTells.length;
  L.push('## Proposed', '', total ? `${total} change${total > 1 ? 's' : ''}. Merge the PR to approve, close it to reject.` : 'Nothing to propose. No PR opened.', '');
  if (addReg.length) {
    L.push(`### Register additions${regMissing ? ' (NOT applied: scripts/line/data/register.json is missing on main)' : ''}`, '', '| formal | plain | owner /1k | line /1k | evidence |', '|---|---|---|---|---|',
      ...addReg.map((r) => `| ${r.formal} | ${r.plain} | ${r.owner_per_1k} | ${r.line_per_1k} | edit ${r.pair} |`), '');
  }
  if (dropReg.length) L.push('### Register drops (owner rate now above the limit)', '', ...dropReg.map((p) => `- ${p.formal} → ${p.plain}: owner ${p.owner_now}/1k (was ${p.owner_per_1k}), line ${p.line_now}/1k`), '');
  if (addTells.length) L.push('### New humaniser tells', '', ...addTells.map((t) => `- **${t.tell}**: ${t.rule}\n  Example, ${t.example}`), '');
  if (rejected.length) L.push('## Rejected candidates', '', ...rejected.map((r) => `- ${r.formal}${r.plain ? ` → ${r.plain}` : ''}: ${r.why}`), '');
  if (vet.dropped.length) L.push(`(${vet.dropped.length} model suggestions dropped as unsupported by the edit.)`, '');
  if (remeasured.length) L.push('## Register re-measured', '', '| formal | owner /1k | line /1k |', '|---|---|---|', ...remeasured.map((p) => `| ${p.formal} | ${p.owner_now} | ${p.line_now} |`), '');
  else if (regMissing) L.push('## Register re-measured', '', 'scripts/line/data/register.json is not on main yet; nothing to re-measure.', '');
  return L.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const si = process.argv.indexOf('--since');
  const since = si > 0 ? process.argv[si + 1] : null;
  if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) { console.error('--since takes YYYY-MM-DD'); process.exit(2); }
  try {
    const r = runLearn({ dry: process.argv.includes('--dry'), since });
    if (r.dry) console.log(r.md);
    else console.log(r.pr ? `PR: ${r.pr}` : 'Nothing to propose; no PR.');
  } catch { process.exit(1); }
}
