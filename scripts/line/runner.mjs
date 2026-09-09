// scripts/line/runner.mjs
import fs from 'node:fs';
import path from 'node:path';
import { log, paused } from './env.mjs';
import { listEssays, loadState, saveState, essayDir, addCost } from './state.mjs';
import { loadConfig } from './queue.mjs';
import { sendMail, findReply } from './mail.mjs';
import { scan, BOARD_JSON } from './scan.mjs';
import { runBrief } from './brief.mjs';
import { runDraft } from './draft.mjs';
import { runGate } from './gate.mjs';
import { makeCover } from './cover.mjs';
import { sendFinal, readFinalReply, applyCorrections, finalSendAllowed } from './final.mjs';
import { publish } from './publish.mjs';

const MAX_FAILURES = 3;

// The day stamped on the last peg board, or null if there isn't one. scan.mjs
// writes it as an ISO (UTC) day, so it is compared the same way.
export function boardDate() {
  try { return JSON.parse(fs.readFileSync(BOARD_JSON, 'utf8')).date ?? null; } catch { return null; }
}

// ISO-8601 week stamp, 'YYYY-Www'. Weeks start on Monday and belong to the year
// that owns their Thursday, so the stamp is the honest "have we briefed this
// week?" key even across a new year.
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // move to the week's Thursday
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - jan1) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Every side-effecting collaborator in one place, so tests can inject fakes and
// no test ever reaches the network, a paid model or the real staging tree.
export const DEFAULT_DEPS = {
  scan, runBrief, runDraft, runGate, makeCover, sendFinal, readFinalReply, applyCorrections,
  publish, findReply, sendMail, listEssays, loadState, saveState, boardDate, addCost, paused,
  readFile: fs.readFileSync,
};

export function nextAction(st, now, cfg) {
  if (st.hold || st.killed) return null;
  switch (st.stage) {
    case 'briefed': return now >= new Date(st.veto_deadline) ? 'check-veto' : null;
    case 'approved': return 'draft';
    case 'drafted': return 'gate';
    case 'gated': return st.gate_verdict === 'pass' ? 'cover' : null;
    case 'covered': return 'send-final';
    case 'final-sending': return finalSendAllowed(st, now) ? 'send-final' : null; // crashed send: retry after the window
    case 'final-sent':
      if (st.approved) return now >= new Date(st.publish_not_before) ? 'publish' : null;
      return 'check-final';
    case 'deploying': case 'deploy-failed': case 'push-failed': return 'publish'; // publish() resumes from its saved state
    default: return null;
  }
}

function notify(deps, subject, text) { try { deps.sendMail({ subject, text }); } catch (e) { log('runner', `notify failed: ${e.message}`); } }

// A reply the runner has already acted on must never be acted on twice: the
// owner clearing `hold` by hand would otherwise be undone by the same old mail.
const freshReply = (r, seen) => (r && r.key && r.key === seen ? null : r);

