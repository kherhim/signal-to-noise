#!/usr/bin/env node
// Essay audio CLI: narrate / prepare / publish.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { narrationScript, scriptHash, splitSentences } from '../../src/lib/narration.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIO_DIR = process.env.S2N_AUDIO_DIR || join(homedir(), 'Documents', 's2n-audio');
const PYTHON = join(AUDIO_DIR, '.venv', 'bin', 'python');
const CONTENT = join(ROOT, 'src', 'content', 'insights');
const DATA = join(ROOT, 'src', 'data', 'audio');
const VOICE = 'chatterbox-default';
const ENGINE = 'chatterbox';

const iso = (d) => (d instanceof Date ? d.toISOString() : String(d ?? '')).slice(0, 10);
const tomorrow = (today) => new Date(Date.parse(today) + 864e5).toISOString().slice(0, 10);

export function planWork(essays, all, today, pron = {}) {
  const stale = [], missing = [], upcoming = [];
  const next = tomorrow(today);
  for (const e of essays) {
    if (e.draft) {
      if (iso(e.date) === next) upcoming.push(e.slug);
      continue;
    }
    const entry = all[e.slug];
    if (!entry) missing.push(e.slug);
    else if (entry.hash !== scriptHash(narrationScript(e.body, pron).items)) stale.push(e.slug);
  }
  return { stale, missing, upcoming };
}

const build = (slug, r) => ({
  voice: VOICE,
  engine: ENGINE,
  hash: r.hash,
  file: `${slug}.${r.hash.slice(0, 8)}.m4a`,
  duration: r.duration,
  chapters: r.chapters,
  peaks: r.peaks,
});

// Narrate and check one essay into S2N_AUDIO_DIR; no upload, repo untouched.
export async function prepareOne(slug, { narrate, writeLocal }) {
  const r = await narrate(slug);
  if (!r) return null;
  const data = build(slug, r);
  writeLocal(slug, data);
  return data;
}

// Upload first; the repo JSON is written only once the upload has succeeded.
export async function publishOne(slug, { narrate, upload, writeJson }) {
  const r = await narrate(slug);
  if (!r) return null;
  const data = build(slug, r);
  await upload([r.path]);
  writeJson(slug, data);
  return data;
}

// ---- real implementations ----
function parseEssay(file) {
  const raw = readFileSync(join(CONTENT, file), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = m ? m[1] : '';
  const get = (k) => (fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
  return {
    slug: file.replace(/\.mdx?$/, ''),
    body: m ? m[2] : raw,
    draft: get('draft') === 'true',
    date: get('date') || '',
  };
}
const loadEssays = () => readdirSync(CONTENT).filter((f) => /\.mdx?$/.test(f)).map(parseEssay);
const loadAll = () =>
  Object.fromEntries(
    existsSync(DATA) ? readdirSync(DATA).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), JSON.parse(readFileSync(join(DATA, f), 'utf8'))]) : [],
  );
const pronunciations = () => JSON.parse(readFileSync(join(ROOT, 'scripts', 'audio', 'pronunciations.json'), 'utf8'));
const localJson = (slug) => join(AUDIO_DIR, `${slug}.audio.json`);

export function realNarrate(essay) {
  mkdirSync(AUDIO_DIR, { recursive: true });
  const { items } = narrationScript(essay.body, pronunciations());
  const hash = scriptHash(items);
  const path = join(AUDIO_DIR, `${essay.slug}.${hash.slice(0, 8)}.m4a`);
  // Reuse a matching prepare run instead of narrating twice.
  if (existsSync(path) && existsSync(localJson(essay.slug))) {
    const prev = JSON.parse(readFileSync(localJson(essay.slug), 'utf8'));
    if (prev.hash === hash) return { hash, path, duration: prev.duration, chapters: prev.chapters, peaks: prev.peaks };
  }
  const scriptPath = join(AUDIO_DIR, `${essay.slug}.script.json`);
  writeFileSync(scriptPath, JSON.stringify({ slug: essay.slug, items: items.map((i) => ({ ...i, sentences: splitSentences(i.text) })) }));
  const p = spawnSync(PYTHON, [join(ROOT, 'scripts', 'audio', 'narrate.py'), scriptPath, path], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024,
  });
  let out;
  try { out = JSON.parse(p.stdout.trim().split('\n').pop()); } catch { out = null; }
  if (!out) throw new Error(`narrate.py crashed for ${essay.slug} (exit ${p.status})`);
  if (!out.ok) {
    console.error(`Skipping ${essay.slug}: ${out.error || 'verification failed'}`);
    for (const s of out.failed || []) console.error(`  failed sentence: ${s}`);
    return null;
  }
  return { hash, path, duration: out.duration, chapters: out.chapters, peaks: out.peaks };
}

const writeRepoJson = (slug, d) => {
  mkdirSync(DATA, { recursive: true });
  writeFileSync(join(DATA, `${slug}.json`), JSON.stringify(d, null, 2) + '\n');
};
const writeLocalJson = (slug, d) => { mkdirSync(AUDIO_DIR, { recursive: true }); writeFileSync(localJson(slug), JSON.stringify(d, null, 2) + '\n'); };

async function main(argv) {
  const [cmd, ...rest] = argv;
  mkdirSync(AUDIO_DIR, { recursive: true });
  const essays = loadEssays();
  const bySlug = Object.fromEntries(essays.map((e) => [e.slug, e]));
  const need = (slug) => { if (!bySlug[slug]) throw new Error(`No such essay: ${slug}`); return bySlug[slug]; };
  const { uploadFiles } = await import('./upload.mjs');
  const mk = (slug) => ({
    narrate: async () => realNarrate(need(slug)),
    upload: uploadFiles,
    writeJson: writeRepoJson,
    writeLocal: writeLocalJson,
  });
  let failures = 0;

  if (cmd === 'narrate') {
    let slugs = rest.filter((a) => !a.startsWith('--'));
    if (rest.includes('--missing') || rest.includes('--stale')) {
      const plan = planWork(essays, loadAll(), new Date().toISOString().slice(0, 10), pronunciations());
      if (rest.includes('--missing')) slugs.push(...plan.missing);
      if (rest.includes('--stale')) slugs.push(...plan.stale);
    }
    for (const slug of [...new Set(slugs)]) {
      if (need(slug).draft) { console.error(`Skipping ${slug}: draft (use prepare)`); continue; }
      try {
        const d = await publishOne(slug, mk(slug));
        console.log(d ? `Published ${d.file}` : `Skipped ${slug}`);
        if (!d) failures++;
      } catch (e) { console.error(`${slug}: ${e.message}`); failures++; }
    }
  } else if (cmd === 'prepare') {
    const slug = rest[0];
    if (!need(slug).draft) throw new Error(`${slug} is published; use narrate`);
    const d = await prepareOne(slug, mk(slug));
    console.log(d ? `Prepared ${d.file}` : `Skipped ${slug}`);
    if (!d) failures++;
  } else if (cmd === 'publish') {
    const slug = rest[0];
    need(slug);
    const d = await publishOne(slug, mk(slug));
    console.log(d ? `Published ${d.file}` : `Skipped ${slug}`);
    if (!d) failures++;
  } else {
    console.error('Usage: audio.mjs narrate <slug…>|--missing|--stale | prepare <slug> | publish <slug>');
    process.exit(64);
  }
  process.exit(failures ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
