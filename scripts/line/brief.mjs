// scripts/line/brief.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log, paused } from './env.mjs';
import { runSkill } from './claude.mjs';
import { sendMail } from './mail.mjs';
import { saveState, essayDir, listEssays } from './state.mjs';
import { loadConfig, loadQueue, loadLedger, loadNeverList, neverListHits, markQueue } from './queue.mjs';
import { BOARD_JSON } from './scan.mjs';

export const slugify = (t) => t.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const CONTENT_INSIGHTS = path.join(ROOT, 'src', 'content', 'insights');

export const inFlight = (essays) => essays.some((e) => e.stage !== 'published' && !e.killed && !e.hold);

export const slugTaken = (slug, { published, staged }) =>
  published.includes(slug) || staged.some((e) => e.slug === slug && !e.killed);

function listPublishedSlugs() {
  try {
    return fs.readdirSync(CONTENT_INSIGHTS).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  } catch { return []; }
}

export function pickTopic({ queue, ledger, board, cfg, today = new Date().toISOString().slice(0, 10) }) {
  const preemptOn = cfg.preempt && today >= cfg.calibration_until;
  const lastFamily = [...ledger.published].sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.family ?? null;
  if (preemptOn) {
    const peg = board.items.filter((i) => (i.action === 'preempt' || i.action === 'fast_piece') && i.corpus_fit >= cfg.thresholds.min_fit_to_preempt)
      .sort((a, b) => b.score - a.score)[0];
    if (peg) {
      const q = queue.find((x) => x.title === peg.maps_to) ?? (peg.proposed_title ? { title: peg.proposed_title, family: 'proposed', trigger: null, status: 'proposed' } : null);
      if (q) return { ...q, source: 'peg', peg };
    }
  }
  const eligible = queue.filter((q) => q.status === 'queued');
  const pick = eligible.find((q) => q.family !== lastFamily) ?? eligible[0];
  if (!pick) throw new Error('queue empty');
  return { ...pick, source: 'queue', peg: null };
}

// A topic named by the owner, resolved across the pools the shortlist ranks.
// The board is searched first: a peg carries the number, the date and the
// scanner's note, and briefing a pegged topic as if it were evergreen throws
// all three away. A title that matches nothing is an error, never a silent
// evergreen fallback.
export function resolveTopic(title, { board, queue }) {
  const want = title.trim().toLowerCase();
  const peg = board.items?.find((i) => [i.proposed_title, i.maps_to].some((t) => (t ?? '').trim().toLowerCase() === want));
  const q = queue.find((x) => x.title.trim().toLowerCase() === want);
  if (peg) return { title: q?.title ?? peg.proposed_title ?? peg.maps_to, family: q?.family ?? 'proposed', trigger: q?.trigger ?? null, status: q?.status ?? 'proposed', source: q ? 'queue' : 'peg', peg };
  if (q) return { ...q, source: 'queue', peg: null };
  throw new Error(`no topic titled ${JSON.stringify(title)} on the peg board or in the queue`);
}

export function runBrief({ dry = false, topic: chosen = null, ownerNote = null } = {}) {
  if (paused()) { log('brief', 'PAUSE present'); return null; }
  const staged = listEssays();
  if (inFlight(staged)) { log('brief', 'an essay is already in flight; no new brief'); return null; }
  const cfg = loadConfig();
  const board = fs.existsSync(BOARD_JSON) ? JSON.parse(fs.readFileSync(BOARD_JSON, 'utf8')) : { items: [] };
  // A topic supplied by the owner (the shortlist pick) skips the automatic
  // choice entirely; pickTopic remains the unattended path.
  const topic = chosen ?? pickTopic({ queue: loadQueue(), ledger: loadLedger(), board, cfg });
  const slug = slugify(topic.title);
  if (slugTaken(slug, { published: listPublishedSlugs(), staged })) throw new Error(`slug already taken: ${slug}`);
  // A dry run spends nothing and writes nothing: the decision to be inspected is
  // which topic was picked, and that is already made.
  if (dry) { log('brief', `DRY would brief ${slug} (${topic.title}) — no skill call, no email`); return { slug, title: topic.title, brief: null, messageId: null }; }
  const never = loadNeverList();
  // Owner notes are typed by hand and go straight into the skill prompt, so
  // they are checked on the way in as well as on the way out: the outbound
  // check only sees what the model chose to repeat.
  const noteHits = ownerNote ? neverListHits(ownerNote, never) : [];
  if (noteHits.length) throw new Error(`owner note mentions never-list: ${noteHits.join(', ')}`);
  // The scanner's note holds what the headline does not — corroborating figures,
  // how firm the terms are, and any disclosure the essay owes the reader. It is
  // written nowhere else, so it has to travel with the peg.
  const peg = topic.peg
    ? `Peg: ${topic.peg.headline} — ${topic.peg.url} (score ${topic.peg.score}, ${topic.peg.source ?? 'source unknown'}, ${topic.peg.date})${topic.peg.note ? `\nPeg note: ${topic.peg.note}` : ''}`
    : 'Peg: none (evergreen)';
  const input = [
    `Working title: ${topic.title}`, `Family: ${topic.family}`, peg, `Never-list: ${never.join(', ')}`,
    ...(ownerNote ? [`Owner notes — these are instructions, not context:\n${ownerNote}`] : []),
    `Ideas file context:\n${fs.readFileSync(path.join(ROOT, 'distribution', 'ARTICLE-IDEAS.md'), 'utf8')}`,
  ].join('\n');
  const out = runSkill({ skill: 'brief', input, tools: ['WebSearch', 'WebFetch'], maxTurns: 40, model: cfg.models?.brief ?? null });
  const brief = String(out.result).trim();
  const hits = neverListHits(brief, never);
  if (hits.length) throw new Error(`brief mentions never-list: ${hits.join(', ')}`);
  fs.mkdirSync(essayDir(slug), { recursive: true });
  fs.writeFileSync(path.join(essayDir(slug), 'brief.md'), brief + '\n');
  // Persist the intent to send BEFORE sending. A crash inside sendMail would
  // otherwise leave no state at all: the next wake would see no essay in flight,
  // pick the same topic and pay for a second brief — and the owner might get two
  // emails for one essay. `brief-sending` needs a human, and says so.
  saveState(slug, { stage: 'brief-sending', brief_sending_at: new Date().toISOString(), title: topic.title, family: topic.family, source: topic.source, cost_usd: out.cost_usd });
  const { messageId, token } = sendMail({ subject: `Brief: ${topic.title}`, text: `${brief}\n\nReply "go" to proceed, "no" to kill, "hold" to park. Nothing happens on silence.` });
  saveState(slug, { stage: 'briefed', title: topic.title, family: topic.family, source: topic.source, peg: topic.peg ?? null, brief_message_id: messageId, brief_token: token, brief_sent_at: new Date().toISOString(), cost_usd: out.cost_usd });
  if (topic.source === 'queue') markQueue(topic.title, 'briefed');
  log('brief', `${slug} briefed; waiting for "go"`);
  return { slug, brief, messageId };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const arg = (flag) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] ?? null : null; };
  const title = arg('--topic');
  const board = fs.existsSync(BOARD_JSON) ? JSON.parse(fs.readFileSync(BOARD_JSON, 'utf8')) : { items: [] };
  const topic = title ? resolveTopic(title, { board, queue: loadQueue() }) : null;
  const r = runBrief({ dry: process.argv.includes('--dry'), topic, ownerNote: arg('--note') });
  if (r?.brief) console.log(r.brief);
}
