// scripts/line/humaniser.mjs
//
// The humaniser read (owner rule, 23 Sep 2026). claudish.mjs catches the
// constructions already proven against the owner's corpus; this catches the
// ones nobody has listed yet. "Your own ledger deserves this test before
// Nvidia's does" shipped in the landlord essay with a clean Claudish report.
//
// A model reads the shipping text against excerpts of the owner's own essays
// and flags sentences that read as machine-written. Any flag fails the gate;
// the report carries the sentence, the tell and a plain rewrite, and the owner
// decides. Nothing is rewritten automatically.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';
import { runSkill } from './claude.mjs';
import { scannableText, scanClaudish, claudishFails } from './claudish.mjs';
import { loadConfig, loadLedger } from './queue.mjs';

const INSIGHTS = path.join(ROOT, 'src', 'content', 'insights');

const SCHEMA = {
  type: 'object', required: ['flags'],
  properties: { flags: { type: 'array', maxItems: 20, items: {
    type: 'object', required: ['sentence', 'why', 'rewrite'],
    properties: { sentence: { type: 'string' }, why: { type: 'string' }, rewrite: { type: 'string' } },
  } } },
};

const stripFrontmatter = (md) => md.replace(/^---[\s\S]*?\n---\n/, '');
const firstWords = (text, n) => text.split(/\s+/).filter(Boolean).slice(0, n).join(' ');

// Excerpts from essays the owner wrote by hand, never the line's own output.
// The pick rotates with `seed` so the reader does not calibrate on one essay.
export function pickVoice({ dir = INSIGHTS, exclude = [], n = 3, words = 350, seed = 0 } = {}) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !exclude.includes(f.slice(0, -3))).sort();
  if (!files.length) return [];
  return Array.from({ length: Math.min(n, files.length) }, (_, i) => files[(seed + i * 7) % files.length])
    .map((f) => firstWords(scannableText(stripFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8'))), words));
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();

// A flag must quote the essay. One that does not is the reader's invention and
// is dropped. A suggested rewrite that trips the Claudish test is kept as a
// flag but its rewrite is withheld, so the report never recommends a tell.
export function vetFlags(flags, essay) {
  const hay = norm(essay);
  const kept = [], dropped = [];
  for (const f of flags) {
    if (!f.sentence || !hay.includes(norm(f.sentence))) { dropped.push(f); continue; }
    const bad = claudishFails(scanClaudish(f.rewrite ?? ''));
    kept.push(bad.length ? { ...f, rewrite: '', rewriteRejected: bad.map((h) => h.id).join(', ') } : f);
  }
  return { flags: kept, dropped };
}

// Owner decision, 23 Sep 2026: hold above this rate, warn below it. Measured
// the same day: the owner's own essays 0.00-2.77 flags per 1,000 words, the
// line's 3.65-7.63 under the old Layer B prompt.
export const FAIL_PER_1K = 3;

const wordCount = (t) => t.split(/\s+/).filter(Boolean).length;
export const humaniserRate = (flags, words) => (words ? (flags / words) * 1000 : 0);
export const humaniserFails = (r) => r.rate > FAIL_PER_1K;

export function checkHumaniser(text, { run = runSkill, voice = null } = {}) {
  const essay = scannableText(text);
  const line = loadLedger().published.map((p) => p.slug);
  const samples = voice ?? pickVoice({ exclude: line, seed: new Date().getUTCDate() });
  const cfg = loadConfig();
  const out = run({ skill: 'humaniser', input: JSON.stringify({ voice: samples, essay }, null, 2), schema: SCHEMA, maxTurns: 5, model: cfg.models?.humaniser ?? null });
  const { flags, dropped } = vetFlags(out.json?.flags ?? [], essay);
  const words = wordCount(essay);
  return { flags, dropped: dropped.length, words, rate: humaniserRate(flags.length, words), cost_usd: out.cost_usd ?? 0 };
}

export function renderHumaniser(r) {
  const head = `${humaniserFails(r) ? '❌ HOLD' : r.flags.length ? '⚠️ warnings only' : '✅'}: ${r.flags.length} flags, ${Number(r.rate ?? 0).toFixed(2)} per 1,000 words (holds above ${FAIL_PER_1K})`;
  return `${head}\n${renderFlags(r)}`;
}

function renderFlags(r) {
  if (!r.flags.length) return `No machine-sounding sentences flagged.${r.dropped ? ` (${r.dropped} unquotable flags dropped.)` : ''}`;
  return r.flags.map((f) => `- "${f.sentence}"\n  Tell: ${f.why}\n  ${f.rewrite ? `Plain: "${f.rewrite}"` : `Plain: withheld (suggestion tripped Claudish: ${f.rewriteRejected})`}`).join('\n')
    + (r.dropped ? `\n(${r.dropped} unquotable flags dropped.)` : '');
}
