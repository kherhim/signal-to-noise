# In-repo Layer A and pinned-model Layer B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer A runs entirely in the repo and Layer B's Codex model is pinned by repo config, so neither can be broken by a third-party release or a global config edit.

**Architecture:** `scripts/line/layera.mjs` becomes a pure, synchronous Node module (`inspectText`/`cleanText` plus the existing file wrappers). `scripts/line/layerb.mjs` reads `models.layerb` from `distribution/line/config.json`, passes it to Codex, and measures 3-gram survival with a new `divergence()`. The gate keeps its shape; its prerequisite check becomes an in-repo Layer A self-check.

**Tech Stack:** Node ≥ 20 ESM, `node:test`, Unicode property regexes (`\p{Extended_Pictographic}`, `\p{Script=Latin}`).

Spec: `docs/superpowers/specs/2026-10-12-in-repo-layer-a-b-design.md`.

## Global Constraints

- No network, no paid model and no Docker in any test (`npm run test:line`).
- Layer A must never change the owner's published essays except the allowlisted odd-space cases found on 12 Oct 2026 (Task 2).
- Layer A inspects frontmatter **key names** only, never values.
- Layer B model: `models.layerb = "gpt-5.5"`; Codex flags `-m <model> -c service_tier=default`. No fallback to the global Codex config.
- `LAYERB_MAX_SURVIVAL = 0.35`; above it, retry once, then warn (never fail the gate).
- `cleanFile` throws if the result is shorter than 90% of the input.
- British English in all prose and comments.

## Deviation from the spec (recorded)

The spec drops the gate's `serviceUp()` pre-check. The plan keeps the check and its test, retargeted: `serviceUp()` now runs a self-check of the in-repo cleaner, and `serviceDownError()` says so. The gate still refuses to spend when Layer A is broken. No test is removed.

## File map

| File | Change | Responsibility |
|---|---|---|
| `scripts/line/layera.mjs` | rewrite | Unicode/frontmatter scan and clean; file wrappers; self-check |
| `scripts/line/test/layera.test.mjs` | rewrite | unit tests for every kind, preservation cases |
| `scripts/line/test/layera-corpus.test.mjs` | create | published-essay guard with explicit allowlist |
| `scripts/line/gate.mjs` | modify | self-check message; Layer A report counts; Layer B divergence line |
| `scripts/line/test/gate.test.mjs` | modify | message assertions for the self-check |
| `scripts/line/layerb.mjs` | modify | pinned model, `divergence()`, retry |
| `scripts/line/test/layerb.test.mjs` | modify | model flag, divergence tests |
| `distribution/line/config.json` | modify | `models.layerb` |
| `distribution/line/README.md` | modify | Prerequisites section; pipeline diagram |

---

### Task 1: In-repo Layer A core

**Files:**
- Rewrite: `scripts/line/layera.mjs`
- Rewrite: `scripts/line/test/layera.test.mjs`

**Interfaces:**
- Produces: `inspectText(text) → { suspicious: boolean, findings: Finding[] }`; `cleanText(text) → { text, removed, replaced, findings }`; `inspectFile(path) → { suspicious, report: { findings }, kind: 'text' }`; `cleanFile(path) → { changed, report: { removed, replaced, findings } }`; `serviceUp() → boolean` (self-check); `plausibleClean(beforeLen, afterLen) → boolean`; `summariseFindings(findings) → string` e.g. `"3 zero-width, 1 bidi"`. `Finding = { kind, codepoint, line }`.

