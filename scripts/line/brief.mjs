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

export function vetoDeadline(now, vetoHour, minLeadHours = 4) {
  const at = new Date(now);
  at.setHours(vetoHour, 0, 0, 0);
  if ((at.getTime() - now.getTime()) / 3600000 < minLeadHours) at.setDate(at.getDate() + 1);
  return at;
}

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

export function runBrief({ dry = false } = {}) {
  if (paused()) { log('brief', 'PAUSE present'); return null; }
  const staged = listEssays();
  if (inFlight(staged)) { log('brief', 'an essay is already in flight; no new brief'); return null; }
  const cfg = loadConfig();
  const board = fs.existsSync(BOARD_JSON) ? JSON.parse(fs.readFileSync(BOARD_JSON, 'utf8')) : { items: [] };
  const topic = pickTopic({ queue: loadQueue(), ledger: loadLedger(), board, cfg });
  const slug = slugify(topic.title);
  if (slugTaken(slug, { published: listPublishedSlugs(), staged })) throw new Error(`slug already taken: ${slug}`);
  const never = loadNeverList();
  const input = `Working title: ${topic.title}\nFamily: ${topic.family}\n${topic.peg ? `Peg: ${topic.peg.headline} — ${topic.peg.url} (score ${topic.peg.score})` : 'Peg: none (evergreen)'}\nNever-list: ${never.join(', ')}\nIdeas file context:\n${fs.readFileSync(path.join(ROOT, 'distribution', 'ARTICLE-IDEAS.md'), 'utf8')}`;
  const out = runSkill({ skill: 'brief', input, tools: ['WebSearch', 'WebFetch'], maxTurns: 40, model: cfg.models?.brief ?? null });
  const brief = String(out.result).trim();
  const hits = neverListHits(brief, never);
  if (hits.length) throw new Error(`brief mentions never-list: ${hits.join(', ')}`);
  fs.mkdirSync(essayDir(slug), { recursive: true });
  fs.writeFileSync(path.join(essayDir(slug), 'brief.md'), brief + '\n');
  const vetoAt = vetoDeadline(new Date(), cfg.veto_hour_local);
  if (dry) { log('brief', `DRY would email brief for ${slug}`); return { slug, brief, messageId: null }; }
  const { messageId, token } = sendMail({ subject: `Brief: ${topic.title}`, text: `${brief}\n\nReply "no" to kill, "hold" to park, or nothing to proceed. Veto closes ${vetoAt.toLocaleString('en-GB')}.` });
  saveState(slug, { stage: 'briefed', title: topic.title, family: topic.family, source: topic.source, peg: topic.peg ?? null, brief_message_id: messageId, brief_token: token, veto_deadline: vetoAt.toISOString(), cost_usd: out.cost_usd });
  if (topic.source === 'queue') markQueue(topic.title, 'briefed');
  log('brief', `${slug} briefed, veto until ${vetoAt.toISOString()}`);
  return { slug, brief, messageId };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const r = runBrief({ dry: process.argv.includes('--dry') });
  if (r) console.log(r.brief);
}
