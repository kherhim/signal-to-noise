import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, log } from './env.mjs';
import { essayDir, loadState, saveState } from './state.mjs';
import { appendLedger, markQueue } from './queue.mjs';
import { splitFrontmatter } from './md.mjs';

const SITE = 'https://signal-to-noise.co';
const REGISTRY = path.join(ROOT, 'distribution', 'metrics', 'linkedin-posts.json');

export const registryEntry = ({ slug, title, date }) => ({ label: `${title} (native post, pending)`, posted: '', activity: '', essay: slug, added: date });
export const commitMessage = ({ title, slug, report }) => `Essay: ${title} (${slug})\n\nGate: ${report.match(/## Verdict: (\w+)/)?.[1] ?? 'UNKNOWN'} — ${report.split('\n').find((l) => /clean|Failing/.test(l)) ?? ''}\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_013AZhm8pRXAJx7bVRSNhEFa`;

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}): ${(r.stderr || r.stdout).slice(-600)}`);
  return r.stdout;
}
const code = (url) => spawnSync('curl', ['-s', '-o', '/dev/null', '-m', '20', '-w', '%{http_code}', url], { encoding: 'utf8' }).stdout.trim();

export function verifyLive(slug) {
  return { page: code(`${SITE}/insights/${slug}/`), og: code(`${SITE}/og/${slug}.jpg`), cover: code(`${SITE}/img/${slug}.webp`) };
}

export function publish(slug, { dry = false } = {}) {
  const dir = essayDir(slug), st = loadState(slug);
  const finalPath = path.join(dir, 'final.md');
  if (dry && !fs.existsSync(finalPath)) { log('publish', `DRY: final.md missing, would publish nothing`); return; }
  const { meta } = splitFrontmatter(fs.readFileSync(finalPath, 'utf8'));
  const dest = path.join(ROOT, 'src', 'content', 'insights', `${slug}.md`);
  if (fs.existsSync(dest)) throw new Error(`${dest} already exists`);
  if (verifyLive(slug).page === '200') throw new Error('already live');
  if (dry) { log('publish', `DRY would publish ${slug}`); return { url: `${SITE}/insights/${slug}/`, commit: null }; }
  fs.copyFileSync(finalPath, dest);
  sh('node', ['scripts/make-og-images.mjs']);
  sh('npm', ['run', 'build']);
  sh('bash', ['deploy.sh']);
  const live = verifyLive(slug);
  if (live.page !== '200' || live.cover !== '200') throw new Error(`live check failed: ${JSON.stringify(live)}`);
  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  reg.posts.push(registryEntry({ slug, title: meta.title, date: String(meta.date) }));
  fs.writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + '\n');
  appendLedger({ slug, title: meta.title, family: st.family, date: String(meta.date), url: `${SITE}/insights/${slug}/`, cost_usd: st.cost_usd });
  markQueue(st.title, `published ${meta.date}`);
  sh('git', ['add', dest, `src/covers/${slug}.ts`, `public/img/${slug}.webp`, 'public/og', REGISTRY, 'distribution/line']);
  sh('git', ['commit', '-q', '-m', commitMessage({ title: meta.title, slug, report: fs.readFileSync(path.join(dir, 'gate-report.md'), 'utf8') })]);
  sh('git', ['push', '-q', 'origin', 'main']);
  const commit = sh('git', ['rev-parse', '--short', 'HEAD']).trim();
  saveState(slug, { stage: 'published', published_at: new Date().toISOString(), commit, url: `${SITE}/insights/${slug}/` });
  log('publish', `${slug} live at ${SITE}/insights/${slug}/ (${commit})`);
  return { url: `${SITE}/insights/${slug}/`, commit };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  console.log(publish(process.argv[2], { dry: process.argv.includes('--dry') }));
}
