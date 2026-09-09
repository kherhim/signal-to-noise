// scripts/line/runner.mjs
import fs from 'node:fs';
import path from 'node:path';
import { log, paused } from './env.mjs';
import { listEssays, loadState, saveState, essayDir, addCost } from './state.mjs';
import { loadConfig } from './queue.mjs';
import { sendMail, findReply } from './mail.mjs';
import { scan } from './scan.mjs';
import { runBrief } from './brief.mjs';
import { runDraft } from './draft.mjs';
import { runGate } from './gate.mjs';
import { makeCover } from './cover.mjs';
import { sendFinal, readFinalReply, applyCorrections, finalSendAllowed } from './final.mjs';
import { publish } from './publish.mjs';

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

function notify(subject, text) { try { sendMail({ subject, text }); } catch (e) { log('runner', `notify failed: ${e.message}`); } }

export function advance(slug, now = new Date(), { dry = false } = {}) {
  const cfg = loadConfig();
  const st = loadState(slug);
  const action = nextAction(st, now, cfg);
  if (!action) return 'idle';
  if (dry) { log('runner', `DRY ${slug}: would ${action}`); return action; }
  const dir = essayDir(slug);
  try {
    switch (action) {
      case 'check-veto': {
        // Silence-means-go: an unfound/no-reply findReply result approves the essay (Monday brief rule).
        const r = findReply({ messageId: st.brief_message_id, token: st.brief_token });
        if (r?.verdict === 'no') { saveState(slug, { killed: true, stage: 'briefed', veto: r.text }); log('runner', `${slug} killed by owner`); }
        else if (r?.verdict === 'hold') { saveState(slug, { hold: true, veto: r.text }); log('runner', `${slug} held by owner`); }
        else saveState(slug, { stage: 'approved', veto: r?.text ?? null });
        break;
      }
      case 'draft': runDraft(slug); break;
      case 'gate': {
        const r = runGate({ inPath: path.join(dir, 'draft.md'), outPath: path.join(dir, 'gated.md'), reportPath: path.join(dir, 'gate-report.md') });
        saveState(slug, { stage: 'gated', gate_verdict: r.verdict });
        if (r.verdict === 'fail') notify(`Held at gate: ${st.title}`, r.report);
        break;
      }
      case 'cover': {
        const c = makeCover({ slug, finalPath: path.join(dir, 'gated.md') });
        addCost(slug, c.cost_usd);
        saveState(slug, { stage: 'covered', fig: c.fig, caption: c.caption });
        break;
      }
      case 'send-final': {
        try {
          sendFinal(slug);
        } catch (e) {
          // A previous send is in flight or may have crashed mid-send and the retry
          // window hasn't elapsed yet (finalSendAllowed guards this) — not a failure,
          // just nothing to do on this wake.
          if (e.message === 'final send in progress; not resending') {
            log('runner', `${slug}: send-final idle — ${e.message}`);
            return 'idle';
          }
          throw e;
        }
        break;
      }
      case 'check-final': {
        // Silence-means-hold: no reply leaves the essay parked in final-sent (Tuesday final rule).
        const r = readFinalReply(slug);
        if (!r) break;
        if (r.verdict === 'publish') saveState(slug, { approved: true, approved_at: now.toISOString() });
        else if (r.verdict === 'hold' || r.verdict === 'no') saveState(slug, { hold: true, killed: r.verdict === 'no' });
        else if (r.verdict === 'text') {
          const c = applyCorrections(slug, r.text);
          if (c.verdict === 'pass') { saveState(slug, { stage: 'covered' }); } // → send-final again on next wake (sendFinal rebuilds final.md from the re-gated file)
          else { saveState(slug, { stage: 'gated', gate_verdict: 'fail' }); notify(`Held at gate after corrections: ${st.title}`, fs.readFileSync(path.join(dir, 'gate-report.md'), 'utf8')); }
        }
        break;
      }
      case 'publish': {
        const p = publish(slug);
        notify(`Published: ${st.title}`, `${p.url}\n\nCommit ${p.commit}. Substack mirror follows automatically after 48 h. LinkedIn edition and native post are on Monday's session.`);
        break;
      }
    }
    log('runner', `${slug}: ${action} done`);
    return action;
  } catch (e) {
    saveState(slug, { last_error: { action, message: String(e.message).slice(0, 500), at: now.toISOString() } });
    log('runner', `${slug}: ${action} FAILED — ${e.message}`);
    notify(`Essay line failed at ${action}: ${st.title ?? slug}`, String(e.message).slice(0, 2000));
    return `error:${action}`;
  }
}

export async function tick({ now = new Date(), dry = false } = {}) {
  if (paused()) { log('runner', 'PAUSE present'); return; }
  const cfg = loadConfig();
  const hour = now.getHours(), day = now.getDay();
  if (hour === 6 && !dry) { try { await scan(); } catch (e) { log('runner', `scan failed: ${e.message}`); } }
  if (day === 1 && hour === cfg.brief_hour_local) {
    // runBrief's own { dry } only skips the email send — it still calls the paid brief
    // skill and writes brief.md before that check, so a --dry tick must not call it at all.
    if (dry) log('runner', 'DRY: would run the Monday brief');
    else { try { runBrief(); } catch (e) { log('runner', `brief failed: ${e.message}`); notify('Essay line: brief failed', e.message); } }
  }
  for (const e of listEssays()) advance(e.slug, now, { dry });
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const ni = process.argv.indexOf('--now');
  await tick({ now: ni > 0 ? new Date(process.argv[ni + 1]) : new Date(), dry: process.argv.includes('--dry') });
}