- [ ] **Step 1: Write the failing tests** — `scripts/line/test/layera.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectText, cleanText, inspectFile, cleanFile, serviceUp, plausibleClean, summariseFindings } from '../layera.mjs';

const kinds = (r) => r.findings.map((f) => f.kind);

test('each invisible carrier is found and removed', () => {
  const cases = [
    ['a​b', 'zero-width'], ['a⁠b', 'zero-width'], ['a﻿b', 'zero-width'],
    ['a‮b', 'bidi'], ['a⁦b', 'bidi'], ['a­b', 'soft-hyphen'],
    ['a\u{E0041}b', 'tag'], ['a᠎b', 'mvs'], ['a️b', 'variation-selector'],
    ['a‍b', 'zero-width'],
  ];
  for (const [input, kind] of cases) {
    assert.deepEqual(kinds(inspectText(input)), [kind], input);
    const c = cleanText(input);
    assert.equal(c.text, 'ab', input);
    assert.equal(c.removed, 1, input);
  }
});

test('odd spaces become plain spaces', () => {
  for (const sp of [' ', ' ', ' ', ' ', ' ', '　']) {
    const c = cleanText(`a${sp}b`);
    assert.equal(c.text, 'a b');
    assert.equal(c.replaced, 1);
    assert.deepEqual(kinds(c), ['odd-space']);
  }
});

test('Cyrillic or Greek look-alikes inside a Latin word become Latin', () => {
  const c = cleanText('the pаyment and cοst');
  assert.equal(c.text, 'the payment and cost');
  assert.equal(c.replaced, 2);
  assert.deepEqual(kinds(c), ['homoglyph', 'homoglyph']);
});

test('words written wholly in Cyrillic or Greek are left alone', () => {
  for (const s of ['сор', 'Москва', 'λόγος']) assert.equal(cleanText(s).text, s);
});

test('emoji sequences, keycaps and ordinary typography survive', () => {
  const keep = '👨‍👩‍👧 👉 ⚠️ 1️⃣ ❤️‍🔥 £20 café “quoted” – … 🙂';
  const r = inspectText(keep);
  assert.equal(r.suspicious, false, JSON.stringify(r.findings));
  assert.equal(cleanText(keep).text, keep);
});

test('a BOM at offset 0 is left alone', () => {
  assert.equal(inspectText('﻿hello').suspicious, false);
});

test('AI frontmatter keys go; other keys, their values and order stay', () => {
  const md = '---\ntitle: "Claude and OpenAI, compared"\ngenerator: "some tool"\nai_model: x\nexcerpt: "An Anthropic story"\nprompt: |\n  write me\n  an essay\ntags: ["ai"]\n---\n\nBody.\n';
  const c = cleanText(md);
  assert.equal(c.text, '---\ntitle: "Claude and OpenAI, compared"\nexcerpt: "An Anthropic story"\ntags: ["ai"]\n---\n\nBody.\n');
  assert.deepEqual(kinds(c), ['ai-frontmatter', 'ai-frontmatter', 'ai-frontmatter']);
  assert.equal(c.removed, 3);
});

test('data URIs are stripped, alt text kept', () => {
  const c = cleanText('See ![chart](data:image/png;base64,AAAA) and <img src="data:image/gif;base64,R0">.');
  assert.equal(c.text, 'See chart and <img src="">.');
  assert.deepEqual(kinds(c), ['data-uri', 'data-uri']);
});

test('findings carry line numbers and a summary', () => {
  const r = inspectText('one\ntw​o\nthree‮​');
  assert.deepEqual(r.findings.map((f) => f.line), [2, 3, 3]);
  assert.equal(r.findings[0].codepoint, 'U+200B');
  assert.equal(summariseFindings(r.findings), '2 zero-width, 1 bidi');
  assert.equal(summariseFindings([]), '');
});

test('inspectFile / cleanFile work on a file and clean in place', () => {
  const tmp = path.join(os.tmpdir(), `layera-${Date.now()}.md`);
  fs.writeFileSync(tmp, 'Clean text​ with a zero-width space.\n');
  try {
    assert.equal(inspectFile(tmp).suspicious, true);
    const c = cleanFile(tmp);
    assert.equal(c.changed, true);
    assert.equal(c.report.removed, 1);
    assert.equal(fs.readFileSync(tmp, 'utf8'), 'Clean text with a zero-width space.\n');
    assert.equal(inspectFile(tmp).suspicious, false);
    assert.equal(cleanFile(tmp).changed, false);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

test('serviceUp is an in-repo self-check and passes', () => {
  assert.equal(serviceUp(), true);
});

test('plausibleClean rejects empty or heavily shortened output', () => {
  assert.equal(plausibleClean(1000, 998), true);
  assert.equal(plausibleClean(1000, 0), false);
  assert.equal(plausibleClean(1000, 500), false);
});
```

