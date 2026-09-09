import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, log } from './env.mjs';
import { sendMail, findReply } from './mail.mjs';
import { runGate } from './gate.mjs';
import { runSkill } from './claude.mjs';
import { layerBText } from './layerb.mjs';
import { applySpellingFixes } from './bre.mjs';
import { inspectFile, cleanFile } from './layera.mjs';
import { essayDir, loadState, saveState, addCost, STAGING } from './state.mjs';
import { splitFrontmatter, joinFrontmatter } from './md.mjs';
import { loadConfig, loadNeverList, neverListHits, NEVER } from './queue.mjs';
import { snapshotTree, unexpectedWrites } from './writes.mjs';

export function finalEmailText({ title, final, report }) {
  return [
    `FINAL FOR APPROVAL — ${title}`, '',
    'Reply "publish" to ship Wednesday 08:00 UK. Reply "hold" to park. Reply with corrections in plain prose and I will apply them, re-run the gate and send a fresh final.',
    'No reply means hold. Nothing ships on silence.', '', '────────', '', final, '', '────────', '', report, '',
  ].join('\n');
}

// Wednesday at hourUk, local time: today if today is Wednesday and that hour
// has not yet passed, otherwise the following Wednesday.
export function nextPublishSlot(now, hourUk) {
  const at = new Date(now);
  at.setHours(hourUk, 0, 0, 0);
  const isWednesday = now.getDay() === 3;
  if (isWednesday && now.getTime() < at.getTime()) return at;
  at.setDate(at.getDate() + (isWednesday ? 7 : (3 - now.getDay() + 7) % 7));
  return at;
}

// Local calendar day. `publish_not_before` is stored as an ISO instant, so
// slicing its UTC string would stamp the previous day for an 08:00 UK slot in
// BST. The date on the page is a local calendar date, not an instant.
export const localDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Pure: the frontmatter merge that turns the gated essay into the shipping file.
// The alt is already gated by the time it arrives here, and the date is the
// re-stamped publish day.
export function assembleFinal({ gatedMd, alt, date }) {
  const { meta, body, raw } = splitFrontmatter(gatedMd);
  meta.coverImageAlt = alt;
  meta.date = date;
  return joinFrontmatter(meta, body, raw);
}

