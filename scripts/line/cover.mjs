import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, log } from './env.mjs';
import { runSkill } from './claude.mjs';
import { essayDir } from './state.mjs';
import { splitFrontmatter } from './md.mjs';
import { loadConfig } from './queue.mjs';

const COVERS = path.join(ROOT, 'src', 'covers');

export function nextFig() {
  let max = 0;
  for (const f of fs.readdirSync(COVERS)) {
    if (!f.endsWith('.ts') || f.startsWith('_')) continue;
    const m = fs.readFileSync(path.join(COVERS, f), 'utf8').match(/fig:\s*['"](\d+)['"]/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return String(max + 1).padStart(2, '0');
}

export const checkMotionDeclared = (src) => Number(src.match(/motionPx:\s*(\d+)/)?.[1] ?? 0);

// House style permits hyphenated compound adjectives ("FAITH, CLEAR-EYED"); no other punctuation.
export const CAPTION_RE = /^[A-Z][A-Z -]+, [A-Z][A-Z -]+$/;

export function validateModule(src) {
  const motionPx = checkMotionDeclared(src);
  if (motionPx < 60) throw new Error(`cover motionPx ${motionPx} < 60 (would not read at 700 px)`);
  const caption = src.match(/caption:\s*['"]([^'"]+)['"]/)?.[1] ?? '';
  if (!CAPTION_RE.test(caption)) throw new Error(`caption "${caption}" is not NOUN, ADJECTIVE`);
  return { motionPx, caption };
}

const porcelainPath = (line) => line.slice(3);

export function unexpectedWrites(before, after, allowed) {
  const beforeSet = new Set(before.map(porcelainPath));
  const allowedSet = new Set(allowed);
  const seen = new Set();
  const result = [];
  for (const line of after) {
    const p = porcelainPath(line);
    if (beforeSet.has(p) || allowedSet.has(p) || seen.has(p)) continue;
    seen.add(p);
    result.push(p);
  }
  return result;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed: ${(r.stderr || r.stdout).slice(0, 400)}`);
  return r.stdout;
}

function gitPorcelain() {
  const r = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git status failed: ${(r.stderr || r.stdout).slice(0, 400)}`);
  return r.stdout.split('\n').filter(Boolean);
}

function cleanupCover(modulePath, altPath) {
  const removed = [];
  for (const p of [modulePath, altPath]) {
    if (fs.existsSync(p)) {
      fs.rmSync(p);
      removed.push(path.relative(ROOT, p));
    }
  }
  if (removed.length) log('cover', `removed ${removed.join(', ')} after failed validation`);
}

export function makeCover({ slug, finalPath }) {
  const cfg = loadConfig();
  const { meta, body } = splitFrontmatter(fs.readFileSync(finalPath, 'utf8'));
  const fig = nextFig();
  const modulePath = path.join(COVERS, `${slug}.ts`);
  const altPath = path.join(essayDir(slug), 'cover-alt.txt');
  const input = `slug: ${slug}\nfig: ${fig}\ntitle: ${meta.title}\nexcerpt: ${meta.excerpt}\n\nEssay:\n\n${body}`;

  const before = gitPorcelain();
  const out = runSkill({ skill: 'cover', input, tools: ['Read', 'Write', 'Glob'], maxTurns: 40, model: cfg.models?.cover ?? null });
  const after = gitPorcelain();

  const allowed = [path.relative(ROOT, modulePath), path.relative(ROOT, altPath)];
  const unexpected = unexpectedWrites(before, after, allowed);
  if (unexpected.length) {
    cleanupCover(modulePath, altPath);
    throw new Error(`cover skill touched unexpected files: ${unexpected.join(', ')}`);
  }

  if (!fs.existsSync(modulePath)) throw new Error('cover skill did not write the module');
  const src = fs.readFileSync(modulePath, 'utf8');
  let motionPx, caption;
  try {
    ({ motionPx, caption } = validateModule(src));
  } catch (err) {
    cleanupCover(modulePath, altPath);
    throw err;
  }
  run('node', ['scripts/render-cover.mjs', slug]);
  const webp = path.join(ROOT, 'public', 'img', `${slug}.webp`);
  if (!fs.existsSync(webp)) throw new Error('render-cover produced no webp');
  const alt = fs.readFileSync(altPath, 'utf8').trim();
  log('cover', `${slug} FIG. ${fig} "${caption}" motion ${motionPx}px, $${out.cost_usd.toFixed(3)}`);
  return { fig, caption, alt, motionPx, webp, cost_usd: out.cost_usd };
}