- [ ] **Step 2: Run to verify failure** — `LINE_NO_FILE_LOG=1 node --test scripts/line/test/layera.test.mjs` → FAIL (`inspectText` is not exported).

- [ ] **Step 3: Implement** — replace `scripts/line/layera.mjs` with:

```js
import fs from 'node:fs';
import path from 'node:path';
import { log } from './env.mjs';

// Layer A, in-repo since 12 Oct 2026. It used to call the watermarks-remover
// Docker service; that service's 9 Oct release changed its reply shape and
// failed every essay. This module is pure and synchronous: no network, no
// service. It removes invisible carriers, normalises odd spaces and
// look-alike letters, and strips AI-provenance frontmatter keys and data
// URIs. Frontmatter VALUES are never inspected: essays about Anthropic or
// OpenAI name them in title, excerpt and seoDescription.

const PICTO = /\p{Extended_Pictographic}/u;
const SKIN = /[\u{1F3FB}-\u{1F3FF}]/u;
const KEYCAP_BASE = /^[0-9#*]$/;
const LATIN = /\p{Script=Latin}/u;
const ODD_SPACE = new Set([' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', '　']);

// Cyrillic and Greek letters that render as a Latin letter.
const CONFUSABLES = {
  'а': 'a', 'в': 'B', 'е': 'e', 'к': 'k', 'м': 'M', 'н': 'H', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 'T', 'у': 'y', 'х': 'x',
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X',
  'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'І': 'I', 'Ј': 'J', 'Ѕ': 'S',
  'ο': 'o', 'ν': 'v', 'ρ': 'p', 'τ': 't', 'α': 'a', 'ι': 'i', 'κ': 'k', 'υ': 'u',
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X',
};

const AI_KEY = /^(generator|generated_by|ai_[\w-]*|model|prompt|llm|assistant)$/i;

const hex = (ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

// What to do with one code point, given its neighbours: null (keep), or
// [kind, replacement] where replacement '' removes it.
function classify(ch, prev, next, atStart) {
  const cp = ch.codePointAt(0);
  if (cp === 0xFEFF) return atStart ? null : ['zero-width', ''];
  if (cp === 0x200D) {
    const emojiBefore = prev && (PICTO.test(prev) || prev === '️' || SKIN.test(prev));
    return emojiBefore && next && PICTO.test(next) ? null : ['zero-width', ''];
  }
  if ((cp >= 0x200B && cp <= 0x200F) || (cp >= 0x2060 && cp <= 0x2064)) return ['zero-width', ''];
  if ((cp >= 0x202A && cp <= 0x202E) || (cp >= 0x2066 && cp <= 0x2069)) return ['bidi', ''];
  if (cp === 0x00AD) return ['soft-hyphen', ''];
  if (cp >= 0xE0000 && cp <= 0xE007F) return ['tag', ''];
  if (cp === 0x180E) return ['mvs', ''];
  if ((cp >= 0xFE00 && cp <= 0xFE0F) || (cp >= 0xE0100 && cp <= 0xE01EF)) {
    if (prev && PICTO.test(prev)) return null;
    if (prev && KEYCAP_BASE.test(prev) && next === '⃣') return null;
    return ['variation-selector', ''];
  }
  if (ODD_SPACE.has(ch)) return ['odd-space', ' '];
  return null;
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

function charPass(text, findings) {
  const chars = Array.from(text);
  let out = '', idx = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const c = classify(ch, chars[i - 1], chars[i + 1], i === 0);
    if (c) { findings.push({ kind: c[0], codepoint: hex(ch), line: lineAt(text, idx) }); out += c[1]; } else out += ch;
    idx += ch.length;
  }
  return out;
}

function homoglyphPass(text, findings) {
  return text.replace(/[\p{L}\p{M}]+/gu, (word, offset) => {
    const letters = Array.from(word);
    const odd = letters.filter((l) => CONFUSABLES[l]);
    if (!odd.length) return word;
    const rest = letters.filter((l) => !CONFUSABLES[l] && /\p{L}/u.test(l));
    if (!rest.length || !rest.every((l) => LATIN.test(l))) return word;
    return letters.map((l) => {
      if (!CONFUSABLES[l]) return l;
      findings.push({ kind: 'homoglyph', codepoint: hex(l), line: lineAt(text, offset) });
      return CONFUSABLES[l];
    }).join('');
  });
}

function frontmatterPass(text, findings) {
  const m = text.match(/^(﻿?---\n)([\s\S]*?\n)(---\n)/);
  if (!m) return text;
  const lines = m[2].split('\n');
  const kept = [];
  let dropping = false;
  lines.forEach((l, i) => {
    const key = l.match(/^([A-Za-z0-9_-]+):/);
    if (key) dropping = AI_KEY.test(key[1]);
    else if (!/^\s/.test(l)) dropping = false;
    if (dropping) { if (key) findings.push({ kind: 'ai-frontmatter', codepoint: key[1], line: i + 2 }); return; }
    kept.push(l);
  });
  return m[1] + kept.join('\n') + m[3] + text.slice(m[0].length);
}

function dataUriPass(text, findings) {
  return text
    .replace(/!?\[([^\]]*)\]\(data:[^)]*\)/g, (s, alt, offset) => { findings.push({ kind: 'data-uri', codepoint: 'data:', line: lineAt(text, offset) }); return alt; })
    .replace(/(src|href)="data:[^"]*"/g, (s, attr, offset) => { findings.push({ kind: 'data-uri', codepoint: 'data:', line: lineAt(text, offset) }); return `${attr}=""`; });
}

const REPLACING = new Set(['odd-space', 'homoglyph']);

export function cleanText(text) {
  const findings = [];
  let out = charPass(text, findings);
  out = homoglyphPass(out, findings);
  out = frontmatterPass(out, findings);
  out = dataUriPass(out, findings);
  const replaced = findings.filter((f) => REPLACING.has(f.kind)).length;
  return { text: out, removed: findings.length - replaced, replaced, findings };
}

export function inspectText(text) {
  const { findings } = cleanText(text);
  return { suspicious: findings.length > 0, findings };
}

export function summariseFindings(findings = []) {
  const n = new Map();
  for (const f of findings) n.set(f.kind, (n.get(f.kind) ?? 0) + 1);
  return [...n].map(([k, v]) => `${v} ${k}`).join(', ');
}

export function plausibleClean(beforeLen, afterLen) {
  return afterLen > 0 && afterLen >= beforeLen * 0.9;
}

export function inspectFile(file) {
  const r = inspectText(fs.readFileSync(file, 'utf8'));
  return { suspicious: r.suspicious, report: { findings: r.findings }, kind: 'text' };
}

export function cleanFile(file) {
  const before = fs.readFileSync(file, 'utf8');
  const c = cleanText(before);
  if (!plausibleClean(before.length, c.text.length)) {
    throw new Error(`Layer A produced an implausible result (${c.text.length} chars vs ${before.length})`);
  }
  const changed = c.text !== before;
  if (changed) fs.writeFileSync(file, c.text);
  log('layera', `${path.basename(file)} ${changed ? `cleaned (${summariseFindings(c.findings)})` : 'already clean'}`);
  return { changed, report: { removed: c.removed, replaced: c.replaced, findings: c.findings } };
}

// Kept under its old name so the gate's prerequisite check still guards
// spend: the in-repo cleaner must remove a planted zero-width space.
export function serviceUp() {
  try {
    return cleanText('a​b').text === 'ab';
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests** — `LINE_NO_FILE_LOG=1 node --test scripts/line/test/layera.test.mjs` → all PASS.

- [ ] **Step 5: Commit** — `git add scripts/line/layera.mjs scripts/line/test/layera.test.mjs && git commit -m "Layer A in-repo: pure Unicode and frontmatter cleaner, no service"`

---

### Task 2: Published-essay guard

**Files:**
- Create: `scripts/line/test/layera-corpus.test.mjs`

**Interfaces:**
- Consumes: `cleanText` from Task 1.

Found on 12 Oct 2026 (paste residue in old hand-written essays): non-breaking spaces in `10-commandments-experienced-cfo`, `10-commandments-newbie-cfo`, `importance-treasurers-finance`, `mastering-matrix-how-curiosity-grit-shape-winning-teams` (also hair spaces), `reflecting-year-insights-final-thoughts-2024`, `symphony-success-ideas-execution-consistency`. The gate never re-runs on published essays; these are allowed `odd-space` only.

- [ ] **Step 1: Write the test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cleanText } from '../layera.mjs';

const DIR = new URL('../../../src/content/insights/', import.meta.url).pathname;

// Owner-reviewed 12 Oct 2026: paste residue in essays written before the
// gate existed. Only these files, and only odd spaces, may differ.
const ODD_SPACE_ALLOWED = new Set([
  '10-commandments-experienced-cfo.md',
  '10-commandments-newbie-cfo.md',
  'importance-treasurers-finance.md',
  'mastering-matrix-how-curiosity-grit-shape-winning-teams.md',
  'reflecting-year-insights-final-thoughts-2024.md',
  'symphony-success-ideas-execution-consistency.md',
]);

test('Layer A leaves every published essay alone, bar the allowlisted odd spaces', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 59);
  for (const f of files) {
    const { findings } = cleanText(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const unexpected = findings.filter((x) => !(x.kind === 'odd-space' && ODD_SPACE_ALLOWED.has(f)));
    assert.deepEqual(unexpected, [], `${f}: ${JSON.stringify(unexpected.slice(0, 3))}`);
  }
});
```