// Section 5 is rewritten, never stacked: a resend (or a corrections round)
// rebuilds final.md and must leave one honest record, not a pile of them.
export function withFinalAssembly(report, section) {
  const stripped = String(report).replace(/\n*## 5\. Final assembly[\s\S]*$/, '');
  return `${stripped.replace(/\n+$/, '')}\n\n${section}\n`;
}

// sha256 per path; a path that does not exist hashes to null, so a file the
// skill creates (or deletes) reads as a difference like any other.
export function hashFiles(paths) {
  const out = new Map();
  for (const p of paths) {
    try {
      out.set(p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'));
    } catch {
      out.set(p, null);
    }
  }
  return out;
}

// Everything that could reach the network, a paid model or the watermarks
// service, in one place so the assembly can be tested offline.
export const FINAL_DEPS = { layerBText, applySpellingFixes, inspectFile, cleanFile, loadNeverList, neverListHits };

// The alt text is a shipping string like any other, and until now it was the one
// string that reached the page ungated. It goes through Layer B, then British
// English, then the never-list — and then Layer A runs on the assembled file, so
// that the last thing done to the bytes that ship is the invisible-Unicode
// clean, exactly as the four-check order requires.
export function buildFinal(slug, { deps: injected = {} } = {}) {
  const deps = { ...FINAL_DEPS, ...injected };
  const dir = essayDir(slug);
  const st = loadState(slug);
  const cfg = loadConfig();
  const never = deps.loadNeverList();

  const rawAlt = fs.readFileSync(path.join(dir, 'cover-alt.txt'), 'utf8').trim();
  const rewritten = deps.layerBText(rawAlt, { kind: 'frontmatter coverImageAlt' }).replace(/\s+/g, ' ').trim();
  const bre = deps.applySpellingFixes(rewritten);
  const alt = bre.text;
  const altHits = deps.neverListHits(alt, never);
  if (altHits.length) throw new Error(`cover alt mentions never-list: ${altHits.join(', ')}`);

  const date = localDay(st.publish_not_before ? new Date(st.publish_not_before) : nextPublishSlot(new Date(), cfg.publish_hour_uk));

  const finalPath = path.join(dir, 'final.md');
  fs.writeFileSync(finalPath, assembleFinal({ gatedMd: fs.readFileSync(path.join(dir, 'gated.md'), 'utf8'), alt, date }));

  const before = deps.inspectFile(finalPath);
  if (before.suspicious) deps.cleanFile(finalPath);
  const after = deps.inspectFile(finalPath);
  if (after.suspicious) throw new Error('Layer A: final.md is still suspicious after the clean');

  const hits = deps.neverListHits(fs.readFileSync(finalPath, 'utf8'), never);
  if (hits.length) throw new Error(`final.md mentions never-list: ${hits.join(', ')}`);

  const reportPath = path.join(dir, 'gate-report.md');
  if (fs.existsSync(reportPath)) {
    fs.writeFileSync(reportPath, withFinalAssembly(fs.readFileSync(reportPath, 'utf8'), [
      '## 5. Final assembly',
      `Cover alt — Layer B: ${rewritten === rawAlt ? 'unchanged' : 'rewritten'}`,
      `Cover alt — British English: ${bre.fixed.length ? `fixed ${bre.fixed.join(', ')}` : 'nothing to fix'}`,
      'Cover alt — never-list: clean',
      `Shipping alt: "${alt}"`,
      `Date re-stamped: ${date}${st.publish_not_before ? ' (from publish_not_before)' : ' (next publish slot)'}`,
      `Layer A on final.md — Before: ${before.suspicious ? 'SUSPICIOUS' : 'clean'} · After: ${after.suspicious ? 'SUSPICIOUS' : 'clean'}`,
      'Never-list on the whole of final.md: clean',
    ].join('\n')));
  }
  log('final', `${slug} assembled: date ${date}, alt gated, Layer A last`);
  return finalPath;
}

// Pure: is it safe to (re)send the final email right now? Blocks a resend
// while a previous send is still in flight or may have crashed mid-send,
// unless it has been longer than retryAfterMinutes since it started.
export function finalSendAllowed(state, now, retryAfterMinutes = 60) {
  if (state.stage !== 'final-sending') return true;
  const startedAt = new Date(state.final_sending_at).getTime();
  const elapsedMinutes = (now.getTime() - startedAt) / 60000;
  return elapsedMinutes >= retryAfterMinutes;
}

export function sendFinal(slug) {
  const dir = essayDir(slug), st = loadState(slug);
  if (!finalSendAllowed(st, new Date())) {
    const e = new Error('final send in progress; not resending');
    e.code = 'FINAL_IN_PROGRESS'; // the runner treats this as "nothing to do", not a failure
    throw e;
  }
  const cfg = loadConfig();
  const token = Math.random().toString(36).slice(2, 8);
  // The publish slot is fixed BEFORE the file is assembled, so that the date
  // stamped into the frontmatter and the date the runner will actually publish
  // on are the same one — including on a resend after corrections, when the
  // previous slot may already have passed.
  const pub = nextPublishSlot(new Date(), cfg.publish_hour_uk);
  saveState(slug, { stage: 'final-sending', final_token: token, final_sending_at: new Date().toISOString(), publish_not_before: pub.toISOString(), final_expired_at: null });
  const finalPath = buildFinal(slug);
  const report = fs.readFileSync(path.join(dir, 'gate-report.md'), 'utf8');
  const webp = path.join(ROOT, 'public', 'img', `${slug}.webp`);
  const attachments = fs.existsSync(webp) ? [{ name: `${slug}.webp`, type: 'image/webp', data: fs.readFileSync(webp) }] : [];
  const { messageId } = sendMail({ subject: `Final for approval: ${st.title}`, text: finalEmailText({ title: st.title, final: fs.readFileSync(finalPath, 'utf8'), report }), attachments, token });
  saveState(slug, { stage: 'final-sent', final_message_id: messageId, final_sent_at: new Date().toISOString(), approved: false, final_reply_seen: null });
  log('final', `${slug} final sent`);
  return { messageId };
}

export function readFinalReply(slug) {
  const st = loadState(slug);
  if (!st.final_message_id) return null;
  return findReply({ messageId: st.final_message_id, token: st.final_token });
}

// The staging tree is gitignored, so `git status` cannot see a skill that
// rewrites a *sibling* essay's state or shipping file — the one place a
// corrections prompt could do real damage unseen. Hash them instead.
export function protectedPaths(slug) {
  const paths = [NEVER];
  let names = [];
  try {
    names = fs.readdirSync(STAGING, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch { /* no staging tree yet */ }
  for (const name of names.sort()) {
    if (name === slug) continue;
    paths.push(path.join(STAGING, name, 'state.json'), path.join(STAGING, name, 'final.md'));
  }
  return paths;
}

export function protectedDiff(before, after) {
  const all = new Set([...before.keys(), ...after.keys()]);
  return [...all].filter((p) => (before.get(p) ?? null) !== (after.get(p) ?? null)).sort();
}

export const CORRECTION_DEPS = { runSkill, runGate, snapshotTree };

export function applyCorrections(slug, text, { deps: injected = {} } = {}) {
  const deps = { ...CORRECTION_DEPS, ...injected };
  const dir = essayDir(slug), finalPath = path.join(dir, 'final.md');
  const cfg = loadConfig();
  const before = deps.snapshotTree();
  const guardedBefore = hashFiles(protectedPaths(slug));
  const out = deps.runSkill({ skill: 'corrections', input: `File: ${finalPath}\n\nCorrections:\n${text}`, tools: ['Read', 'Edit'], maxTurns: 20, model: cfg.models?.write ?? null });
  const after = deps.snapshotTree();
  // The essay directory is gitignored, so ANY porcelain change means the
  // skill wrote somewhere it shouldn't have.
  const unexpected = unexpectedWrites(before, after, []);
  if (unexpected.length) throw new Error(`corrections skill touched unexpected files: ${unexpected.join(', ')}`);
  const touched = protectedDiff(guardedBefore, hashFiles(protectedPaths(slug)));
  if (touched.length) throw new Error(`corrections skill touched protected files: ${touched.join(', ')}`);
  addCost(slug, out.cost_usd);
  // Re-gate the corrected file in full (Layer B on everything is the safe default; cost is one Codex pass).
  const gated = path.join(dir, 'gated.md');
  const r = deps.runGate({ inPath: finalPath, outPath: gated, reportPath: path.join(dir, 'gate-report.md') });
  saveState(slug, { corrections: [...(loadState(slug).corrections ?? []), { text, at: new Date().toISOString(), gate: r.verdict }] });
  return { changed: true, verdict: r.verdict };
}
