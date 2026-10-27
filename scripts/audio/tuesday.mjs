// scripts/audio/tuesday.mjs
//
// The Tuesday 19:00 essay-audio job. In a throwaway worktree of origin/main it
// prepares tomorrow's draft (local files only: never uploaded, never committed),
// narrates and uploads every published essay whose audio is missing or stale,
// and opens a PR of the changed src/data/audio JSON. It never merges and never
// deploys. Any failure, or a throw, sends the owner one email.
//
//   node scripts/audio/tuesday.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { planWork, parseFrontmatter } from './audio.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_REL = 'src/data/audio';

export async function runTuesday(deps) {
  const prepared = [], published = [], failed = [];
  const errors = [];
  try {
    deps.pull();
    const plan = deps.plan();
    for (const slug of plan.upcoming) {
      try { await deps.prepare(slug); prepared.push(slug); }
      catch (e) { failed.push(slug); errors.push(`${slug} (prepare): ${e.message}`); }
    }
    for (const slug of [...plan.stale, ...plan.missing]) {
      try { await deps.publish(slug); published.push(slug); }
      catch (e) { failed.push(slug); errors.push(`${slug}: ${e.message}`); }
    }
    const changed = deps.changedFiles();
    if (changed.length) {
      const url = deps.openPr({ date: deps.today(), published, changed });
      deps.log(`PR opened: ${url}`);
    } else deps.log('Nothing changed; no PR.');
  } catch (e) {
    deps.sendMail({ subject: 'Essay audio: run failed', text: `The Tuesday essay-audio run stopped with an error.\n\n${e.message}\n` });
    throw e;
  }
  if (failed.length) {
    deps.sendMail({
      subject: `Essay audio: ${failed.length} failed`,
      text: `These essays did not get audio on the Tuesday run:\n\n${errors.map((x) => `- ${x}`).join('\n')}\n\nThe rest of the run carried on. See ~/Library/Logs/signal2noise-essay-audio.log.\n`,
    });
  }
  return { prepared, published, failed };
}

// ---- real wiring ----
export async function realDeps() {
  const { sendMail } = await import('../line/mail.mjs');
  const today = new Date().toISOString().slice(0, 10);
  const wt = join(tmpdir(), `s2n-audio-${today}`);
  const sh = (cmd, args, cwd = wt) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20 * 60e3 });
  const audio = (...args) => sh(process.execPath, [join(wt, 'scripts/audio/audio.mjs'), ...args]);
  const branch = `audio-${today}`;
  return {
    today: () => today,
    cleanup() { try { sh('git', ['worktree', 'remove', '--force', wt], ROOT); } catch { /* best effort */ } },
    log: (m) => console.log(m),
    sendMail,
    pull() {
      sh('git', ['fetch', '-q', 'origin', 'main'], ROOT);
      sh('git', ['worktree', 'prune'], ROOT);
      try { sh('git', ['worktree', 'remove', '--force', wt], ROOT); } catch { /* none left over */ }
      try { sh('git', ['branch', '-D', branch], ROOT); } catch { /* none left over */ }
      sh('git', ['worktree', 'add', '-q', '-b', branch, wt, 'origin/main'], ROOT);
    },
    plan() {
      const dir = join(wt, 'src/content/insights');
      const essays = readdirSync(dir).filter((f) => /\.mdx?$/.test(f))
        .map((f) => ({ slug: f.replace(/\.mdx?$/, ''), ...parseFrontmatter(readFileSync(join(dir, f), 'utf8')) }));
      const data = join(wt, DATA_REL);
      const all = existsSync(data)
        ? Object.fromEntries(readdirSync(data).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), JSON.parse(readFileSync(join(data, f), 'utf8'))]))
        : {};
      const pron = JSON.parse(readFileSync(join(wt, 'scripts/audio/pronunciations.json'), 'utf8'));
      return planWork(essays, all, today, pron);
    },
    prepare: async (slug) => { audio('prepare', slug); },
    publish: async (slug) => { audio('publish', slug); },
    changedFiles: () => sh('git', ['status', '--porcelain', '--', DATA_REL]).split('\n').filter(Boolean).map((l) => l.slice(3)),
    openPr({ date, published: pub, changed }) {
      sh('git', ['add', '--', DATA_REL]);
      sh('git', ['commit', '-q', '-m', `Essay audio: ${date}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`]);
      sh('git', ['push', '-q', '-u', 'origin', branch]);
      const body = `Audio data for: ${pub.join(', ') || 'none'}.\n\nFiles: ${changed.join(', ')}.\n\nThe m4a files are already uploaded. Merge, then build and deploy.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)`;
      return sh('gh', ['pr', 'create', '--base', 'main', '--head', branch, '--title', `Essay audio: ${date}`, '--body', body]).trim();
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let deps;
  try { deps = await realDeps(); } catch (e) { console.error(e.message); process.exit(1); }
  let code = 1;
  try {
    const r = await runTuesday(deps);
    console.log(JSON.stringify(r));
    code = r.failed.length ? 1 : 0;
  } catch (e) { console.error(e.message); }
  deps.cleanup();
  process.exit(code);
}