- [ ] **Step 2: Run** — `LINE_NO_FILE_LOG=1 node --test scripts/line/test/layera-corpus.test.mjs` → PASS. If it fails, stop and show the owner the finding; never widen a rule to pass.

- [ ] **Step 3: Commit** — `git add scripts/line/test/layera-corpus.test.mjs && git commit -m "Layer A: guard the published essays"`

---

### Task 3: Gate wiring for Layer A

**Files:**
- Modify: `scripts/line/gate.mjs` (imports, `serviceDownError`, Layer A report line)
- Modify: `scripts/line/test/gate.test.mjs` (the "refuses to start" assertions)

**Interfaces:**
- Consumes: `inspectFile`, `cleanFile`, `serviceUp`, `summariseFindings` (Task 1).

- [ ] **Step 1: Update the failing-test expectations** in `gate.test.mjs`, test `runGate refuses to start when the watermarks service is down, and spends nothing`: rename to `runGate refuses to start when the Layer A self-check fails, and spends nothing`; replace the two `r.error.message` regexes with `assert.match(r.error.message, /Layer A self-check failed/);` and the report check with `assert.ok(report.includes('Layer A self-check failed'));`. Add a new test:

```js
test('the Layer A report line counts what was found', () => {
  const report = renderReport({ inPath: 'in.md', outPath: 'out.md', verdict: 'pass', fails: [], checks: {
    layera: { before: { suspicious: true, report: { findings: [{ kind: 'zero-width' }, { kind: 'zero-width' }, { kind: 'bidi' }] } }, after: { suspicious: false, report: { findings: [] } } },
  } });
  assert.match(report, /Before: SUSPICIOUS \(2 zero-width, 1 bidi\) · After: clean/);
});
```

