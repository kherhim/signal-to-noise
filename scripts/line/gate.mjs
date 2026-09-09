import fs from 'node:fs';
import path from 'node:path';
import { log } from './env.mjs';
import { layerBEssay, layerBText } from './layerb.mjs';
import { checkPlagiarism } from './plagiarism.mjs';
import { scanBrE, applySpellingFixes, scanAmbiguous } from './bre.mjs';
import { inspectFile, cleanFile } from './layera.mjs';
import { splitFrontmatter, joinFrontmatter, SHIPPING_FIELDS } from './md.mjs';

export function runGate({ inPath, outPath, reportPath, skipLayerB = false }) {
  const checks = {};
  // 1. Layer B
  if (skipLayerB) fs.copyFileSync(inPath, outPath); else checks.layerb = layerBEssay(inPath, outPath);
  // 2. Plagiarism + provenance (on the text that ships)
  checks.plagiarism = checkPlagiarism(outPath);
  // 3. British English: scan, fix spellings, re-scan; any non-spelling fix re-enters Layer B for that string
  let md = fs.readFileSync(outPath, 'utf8');
  const flagsBefore = scanBrE(md);
  const fixed = applySpellingFixes(md);
  md = fixed.text;
  const { meta, body, raw } = splitFrontmatter(md);
  for (const k of SHIPPING_FIELDS) if (typeof meta[k] === 'string') meta[k] = applySpellingFixes(meta[k]).text;
  md = joinFrontmatter(meta, body, raw);
  fs.writeFileSync(outPath, md);
  const flagsAfter = scanBrE(md);
  checks.bre = { flags: flagsBefore, fixed: fixed.fixed, remaining: flagsAfter, warnings: scanAmbiguous(md) };
  // 4. Layer A last
  const before = inspectFile(outPath);
  if (before.suspicious) cleanFile(outPath);
  const after = inspectFile(outPath);
  checks.layera = { before, after };

  const fails = [];
  if (checks.plagiarism.verdict === 'fail') fails.push('plagiarism/provenance');
  if (checks.bre.remaining.length) fails.push('British English (unresolved)');
  if (checks.layera.after.suspicious) fails.push('Layer A (still suspicious after clean)');
  const verdict = fails.length ? 'fail' : 'pass';
  const report = renderReport({ inPath, outPath, checks, verdict, fails });
  if (reportPath) fs.writeFileSync(reportPath, report);
  log('gate', `${path.basename(inPath)} → ${verdict.toUpperCase()}${fails.length ? ': ' + fails.join('; ') : ''}`);
  return { verdict, report, checks };
}

function renderReport({ inPath, outPath, checks, verdict, fails }) {
  const L = [`# Gate report — ${path.basename(inPath)}`, '', `## Verdict: ${verdict.toUpperCase()}`, fails.length ? `Failing: ${fails.join('; ')}` : 'All four checks clean.', ''];
  L.push('## 1. Layer B (Codex rewrite)', checks.layerb ? `${checks.layerb.changed} strings rewritten → ${path.basename(outPath)}` : 'skipped (fixture / corrections-only run)', '');
  L.push('## 2. Plagiarism and provenance', `Verdict: ${checks.plagiarism.verdict}`, ...checks.plagiarism.sentences.map((s) => `- ${s.hit ? '❌ HIT' : '✅ clean'} — "${s.text.slice(0, 90)}…"${s.hit ? ` (${s.url})` : ''}`),
    ...checks.plagiarism.citations.map((c) => `- ${c.verified ? '✅' : '❌'} quote "${c.quote.slice(0, 60)}…" — ${c.url || 'no url'}${c.note ? ` — ${c.note}` : ''}`), '');
  L.push('## 3. British English', `Flagged ${checks.bre.flags.length}, fixed ${checks.bre.fixed.length}, unresolved ${checks.bre.remaining.length}`,
    ...checks.bre.flags.map((f) => `- line ${f.line}: ${f.word} → ${f.fix}`),
    ...(checks.bre.warnings.length ? ['Ambiguous (not auto-fixed, check by eye):', ...checks.bre.warnings.map((w) => `- line ${w.line}: ${w.word} — ${w.note}`)] : []), '');
  L.push('## 4. Layer A (invisible Unicode)', `Before: ${checks.layera.before.suspicious ? 'SUSPICIOUS' : 'clean'} · After: ${checks.layera.after.suspicious ? 'SUSPICIOUS' : 'clean'}`, '');
  return L.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const [inPath, outPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const ri = process.argv.indexOf('--report');
  const r = runGate({ inPath, outPath, reportPath: ri > 0 ? process.argv[ri + 1] : null, skipLayerB: process.argv.includes('--skip-layerb') });
  console.log(r.report);
  process.exit(r.verdict === 'pass' ? 0 : 1);
}
