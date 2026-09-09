import fs from 'node:fs';
import path from 'node:path';
import { log } from './env.mjs';
import { layerBEssay } from './layerb.mjs';
import { checkPlagiarism } from './plagiarism.mjs';
import { scanBrE, applySpellingFixes, scanAmbiguous } from './bre.mjs';
import { inspectFile, cleanFile } from './layera.mjs';
import { splitFrontmatter, joinFrontmatter, SHIPPING_FIELDS } from './md.mjs';

// All automatic BrE fixes are spelling-only (bre.mjs AMERICAN); ambiguous words are
// reported as warnings for the owner and never auto-changed, so nothing here needs a
// second Layer B pass.

export function runGate({ inPath, outPath, reportPath, skipLayerB = false }) {
  const checks = {};
  let stage = 'layerb';
  try {
    // 1. Layer B
    if (skipLayerB) fs.copyFileSync(inPath, outPath); else checks.layerb = layerBEssay(inPath, outPath);
    // 2. Plagiarism + provenance (on the text that ships)
    stage = 'plagiarism';
    checks.plagiarism = checkPlagiarism(outPath);
    // 3. British English: scan, fix spellings, re-scan
    stage = 'bre';
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
    stage = 'layera';
    const before = inspectFile(outPath);
    if (before.suspicious) cleanFile(outPath);
    const after = inspectFile(outPath);
    checks.layera = { before, after };
  } catch (err) {
    const message = String(err?.message ?? err);
    const report = renderReport({ inPath, outPath, checks, verdict: 'fail', fails: [], error: { stage, message } });
    if (reportPath) fs.writeFileSync(reportPath, report);
    log('gate', `${path.basename(inPath)} → ERROR at ${stage}: ${message}`);
    return { verdict: 'fail', error: { stage, message }, report, checks };
  }

  const fails = [];
  if (checks.plagiarism.verdict === 'fail') fails.push('plagiarism/provenance');
  if (checks.bre.remaining.length) fails.push('British English (unresolved)');
  if (checks.layera.after.suspicious) fails.push('Layer A (still suspicious after clean)');
  const verdict = fails.length ? 'fail' : 'pass';
  const report = renderReport({ inPath, outPath, checks, verdict, fails });
  if (reportPath) fs.writeFileSync(reportPath, report);
  log('gate', `${path.basename(inPath)} → ${verdict.toUpperCase()}${fails.length ? ': ' + fails.join('; ') : ''} (plagiarism cost $${Number(checks.plagiarism.cost_usd ?? 0).toFixed(3)})`);
  return { verdict, report, checks };
}

export function renderReport({ inPath, outPath, checks, verdict, fails, error }) {
  const L = [`# Gate report — ${path.basename(inPath)}`, ''];
  if (error) {
    L.push('## Verdict: ERROR', `Failed during: ${error.stage}`, error.message, '');
  } else {
    L.push(`## Verdict: ${verdict.toUpperCase()}`, fails.length ? `Failing: ${fails.join('; ')}` : 'All four checks clean.', '');
  }
  L.push('## 1. Layer B (Codex rewrite)', checks.layerb ? `${checks.layerb.changed} strings rewritten → ${path.basename(outPath)}` : 'skipped (fixture / corrections-only run)', '');
  if (checks.plagiarism) {
    L.push('## 2. Plagiarism and provenance', `Verdict: ${checks.plagiarism.verdict}`, `Cost: $${Number(checks.plagiarism.cost_usd ?? 0).toFixed(3)}`,
      ...checks.plagiarism.sentences.map((s) => `- ${s.hit ? '❌ HIT' : '✅ clean'} — "${s.text.slice(0, 90)}…"${s.hit ? ` (${s.url})` : ''}`),
      ...checks.plagiarism.citations.map((c) => `- ${c.verified ? '✅' : '❌'} quote "${c.quote.slice(0, 60)}…" — ${c.url || 'no url'}${c.note ? ` — ${c.note}` : ''}`), '');
  } else {
    L.push('## 2. Plagiarism and provenance', 'not reached', '');
  }
  if (checks.bre) {
    L.push('## 3. British English', `Flagged ${checks.bre.flags.length}, fixed ${checks.bre.fixed.length}, unresolved ${checks.bre.remaining.length}`,
      ...checks.bre.flags.map((f) => `- line ${f.line}: ${f.word} → ${f.fix}`),
      ...(checks.bre.warnings.length ? ['Ambiguous (not auto-fixed, check by eye):', ...checks.bre.warnings.map((w) => `- line ${w.line}: ${w.word} — ${w.note}`)] : []),
      'All fixes were spelling-only.', '');
  } else {
    L.push('## 3. British English', 'not reached', '');
  }
  if (checks.layera) {
    L.push('## 4. Layer A (invisible Unicode)', `Before: ${checks.layera.before.suspicious ? 'SUSPICIOUS' : 'clean'} · After: ${checks.layera.after.suspicious ? 'SUSPICIOUS' : 'clean'}`, '');
  } else {
    L.push('## 4. Layer A (invisible Unicode)', 'not reached', '');
  }
  return L.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const [inPath, outPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const ri = process.argv.indexOf('--report');
  const r = runGate({ inPath, outPath, reportPath: ri > 0 ? process.argv[ri + 1] : null, skipLayerB: process.argv.includes('--skip-layerb') });
  console.log(r.report);
  process.exit(r.verdict === 'pass' ? 0 : 1);
}