- [ ] **Step 2: Run** — `LINE_NO_FILE_LOG=1 node --test scripts/line/test/gate.test.mjs` → the two tests FAIL.

- [ ] **Step 3: Implement** in `gate.mjs`:
  - import line becomes `import { inspectFile, cleanFile, serviceUp, summariseFindings } from './layera.mjs';`
  - `serviceDownError()` body becomes `return 'Layer A self-check failed: the in-repo cleaner (scripts/line/layera.mjs) did not remove a planted zero-width space';`
  - comment above `GATE_DEPS`: "…no test reaches the network or a paid model."
  - comment in `runGate` above the pre-check: "Layer A is the last step and cannot be skipped, so check the in-repo cleaner before anything costs money."
  - Layer A report line:

```js
const la = (s) => (s.suspicious ? `SUSPICIOUS${s.report?.findings?.length ? ` (${summariseFindings(s.report.findings)})` : ''}` : 'clean');
L.push('## 4. Layer A (invisible Unicode)', `Before: ${la(checks.layera.before)} · After: ${la(checks.layera.after)}`, '');
```

- [ ] **Step 4: Run** — `npm run test:line` → all PASS.

- [ ] **Step 5: Commit** — `git add scripts/line/gate.mjs scripts/line/test/gate.test.mjs && git commit -m "Gate: in-repo Layer A self-check and counted report line"`