export function advance(slug, now = new Date(), { dry = false, deps: injected = {} } = {}) {
  const deps = { ...DEFAULT_DEPS, ...injected };
  if (deps.paused()) { log('runner', 'PAUSE present'); return 'paused'; }
  const cfg = loadConfig();
  const st = deps.loadState(slug);
  const action = nextAction(st, now, cfg);
  if (!action) return 'idle';
  if (dry) { log('runner', `DRY ${slug}: would ${action}`); return action; }
  const dir = essayDir(slug);
  try {
    switch (action) {
      case 'check-veto': {
        // Silence-means-go: an unfound/no-reply/already-consumed findReply result
        // approves the essay (Monday brief rule).
        const r = freshReply(deps.findReply({ messageId: st.brief_message_id, token: st.brief_token }), st.brief_reply_seen);
        const seen = r?.key ?? st.brief_reply_seen ?? null;
        if (r?.verdict === 'no') { deps.saveState(slug, { killed: true, stage: 'briefed', veto: r.text, brief_reply_seen: seen }); log('runner', `${slug} killed by owner`); }
        else if (r?.verdict === 'hold') { deps.saveState(slug, { hold: true, veto: r.text, brief_reply_seen: seen }); log('runner', `${slug} held by owner`); }
        else if (r?.verdict === 'text') {
          // Prose on a Monday brief is a rewrite request, not an approval: park it
          // and let the owner decide, rather than drafting against a stale brief.
          deps.saveState(slug, { hold: true, veto: r.text, brief_reply_seen: seen });
          notify(deps, `Parked on your reply: ${st.title ?? slug}`,
            `You replied with text, so the essay is parked. To kill it, set killed: true in its state.json; to proceed with the original brief, clear hold in state.json. Text replies to the Monday brief are never treated as consent.\n\nYour reply:\n${r.text}`);
          log('runner', `${slug} parked on a text reply`);
        }
        else deps.saveState(slug, { stage: 'approved', veto: r?.text ?? st.veto ?? null, brief_reply_seen: seen });
        break;
      }
      case 'draft': deps.runDraft(slug); break;
      case 'gate': {
        const r = deps.runGate({ inPath: path.join(dir, 'draft.md'), outPath: path.join(dir, 'gated.md'), reportPath: path.join(dir, 'gate-report.md') });
        deps.saveState(slug, { stage: 'gated', gate_verdict: r.verdict });
        if (r.verdict === 'fail') notify(deps, `Held at gate: ${st.title}`, r.report);
        break;
      }
      case 'cover': {
        const c = deps.makeCover({ slug, finalPath: path.join(dir, 'gated.md') });
        deps.addCost(slug, c.cost_usd);
        deps.saveState(slug, { stage: 'covered', fig: c.fig, caption: c.caption });
        break;
      }
      case 'send-final': {
        try {
          deps.sendFinal(slug);
        } catch (e) {
          // A previous send is in flight or may have crashed mid-send and the retry
          // window hasn't elapsed yet (finalSendAllowed guards this) — not a failure,
          // just nothing to do on this wake.
          if (e.code === 'FINAL_IN_PROGRESS') {
            log('runner', `${slug}: send-final idle — ${e.message}`);
            return 'idle';
          }
          throw e;
        }
        break;
      }
      case 'check-final': {
        // Silence-means-hold: no reply (or one already consumed) leaves the essay
        // parked in final-sent (Tuesday final rule).
        const r = freshReply(deps.readFinalReply(slug), st.final_reply_seen);
        if (!r) return 'idle'; // nothing new: the poll must not consume this wake (mirrors FINAL_IN_PROGRESS below)
        const seen = r.key ?? null;
        if (r.verdict === 'publish') deps.saveState(slug, { approved: true, approved_at: now.toISOString(), final_reply_seen: seen });
        else if (r.verdict === 'hold' || r.verdict === 'no') deps.saveState(slug, { hold: true, killed: r.verdict === 'no', final_reply_seen: seen });
        else if (r.verdict === 'ok') {
          // 'ok' is not the word that ships. Say so once, and don't ask again.
          deps.saveState(slug, { final_reply_seen: seen });
          notify(deps, `Not shipped: ${st.title ?? slug}`, "Reply 'publish' to ship; 'ok' does nothing. Nothing ships on silence.");
        }
        else if (r.verdict === 'text') {
          const c = deps.applyCorrections(slug, r.text);
          // The key is recorded only once the corrections have landed: if the skill
          // throws, the reply stays unconsumed and the retry cap governs it.
          if (c.verdict === 'pass') { deps.saveState(slug, { stage: 'covered', final_reply_seen: seen }); } // → send-final again on next wake (sendFinal rebuilds final.md from the re-gated file)
          else { deps.saveState(slug, { stage: 'gated', gate_verdict: 'fail', final_reply_seen: seen }); notify(deps, `Held at gate after corrections: ${st.title}`, deps.readFile(path.join(dir, 'gate-report.md'), 'utf8')); }
        }
        break;
      }
      case 'publish': {
        const p = deps.publish(slug);
        notify(deps, `Published: ${st.title}`, `${p.url}\n\nCommit ${p.commit}. Substack mirror follows automatically after 48 h. LinkedIn edition and native post are on Monday's session.`);
        break;
      }
    }
    if (deps.loadState(slug).last_error) deps.saveState(slug, { last_error: null }); // a clean pass clears the streak
    log('runner', `${slug}: ${action} done`);
    return action;
  } catch (e) {
    // Back off rather than mailing the owner on every wake: shout on the first
    // failure, stay quiet, then shout again when the essay is parked.
    const prev = deps.loadState(slug).last_error ?? {};
    const count = prev.action === action ? (prev.count ?? 0) + 1 : 1;
    const park = count >= MAX_FAILURES;
    const speak = count === 1 || park;
    const title = st.title ?? slug;
    const message = String(e.message).slice(0, 500);
    deps.saveState(slug, {
      ...(park ? { hold: true } : {}),
      last_error: { action, message, at: now.toISOString(), count, notified_at: speak ? now.toISOString() : (prev.notified_at ?? null) },
    });
    log('runner', `${slug}: ${action} FAILED (${count}/${MAX_FAILURES}) — ${e.message}`);
    if (park) notify(deps, `Essay line parked: ${title}`, `${slug} parked after ${MAX_FAILURES} failures at ${action}. Clear hold in state.json once the cause is fixed.\n\n${message}`);
    else if (speak) notify(deps, `Essay line failed at ${action}: ${title}`, String(e.message).slice(0, 2000));
    return `error:${action}`;
  }
}

