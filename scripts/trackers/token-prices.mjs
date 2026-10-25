#!/usr/bin/env node
/**
 * token-prices.mjs — monthly snapshot for the AI token price index.
 *
 *   node scripts/trackers/token-prices.mjs          # fetch, write src/data/token-prices/snapshots/YYYY-MM.json
 *   node scripts/trackers/token-prices.mjs --dry    # fetch and print, write nothing
 *
 * Source: OpenRouter's public model list (no key). Prices are list prices per
 * million tokens; OpenRouter may serve a model through third-party hosts, so
 * the method note on the page says so. The lineup (each lab's premium, flagship
 * and budget model) is hand-kept in src/data/token-prices/lineup.json.
 *
 * Blended price = (3 × input + 1 × output) / 4, the usual 3:1 convention.
 *
 * Where OpenRouter's price is wrong, lineup.json `overrides` holds the lab's
 * own price and source; the run warns once OpenRouter agrees again.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = path.join(ROOT, 'src', 'data', 'token-prices');
const DRY = process.argv.includes('--dry');

export const blended = (input, output) => (3 * input + output) / 4;

export function priceOf(model, override) {
  const p = model?.pricing ?? {};
  let input = Number(p.prompt) * 1e6, output = Number(p.completion) * 1e6, source = 'openrouter';
  if (override) ({ input, output } = override), (source = override.source);
  if (!Number.isFinite(input) || !Number.isFinite(output) || input <= 0) return null;
  return { id: model.id, name: model.name, input: +input.toFixed(4), output: +output.toFixed(4), blended: +blended(input, output).toFixed(4), source };
}

// Overrides OpenRouter now agrees with, so they can be dropped from lineup.json.
export function staleOverrides(models, lineup) {
  const byId = new Map(models.map((m) => [m.id, m]));
  return Object.entries(lineup.overrides ?? {}).filter(([id, o]) => {
    const p = priceOf(byId.get(id));
    return p && Math.abs(p.input - o.input) < 1e-6 && Math.abs(p.output - o.output) < 1e-6;
  }).map(([id]) => id);
}

// A lab's newest models that the lineup does not mention: prompts the monthly review.
const ids = (l, tiers) => tiers.map((t) => l[t]).filter(Boolean);

export function newerThanLineup(models, lineup) {
  const named = new Set(lineup.labs.flatMap((l) => ids(l, lineup.tiers)));
  const skip = new Set(Object.keys(lineup.reviewed_out ?? {}));
  const out = [];
  for (const l of lineup.labs) {
    const prefix = ids(l, lineup.tiers)[0].split('/')[0] + '/';
    const mine = models.filter((m) => m.id.startsWith(prefix) && !m.id.includes(':'));
    const newestNamed = Math.max(...mine.filter((m) => named.has(m.id)).map((m) => m.created ?? 0), 0);
    for (const m of mine) if ((m.created ?? 0) > newestNamed && !skip.has(m.id)) out.push(`${l.lab}: ${m.id}`);
  }
  return out;
}

export function snapshot(models, lineup, fetchedAt) {
  const byId = new Map(models.map((m) => [m.id, m]));
  const labs = lineup.labs.map((l) => ({
    lab: l.lab,
    ...Object.fromEntries(lineup.tiers.map((t) => [t, l[t] && byId.has(l[t]) ? priceOf(byId.get(l[t]), lineup.overrides?.[l[t]]) : null])),
    missing: ids(l, lineup.tiers).filter((id) => !byId.has(id)),
  }));
  return { fetched_at: fetchedAt, source: 'https://openrouter.ai/api/v1/models', basis: 'USD per million tokens, list price; blended = (3 input + 1 output) / 4', labs };
}

async function main() {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const models = (await res.json()).data;
  const lineup = JSON.parse(fs.readFileSync(path.join(DATA, 'lineup.json'), 'utf8'));
  const now = new Date();
  const snap = snapshot(models, lineup, now.toISOString());
  for (const l of snap.labs) {
    const f = (p) => (p ? `$${p.input}/$${p.output} ($${p.blended.toFixed(2)})` : '—');
    console.log(`${l.lab.padEnd(16)} ${lineup.tiers.map((t) => `${t} ${f(l[t]).padEnd(26)}`).join(' ')}${l.missing.length ? `  MISSING ${l.missing.join(', ')}` : ''}`);
  }
  const newer = newerThanLineup(models, lineup);
  if (newer.length) console.log(`\nNewer than the lineup (review lineup.json):\n  ${newer.join('\n  ')}`);
  const stale = staleOverrides(models, lineup);
  if (stale.length) console.log(`\nOpenRouter now matches these overrides (drop them from lineup.json):\n  ${stale.join('\n  ')}`);
  if (DRY) return;
  const out = path.join(DATA, 'snapshots', `${now.toISOString().slice(0, 7)}.json`);
  fs.writeFileSync(out, JSON.stringify(snap, null, 2) + '\n');
  console.log(`\nwrote ${path.relative(ROOT, out)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
