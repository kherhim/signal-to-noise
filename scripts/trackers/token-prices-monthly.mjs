#!/usr/bin/env node
/**
 * token-prices-monthly.mjs — the launchd job behind the AI token price index.
 *
 *   node scripts/trackers/token-prices-monthly.mjs
 *
 * Runs token-prices.mjs in a throwaway worktree off origin/main, so the owner's
 * checkout is never touched, then opens a PR with the new snapshot and a
 * macOS notification. Never merges: merging is the approval, silence changes
 * nothing. Warnings (unreviewed new models, stale overrides, missing ids) go
 * in the PR body for the lineup review.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const notify = (msg) => {
  try { sh('osascript', ['-e', `display notification ${JSON.stringify(msg)} with title "Token price index"`]); } catch { /* a notification must never fail the job */ }
};
const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

export const DEPS = { sh, notify, now: () => new Date() };

export function prBody(month, output) {
  const warn = output.split('\n').filter((l) => /MISSING|Newer than|OpenRouter now matches|^ {2}\S/.test(l));
  return [`Monthly snapshot of list prices for the AI token price index, ${month}.`, '',
    '```', output.trim(), '```', '',
    warn.length ? 'Lineup review needed: see the warnings above, then edit `src/data/token-prices/lineup.json` on this branch.' : 'No lineup warnings this month.', '',
    'Merge to publish at the next deploy. Close to drop. Nothing changes until this is merged.'].join('\n');
}

export function runMonthly({ root = ROOT, deps: injected = {} } = {}) {
  const deps = { ...DEPS, ...injected };
  const month = deps.now().toISOString().slice(0, 7);
  const branch = `token-prices-${month}`;
  let wt = null;
  try {
    deps.sh('git', ['-C', root, 'fetch', '-q', 'origin', 'main']);
    if (deps.sh('git', ['-C', root, 'ls-remote', '--heads', 'origin', branch]).trim())
      throw new Error(`branch ${branch} already exists; this month's snapshot was already proposed`);
    wt = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'token-prices-')), 'wt');
    deps.sh('git', ['-C', root, 'worktree', 'prune']); // a crashed run's registration
    deps.sh('git', ['-C', root, 'worktree', 'add', '-q', '-b', branch, wt, 'origin/main']);
    const output = deps.sh('node', [path.join(wt, 'scripts', 'trackers', 'token-prices.mjs')], { cwd: wt });
    const rel = path.join('src', 'data', 'token-prices', 'snapshots', `${month}.json`);
    const title = `Token price index snapshot ${month}`;
    const body = prBody(month, output);
    deps.sh('git', ['-C', wt, 'add', rel]);
    deps.sh('git', ['-C', wt, 'commit', '-q', '-m', `${title}\n\n${body}`]);
    deps.sh('git', ['-C', wt, 'push', '-q', '-u', 'origin', branch]);
    const url = deps.sh('gh', ['pr', 'create', '--base', 'main', '--head', branch, '--title', title, '--body', body], { cwd: wt }).trim();
    log(`PR ${url}`);
    deps.notify(`${month} snapshot ready to review: ${url}`);
    return { pr: url, body };
  } catch (err) {
    log(`ERROR: ${err.message}`);
    deps.notify(`Token price snapshot failed: ${String(err.message).slice(0, 120)}`);
    throw err;
  } finally {
    if (wt) {
      try { deps.sh('git', ['-C', root, 'worktree', 'remove', '--force', wt]); } catch { /* best effort */ }
      fs.rmSync(path.dirname(wt), { recursive: true, force: true });
      try { deps.sh('git', ['-C', root, 'branch', '-D', branch]); } catch { /* a pushed branch lives on origin */ }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { runMonthly(); } catch { process.exit(1); }
}