---

### Task 4: Layer B pinned model and divergence

**Files:**
- Modify: `scripts/line/layerb.mjs`
- Modify: `scripts/line/test/layerb.test.mjs`
- Modify: `distribution/line/config.json`
- Modify: `scripts/line/gate.mjs` (Layer B report line)

**Interfaces:**
- Produces: `codexArgs(outFile, model) → string[]`; `layerBModel(cfg) → string` (throws when unset); `divergence(before, after) → { survived, total, rate }`; `LAYERB_MAX_SURVIVAL = 0.35`; `layerBEssay(in, out) → { changed, divergence: { survived, total, rate, warn } }`.

- [ ] **Step 1: Failing tests** — in `layerb.test.mjs` change the import to `import { codexArgs, buildPrompt, checkOutput, divergence, layerBModel, LAYERB_MAX_SURVIVAL } from '../layerb.mjs';`, change the first test to call `codexArgs('/tmp/out.md', 'gpt-5.5')` and add `assert.deepEqual(a.slice(0, 5), ['exec', '-m', 'gpt-5.5', '-c', 'service_tier=default']);`, then append:

```js
test('the Layer B model comes from repo config, never the global Codex config', () => {
  assert.equal(layerBModel({ models: { layerb: 'gpt-5.5' } }), 'gpt-5.5');
  assert.throws(() => layerBModel({ models: {} }), /models\.layerb/);
  assert.throws(() => codexArgs('/tmp/o.md'), /model/);
});

test('divergence: identical text survives whole, a full reword hardly at all', () => {
  const a = 'the board asked whether the company could rely on one supplier for the whole of its compute';
  assert.equal(divergence(a, a).rate, 1);
  const b = 'directors wanted to know if a single vendor might safely provide every bit of processing capacity the firm needs';
  assert.ok(divergence(a, b).rate < 0.1);
});

test('divergence ignores figures, names, quotations and links, which are meant to survive', () => {
  const a = 'Revenue rose 12% to £4.6bn at Anthropic. He said "we will not stop here" and [Reuters reported](https://x.example/a) it.';
  const r = divergence(a, a);
  assert.equal(r.total, 0);
  assert.equal(r.rate, 0);
});

test('the survival threshold is 35%', () => {
  assert.equal(LAYERB_MAX_SURVIVAL, 0.35);
});
```

- [ ] **Step 2: Run** — `LINE_NO_FILE_LOG=1 node --test scripts/line/test/layerb.test.mjs` → FAIL.

- [ ] **Step 3: Implement** in `layerb.mjs`:

```js
import { loadConfig } from './queue.mjs';

export const LAYERB_MAX_SURVIVAL = 0.35;

// Pinned by the repo since 12 Oct 2026: the global ~/.codex config named a
// model the ChatGPT account no longer accepts and Layer B failed for every
// essay. The repo decides the model; there is no fallback to the global one.
export function layerBModel(cfg = loadConfig()) {
  const m = cfg.models?.layerb;
  if (!m) throw new Error('Layer B: set models.layerb in distribution/line/config.json');
  return m;
}

export const codexArgs = (outFile, model) => {
  if (!model) throw new Error('codexArgs: a model is required');
  return ['exec', '-m', model, '-c', 'service_tier=default', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '-o', outFile];
};

// Share of the original's 3-word runs that survive the rewrite. Runs that
// touch a figure, a proper name, a quotation or a link are left out: those
// are meant to survive. The Layer B prompt asks that "few runs of three words
// survive unchanged"; this measures it.
const EXCLUDE = /\[[^\]]*\]\([^)]*\)|https?:\/\/\S+|"[^"]*"|“[^”]*”/g;
const WORD = /[\p{L}\p{N}%£$€'’.]+/gu;
const words = (s) => (s.match(WORD) ?? []).map((w) => w.replace(/[.]+$/, '').toLowerCase()).filter(Boolean);

function grams(segment) {
  const out = [];
  const toks = [...segment.matchAll(WORD)].map((m) => ({ raw: m[0].replace(/[.]+$/, ''), at: m.index }));
  for (let i = 0; i + 2 < toks.length; i++) {
    const tri = toks.slice(i, i + 3);
    const skip = tri.some((t, j) => {
      if (/[\d%£$€]/.test(t.raw)) return true;
      const sentenceStart = i + j === 0 || /[.!?:]\s*$/.test(segment.slice(0, t.at));
      return /^\p{Lu}/u.test(t.raw) && !sentenceStart;
    });
    if (!skip) out.push(tri.map((t) => t.raw.toLowerCase()).join(' '));
  }
  return out;
}

export function divergence(before, after) {
  const mine = before.split(EXCLUDE).flatMap(grams);
  const w = words(after);
  const theirs = new Set();
  for (let i = 0; i + 2 < w.length; i++) theirs.add(w.slice(i, i + 3).join(' '));
  const survived = mine.filter((g) => theirs.has(g)).length;
  return { survived, total: mine.length, rate: mine.length ? survived / mine.length : 0 };
}
```

  - In `layerBText`, build args with `codexArgs(out, layerBModel())`.
  - In `layerBEssay`, after `let newBody = layerBText(body, …)`:

