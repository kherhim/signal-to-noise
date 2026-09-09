import fs from 'node:fs';
import path from 'node:path';
import { log } from './env.mjs';
import { layerBEssay } from './layerb.mjs';
import { checkPlagiarism } from './plagiarism.mjs';
import { scanBrE, applySpellingFixes, scanAmbiguous } from './bre.mjs';
import { inspectFile, cleanFile, serviceUp, resolveServiceUrl } from './layera.mjs';
import { splitFrontmatter, joinFrontmatter, BRE_FIELDS } from './md.mjs';
import { loadNeverList, neverListHits } from './queue.mjs';

// All automatic BrE fixes are spelling-only (bre.mjs AMERICAN); ambiguous words are
// reported as warnings for the owner and never auto-changed, so nothing here needs a
// second Layer B pass.

// Every paid or networked collaborator in one place, so tests can inject fakes
// and no test reaches the network, a paid model or the watermarks service.
export const GATE_DEPS = { layerBEssay, checkPlagiarism, inspectFile, cleanFile, serviceUp, loadNeverList, neverListHits };

// The text the gate is allowed to respell: the body plus the shipping strings.
// Identifier lines (coverImage:, coverAnimation:, tags:) are paths and slugs,
// never prose — "color-theory.webp" must be neither rewritten into a broken
// path nor flagged as an unresolved Americanism for ever.
export const checkableText = (meta, body) =>
  [body, ...BRE_FIELDS.map((k) => (typeof meta[k] === 'string' ? meta[k] : ''))].filter(Boolean).join('\n');

export function serviceDownError() {
  let url;
  try { url = resolveServiceUrl(); } catch { url = 'the configured WATERMARKS_SERVICE_URL'; }
  return `watermarks service not running at ${url}; start it with \`make serve\` in ~/Documents/devProjects/watermarks-remover`;
}

export function runGate({ inPath, outPath, reportPath, skipLayerB = false, deps: injected = {} }) {
  const deps = { ...GATE_DEPS, ...injected };
  const checks = {};
  // Layer A is the last step and cannot be skipped, so a gate run that starts
  // without the service would spend on Layer B and plagiarism and then fail at
  // the end. Check the prerequisite before anything costs money.
  if (!deps.serviceUp()) {
    const error = { stage: 'prerequisites', message: serviceDownError() };
    const report = renderReport({ inPath, outPath, checks, verdict: 'fail', fails: [], error });
    if (reportPath) fs.writeFileSync(reportPath, report);
    log('gate', `${path.basename(inPath)} → ERROR at prerequisites: ${error.message}`);
    return { verdict: 'fail', error, report, checks };
  }
  let stage = 'layerb';
  try {
    // 1. Layer B
    if (skipLayerB) fs.copyFileSync(inPath, outPath); else checks.layerb = deps.layerBEssay(inPath, outPath);
    // 2. Plagiarism + provenance (on the text that ships)
    stage = 'plagiarism';
    checks.plagiarism = deps.checkPlagiarism(outPath);
    // 3. British English: scan, fix spellings, re-scan — body and shipping fields only
    stage = 'bre';
    const { meta, body, raw } = splitFrontmatter(fs.readFileSync(outPath, 'utf8'));
    const flagsBefore = scanBrE(checkableText(meta, body));
    const fixedBody = applySpellingFixes(body);
    const fixed = [...fixedBody.fixed];
    for (const k of BRE_FIELDS) {
      if (typeof meta[k] !== 'string') continue;
      const f = applySpellingFixes(meta[k]);
      meta[k] = f.text;
      fixed.push(...f.fixed);
    }
    const md = joinFrontmatter(meta, fixedBody.text, raw);
    fs.writeFileSync(outPath, md);
    const after = checkableText(meta, fixedBody.text);
    checks.bre = { flags: flagsBefore, fixed, remaining: scanBrE(after), warnings: scanAmbiguous(after) };
    // 3b. Never-list — on the whole file that ships, after the BrE rewrite and
    // before Layer A, so a name reintroduced by a Codex rewrite or a correction
    // cannot reach publish.
    stage = 'never-list';
    checks.neverlist = { hits: deps.neverListHits(md, deps.loadNeverList()) };
    // 4. Layer A last
    stage = 'layera';
    const beforeA = deps.inspectFile(outPath);
    if (beforeA.suspicious) deps.cleanFile(outPath);
    const afterA = deps.inspectFile(outPath);
    checks.layera = { before: beforeA, after: afterA };
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
  if (checks.neverlist.hits.length) fails.push(`never-list: ${checks.neverlist.hits.join(', ')}`);
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
    L.push(`## Verdict: ${verdict.toUpperCase()}`, fails.length ? `Failing: ${fails.join('; ')}` : 'All checks clean.', '');
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
  L.push('## 3b. Never-list',
    checks.neverlist ? (checks.neverlist.hits.length ? `HIT — never-list: ${checks.neverlist.hits.join(', ')}` : 'No never-listed name in the file that ships.') : 'not reached', '');
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