export async function tick({ now = new Date(), dry = false, deps: injected = {} } = {}) {
  const deps = { ...DEFAULT_DEPS, ...injected };
  if (deps.paused()) { log('runner', 'PAUSE present'); return []; }
  const cfg = loadConfig();
  const hour = now.getHours(), day = now.getDay();
  // Both morning gates are windows, not instants: a missed 06:30 wake (laptop
  // asleep, machine off) must still do the day's work when it next comes up.
  if (hour >= 6 && hour < 12 && deps.boardDate() !== now.toISOString().slice(0, 10)) {
    if (dry) log('runner', 'DRY: would scan');
    else { try { await deps.scan(); } catch (e) { log('runner', `scan failed: ${e.message}`); } }
  }
  if (day === 1 && hour >= cfg.brief_hour_local && hour < 12) {
    const week = isoWeek(now);
    const briefedThisWeek = deps.listEssays().some((e) => e.brief_sent_at && isoWeek(new Date(e.brief_sent_at)) === week);
    if (briefedThisWeek) log('runner', `brief already sent in ${week}`);
    // runBrief's own { dry } only skips the email send — it still calls the paid brief
    // skill and writes brief.md before that check, so a --dry tick must not call it at all.
    else if (dry) log('runner', 'DRY: would run the Monday brief');
    else { try { deps.runBrief(); } catch (e) { log('runner', `brief failed: ${e.message}`); notify(deps, 'Essay line: brief failed', e.message); } }
  }
  // One essay per wake. Each action is slow and some cost money; doing them one
  // at a time keeps a wake bounded and a failure isolated to a single essay. A
  // dry tick never spends anything, so it reports every essay's would-be action
  // instead of stopping after the first.
  const took = [];
  for (const e of deps.listEssays()) {
    const action = advance(e.slug, now, { dry, deps });
    if (action === 'idle') continue;
    took.push({ slug: e.slug, action });
    if (!dry) break;
  }
  return took;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const ni = process.argv.indexOf('--now');
  let now = new Date();
  if (ni > 0) {
    const value = process.argv[ni + 1];
    if (Number.isNaN(+new Date(value))) { console.error(`runner: --now needs a parseable date, got ${JSON.stringify(value ?? null)}`); process.exit(2); }
    now = new Date(value);
  }
  await tick({ now, dry: process.argv.includes('--dry') });
}