```js
  let d = divergence(body, newBody);
  if (d.rate > LAYERB_MAX_SURVIVAL) {
    log('layerb', `${path.basename(inPath)}: ${(d.rate * 100).toFixed(0)}% of 3-word runs survived; retrying once`);
    const retry = layerBText(body, { kind: 'body' });
    const d2 = divergence(body, retry);
    if (d2.rate < d.rate) { newBody = retry; d = d2; }
  }
  const div = { ...d, warn: d.rate > LAYERB_MAX_SURVIVAL };
```
  (change `const newBody` to `let newBody`) and return `{ changed, divergence: div }`.
  - `distribution/line/config.json` `models` gains `"layerb": "gpt-5.5"`.
  - In `gate.mjs` `renderReport`, the Layer B line becomes:

```js
const lb = checks.layerb;
L.push('## 1. Layer B (Codex rewrite)', lb
  ? `${lb.changed} strings rewritten → ${path.basename(outPath)}${lb.divergence ? `; 3-gram survival ${(lb.divergence.rate * 100).toFixed(0)}% (target ≤ 35%)${lb.divergence.warn ? ' ⚠️ above target, kept after one retry' : ''}` : ''}`
  : 'skipped (fixture / corrections-only run)', '');
```

- [ ] **Step 4: Run** — `npm run test:line` → all PASS.

- [ ] **Step 5: Commit** — `git add scripts/line/layerb.mjs scripts/line/test/layerb.test.mjs distribution/line/config.json scripts/line/gate.mjs && git commit -m "Layer B: repo-pinned Codex model and 3-gram divergence check"`

---

### Task 5: Runbook, pipeline diagram, rollout

**Files:**
- Modify: `distribution/line/README.md`

- [ ] **Step 1:** Replace the "Prerequisites" section with: Layer A is in-repo (`scripts/line/layera.mjs`), no service; Layer B uses Codex with the model pinned in `config.json` `models.layerb`; the watermarks LaunchAgent is no longer needed by the gate.
- [ ] **Step 2:** Add a "## How an essay is made and checked" section with a Mermaid flowchart covering: Monday brief → owner `go` → draft (word band) → gate (Layer B → plagiarism → BrE → never-list → Claudish → humaniser → Layer A) → cover → final email → owner `publish` → publish (build, deploy, live check, push) → LinkedIn edition (same gate + humaniser post rules). Mark the owner decisions, the fail/park paths and the kill switch.
- [ ] **Step 3:** Smoke test: `node scripts/line/gate.mjs <published essay copy> <out> --report <r> --skip-layerb` → PASS, Layer A `clean`. Then one Layer B run on a short text to show the divergence line.
- [ ] **Step 4:** `launchctl bootout gui/$(id -u)/co.signal-to-noise.watermarks` (plist stays in `infra/`).
- [ ] **Step 5: Commit** — `git add distribution/line/README.md docs/superpowers/plans/2026-10-12-in-repo-layer-a-b.md && git commit -m "Runbook: in-repo layers and the essay pipeline diagram"`
