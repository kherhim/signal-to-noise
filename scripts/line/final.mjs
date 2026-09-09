import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log } from './env.mjs';
import { sendMail, findReply } from './mail.mjs';
import { runGate } from './gate.mjs';
import { runSkill } from './claude.mjs';
import { essayDir, loadState, saveState, addCost } from './state.mjs';
import { splitFrontmatter, joinFrontmatter } from './md.mjs';
import { loadConfig } from './queue.mjs';
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

export function buildFinal(slug) {
  const dir = essayDir(slug);
  const { meta, body, raw } = splitFrontmatter(fs.readFileSync(path.join(dir, 'gated.md'), 'utf8'));
  meta.coverImageAlt = fs.readFileSync(path.join(dir, 'cover-alt.txt'), 'utf8').trim();
  const finalPath = path.join(dir, 'final.md');
  fs.writeFileSync(finalPath, joinFrontmatter(meta, body, raw));
  return finalPath;
}

export function sendFinal(slug) {
  const dir = essayDir(slug), st = loadState(slug);
  const finalPath = buildFinal(slug);
  const report = fs.readFileSync(path.join(dir, 'gate-report.md'), 'utf8');
  const webp = path.join(ROOT, 'public', 'img', `${slug}.webp`);
  const attachments = fs.existsSync(webp) ? [{ name: `${slug}.webp`, type: 'image/webp', data: fs.readFileSync(webp) }] : [];
  const { messageId, token } = sendMail({ subject: `Final for approval: ${st.title}`, text: finalEmailText({ title: st.title, final: fs.readFileSync(finalPath, 'utf8'), report }), attachments });
  const cfg = loadConfig();
  const pub = nextPublishSlot(new Date(), cfg.publish_hour_uk);
  saveState(slug, { stage: 'final-sent', final_message_id: messageId, final_token: token, final_sent_at: new Date().toISOString(), publish_not_before: pub.toISOString(), approved: false });
  log('final', `${slug} final sent`);
  return { messageId };
}

export function readFinalReply(slug) {
  const st = loadState(slug);
  if (!st.final_message_id) return null;
  return findReply({ messageId: st.final_message_id, token: st.final_token });
}

export function applyCorrections(slug, text) {
  const dir = essayDir(slug), finalPath = path.join(dir, 'final.md');
  const input = `File to edit: ${finalPath}\n\nOwner's corrections (apply exactly these, change nothing else, keep frontmatter keys):\n\n${text}`;
  const before = snapshotTree();
  const out = runSkill({ skill: 'write-essay', input: `CORRECTIONS MODE. ${input}`, tools: ['Read', 'Edit'], maxTurns: 20 });
  const after = snapshotTree();
  // The essay directory is gitignored, so ANY porcelain change means the
  // skill wrote somewhere it shouldn't have.
  const unexpected = unexpectedWrites(before, after, []);
  if (unexpected.length) throw new Error(`corrections skill touched unexpected files: ${unexpected.join(', ')}`);
  addCost(slug, out.cost_usd);
  // Re-gate the corrected file in full (Layer B on everything is the safe default; cost is one Codex pass).
  const gated = path.join(dir, 'gated.md');
  const r = runGate({ inPath: finalPath, outPath: gated, reportPath: path.join(dir, 'gate-report.md') });
  saveState(slug, { corrections: [...(loadState(slug).corrections ?? []), { text, at: new Date().toISOString(), gate: r.verdict }] });
  return { changed: true, verdict: r.verdict };
}
