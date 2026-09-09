import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, log } from './env.mjs';
import { essayDir, loadState, saveState } from './state.mjs';
import { markQueue, loadLedger, LEDGER } from './queue.mjs';
import { splitFrontmatter } from './md.mjs';
import { runChild, TIMEOUTS } from './proc.mjs';

const SITE = 'https://signal-to-noise.co';
const REGISTRY = path.join(ROOT, 'distribution', 'metrics', 'linkedin-posts.json');

export const registryEntry = ({ slug, title, date }) => ({ label: `${title} (native post, pending)`, posted: '', activity: '', essay: slug, added: date });
export const commitMessage = ({ title, slug, report }) => `Essay: ${title} (${slug})\n\nGate: ${report.match(/## Verdict: (\w+)/)?.[1] ?? 'UNKNOWN'} — ${report.split('\n').find((l) => /clean|Failing/.test(l)) ?? ''}\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_013AZhm8pRXAJx7bVRSNhEFa`;

// Publish is resumable: a failed deploy or push re-enters at `start` on a later
// wake, so both bookkeeping appends have to be idempotent by essay/slug or a
// retry silently doubles the row. Pure, so they can be tested without files.
export function upsertRegistry(reg, entry) {
  const posts = reg.posts ?? [];
  if (posts.some((p) => p.essay === entry.essay)) return { ...reg, posts };
  return { ...reg, posts: [...posts, entry] };
}

export function upsertLedger(ledger, entry) {
  const published = ledger.published ?? [];
  if (published.some((p) => p.slug === entry.slug)) return { ...ledger, published };
  return { ...ledger, published: [...published, entry] };
}

// Masks anything shaped like a token/secret/hash before it can land in a thrown error message or the log.
export function redact(text) {
  return text.replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]');
}

function sh(cmd, args, opts = {}) {
  const r = runChild(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts }, { timeoutMin: TIMEOUTS.publish, label: `${cmd} ${args[0] ?? ''}`.trim() });
  if (r.status !== 0) throw new Error(redact(`${cmd} ${args.join(' ')} failed (${r.status}): ${(r.stderr || r.stdout).slice(-600)}`));
  return r.stdout;
}
const code = (url) => spawnSync('curl', ['-s', '-o', '/dev/null', '-m', '20', '-w', '%{http_code}', url], { encoding: 'utf8' }).stdout.trim();

// Synchronous sleep (Atomics.wait blocks the thread) — publish() is deliberately synchronous throughout.
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function verifyLive(slug) {
  return { page: code(`${SITE}/insights/${slug}/`), og: code(`${SITE}/og/${slug}.jpg`), cover: code(`${SITE}/img/${slug}.webp`) };
}

// Polls verifyLive until page, cover AND og all report 200, retrying with a delay between attempts.
export function waitLive(slug, { attempts = 4, delayMs = 20000 } = {}) {
  let live;
  for (let i = 0; i < attempts; i += 1) {
    live = verifyLive(slug);
    if (live.page === '200' && live.cover === '200' && live.og === '200') return live;
    if (i < attempts - 1) sleepSync(delayMs);
  }
  return live;
}

// Pure, state-driven resume point: what publish() should do next given the persisted state and
// whether final.md is present. Throws on states that make progress impossible/unsafe.
export function preflight(st, { finalExists }) {
  if (!st.title || !st.family) throw new Error('state lacks title/family; re-brief');
  if (!finalExists) throw new Error('final.md missing');
  if (st.stage === 'published') return 'done';
  if (st.stage === 'push-failed') return 'push';
  if (st.stage === 'deploying' || st.stage === 'deploy-failed') return 'deploy';
  return 'start';
}

// The exact, explicit set of paths `publish` ever `git add`s — never a directory, never `-A`.
// Any path that doesn't exist (e.g. a per-essay file skipped this run) is dropped.
export function addPaths(slug) {
  const paths = [
    path.join(ROOT, 'src', 'content', 'insights', `${slug}.md`),
    path.join(ROOT, 'src', 'covers', `${slug}.ts`),
    path.join(ROOT, 'public', 'img', `${slug}.webp`),
    path.join(ROOT, 'public', 'og', `${slug}.jpg`),
    REGISTRY,
    path.join(ROOT, 'distribution', 'line', 'ledger.json'),
    path.join(ROOT, 'distribution', 'line', 'queue.md'),
  ];
  return paths.filter((p) => fs.existsSync(p));
}

export function publish(slug, { dry = false } = {}) {
  const dir = essayDir(slug);
  const st = loadState(slug);
  const finalPath = path.join(dir, 'final.md');
  const finalExists = fs.existsSync(finalPath);

  const url = `${SITE}/insights/${slug}/`;

  let stage;
  try {
    stage = preflight(st, { finalExists });
  } catch (err) {
    if (dry) { log('publish', `DRY: ${err.message}`); return { url: null, commit: null }; }
    throw err;
  }

  if (stage === 'done') {
    log('publish', `${slug} already published at ${url}`);
    return { url, commit: st.commit };
  }

  if (dry) {
    log('publish', `DRY would publish ${slug}`);
    return { url: null, commit: null };
  }

  const dest = path.join(ROOT, 'src', 'content', 'insights', `${slug}.md`);
  let commit = st.commit;

  if (stage === 'start') {
    const { meta } = splitFrontmatter(fs.readFileSync(finalPath, 'utf8'));
    fs.copyFileSync(finalPath, dest); // overwrite allowed: a leftover from a failed attempt is expected
    sh('node', ['scripts/make-og-images.mjs']);
    sh('npm', ['run', 'build']);
    const reg = upsertRegistry(JSON.parse(fs.readFileSync(REGISTRY, 'utf8')), registryEntry({ slug, title: meta.title, date: String(meta.date) }));
    fs.writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + '\n');
    const ledger = upsertLedger(loadLedger(), { slug, title: meta.title, family: st.family, date: String(meta.date), url, cost_usd: st.cost_usd });
    fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
    markQueue(st.title, `published ${meta.date}`);
    sh('git', ['add', ...addPaths(slug)]);
    sh('git', ['commit', '-q', '-m', commitMessage({ title: meta.title, slug, report: fs.readFileSync(path.join(dir, 'gate-report.md'), 'utf8') })]);
    commit = sh('git', ['rev-parse', '--short', 'HEAD']).trim();
    saveState(slug, { stage: 'deploying', commit });
    stage = 'deploy';
  }

  if (stage === 'deploy') {
    try {
      sh('bash', ['deploy.sh']);
    } catch (err) {
      saveState(slug, { stage: 'deploy-failed', last_error: err.message });
      throw err;
    }
    const live = waitLive(slug);
    if (!(live.page === '200' && live.cover === '200' && live.og === '200')) {
      saveState(slug, { stage: 'deploy-failed', live });
      throw new Error(`live check failed: ${JSON.stringify(live)}`);
    }
    stage = 'push';
  }

  if (stage === 'push') {
    try {
      sh('git', ['push', 'origin', 'main']);
    } catch (err) {
      saveState(slug, { stage: 'push-failed' });
      throw err;
    }
  }

  saveState(slug, { stage: 'published', published_at: new Date().toISOString(), url });
  log('publish', `${slug} live at ${url} (${commit})`);
  return { url, commit };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  console.log(publish(process.argv[2], { dry: process.argv.includes('--dry') }));
}
