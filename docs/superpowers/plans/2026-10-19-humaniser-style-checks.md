# Humaniser style checks (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catch and, where safe, undo the stiff word swaps a rewrite introduces, and add phrase rules and corpus statistics to the humaniser, so an essay like the 12 Oct leash rewrite is fixed or held before it ships.

**Architecture:** A new folder `scripts/line/style/` of small pure modules (`text`, `lexicon`, `stats`, `patterns`, `compare`, `index`) plus a `calibrate.mjs` CLI that writes `distribution/line/style-baseline.json` from the owner's hand-written essays. `checkStyle()` is called by the gate (new step 3a, report sections 3a/3e/3f) and by `scripts/humanise.mjs`. Phase 2 (the local detector model, `lm.mjs`) gets its own plan once this phase's calibration numbers exist; here layer 3 reports "not run".

**Tech Stack:** Node ESM, `node:test`, no new npm dependency in Phase 1. The Zipf table is built once with Python `wordfreq` through `uv` and committed as JSON.

**Spec:** `docs/superpowers/specs/2026-10-19-humaniser-style-checks-design.md`

## Global Constraints

- British English in all comments, report text and commit messages.
- Generic "AI words" are the owner's voice: on their own they never fail; only a dense cluster (`ai-vocab-cluster`) warns.
- Every `fail` pattern must have zero hits on the human corpus (`src/content/insights/*.md` minus the slugs in `distribution/line/ledger.json`). A rule that hits the owner's essays is narrowed where the hit is a different construction, or downgraded to `warn` with a comment where it is the owner's own habit. It is never allowlisted per essay.
- `_sources/` is gitignored and the repo is public. No test may need `_sources/`, and no draft text from `_sources/` is ever copied into a committed file. Committed fixtures come only from git history of published essays.
- `npm run test:line` must stay network-free and model-free.
- Auto-fix never touches quotations (12+ chars), link text or targets, code, blockquotes, HTML or frontmatter.
- `meaning` mismatches always hold; unfixed `swap-rarer` / `phrasal-latinate` / `plain-list` hits hold; `drift` and `variation` warn.
- Stats: band is p5–p95 of the human corpus; texts under 300 words skip; the hold count is `max(3, k)` where `k` is the smallest count that holds ≤ 5% of human essays leave-one-out (see Task 3 note).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

**Deviation from the spec, recorded for the owner:** the spec says "three or more out of band holds" and "layer 2b holds ≤ 5% of human essays". With 18 metrics each on a p5–p95 band, about a quarter of the owner's own essays would have three or more outside by chance. The plan keeps 3 as the floor and lets calibration raise it until the ≤ 5% target is met, and records the chosen number in the baseline.

## File map

| File | Responsibility |
|---|---|
| Create `scripts/line/style/text.mjs` | Prose extraction, words, sentences, paragraphs, syllables, offset tokens, protected spans, frontmatter helpers |
| Create `scripts/line/style/data/build-zipf.py` | One-off builder for `zipf.json` from wordfreq |
| Create `scripts/line/style/data/zipf.json` | Word → Zipf frequency (top 60k English words) |
| Create `scripts/line/style/data/plain-map.json` | Stiff word (base form) → plain word |
| Create `scripts/line/style/data/lists.json` | Function words, particles, formal verbs, variation clusters, AI-vocab stems, nominal stoplist, domain words, hedges |
| Create `scripts/line/style/data/NOTICE.md` | Sources and licences |
| Create `scripts/line/style/lexicon.mjs` | Loads data; Zipf lookup; human corpus and owner vocabulary; plain-map lookup and inflection |
| Create `scripts/line/style/stats.mjs` | Metrics per text, Burrows' Delta, bands, leave-one-out hold count, band check |
| Create `scripts/line/style/patterns.mjs` | Layer 2a phrase rules and procedural pattern checks |
| Create `scripts/line/style/compare.mjs` | Layer 1: LCS diff, register hits, variation, meaning guard, drift, auto-fix |
| Create `scripts/line/style/index.mjs` | `checkStyle()`, `renderStyle()`, `loadBaseline()` |
| Create `scripts/line/style/calibrate.mjs` | CLI: builds and writes the baseline; prints AI-draft and pair numbers from `_sources/` when present |
| Create `distribution/line/style-baseline.json` | Written by `calibrate.mjs --write` |
| Create `scripts/line/fixtures/leash-stiff.md`, `leash-plain.md` | Regression fixture from commits 728f082 and 3f4710d |
| Create tests `scripts/line/test/style-*.test.mjs` | One per module, plus corpus and regression tests |
| Modify `scripts/line/claudish.mjs` | `plain-words` entry in `PROMPT_BANS` |
| Modify `scripts/line/humaniser.mjs` | `vetFlags` also rejects rewrites that trip the new pattern rules |
| Modify `scripts/line/gate.mjs` | Step 3a Register, report sections 3a/3e/3f, `GATE_DEPS.checkStyle` |
| Modify `scripts/humanise.mjs` | Style checks on every file, `--draft`, fixes written by `--apply` |
| Modify `distribution/line/README.md` | Diagram and runbook lines |
| Modify `package.json` | `style:calibrate` script |

---

### Task 1: Shared text utilities (`text.mjs`)

**Files:**
- Create: `scripts/line/style/text.mjs`
- Test: `scripts/line/test/style-text.test.mjs`

**Interfaces:**
- Consumes: `scannableText(md)` from `scripts/line/claudish.mjs`.
- Produces:
  - `stripFrontmatter(md) → string`
  - `frontmatterTitle(md) → string` ('' when absent)
  - `essayDate(md) → string` (the `date:` value, 'YYYY-MM-DD', or '')
  - `prose(md) → string` (scannable text, frontmatter, headings, list markers and emphasis removed)
  - `words(text) → string[]`
  - `sentences(text) → string[]`
  - `paragraphs(text) → string[]`
  - `syllables(word) → number`
  - `tokens(body) → { w, lower, at, end }[]` (offsets into `body`; `lower` has curly apostrophes straightened)
  - `protectedSpans(body) → [start, end][]`
  - `isProtected(spans, at, end) → boolean`

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/style-text.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripFrontmatter, frontmatterTitle, essayDate, prose, words, sentences, paragraphs, syllables, tokens, protectedSpans, isProtected } from '../style/text.mjs';

const MD = '---\ntitle: "The leash problem"\ndate: 2026-10-14\n---\n\n## A heading\n\nOne short line. Then a second, with a [link text](https://example.com/x) in it!\n\n"This is a quoted source sentence," she said.\n';

test('frontmatter helpers', () => {
  assert.equal(stripFrontmatter(MD).startsWith('\n## A heading'), true);
  assert.equal(frontmatterTitle(MD), 'The leash problem');
  assert.equal(essayDate(MD), '2026-10-14');
  assert.equal(frontmatterTitle('no frontmatter'), '');
});

test('prose drops headings, link targets and long quotations', () => {
  const p = prose(MD);
  assert.ok(!p.includes('heading'));
  assert.ok(!p.includes('example.com'));
  assert.ok(!p.includes('quoted source'));
  assert.ok(p.includes('link text'));
});

test('words, sentences, paragraphs', () => {
  assert.deepEqual(words("It's a well-known CFO's job, 42 times."), ["It's", 'a', 'well-known', "CFO's", 'job', 'times']);
  assert.equal(sentences('One. Two words here! Three?').length, 3);
  assert.equal(paragraphs('a b\n\nc d\n\n\n e').length, 3);
});

test('syllables heuristic on known words', () => {
  assert.equal(syllables('cat'), 1);
  assert.equal(syllables('water'), 2);
  assert.equal(syllables('decide'), 2);
  assert.equal(syllables('organisation'), 5);
});

test('tokens carry offsets into the body', () => {
  const body = 'They broke into it’s servers.';
  const t = tokens(body);
  assert.equal(t[1].w, 'broke');
  assert.equal(body.slice(t[1].at, t[1].end), 'broke');
  assert.equal(t[3].lower, "it's");
});

test('protected spans cover links, long quotes and code', () => {
  const body = 'See [the report](https://x.y/z) and "a quotation that is long enough" and `code here`.';
  const spans = protectedSpans(body);
  const at = body.indexOf('report');
  assert.equal(isProtected(spans, at, at + 6), true);
  const q = body.indexOf('quotation');
  assert.equal(isProtected(spans, q, q + 9), true);
  const c = body.indexOf('code');
  assert.equal(isProtected(spans, c, c + 4), true);
  const free = body.indexOf('See');
  assert.equal(isProtected(spans, free, free + 3), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-text.test.mjs`
Expected: FAIL with `Cannot find module '.../style/text.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// scripts/line/style/text.mjs
//
// Shared tokenising for the style checks (19 Oct 2026). Two views of one text:
// prose() for statistics, where quotations, links, code and headings are gone
// exactly as the Claudish test sees them; tokens() with offsets into the real
// body, for the auto-fix, which has to write back into the file.
import { scannableText } from '../claudish.mjs';

export const stripFrontmatter = (md) => md.replace(/^---\n[\s\S]*?\n---\n/, '');

const frontmatter = (md) => md.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
export const frontmatterTitle = (md) => frontmatter(md).match(/^title:\s*"?(.*?)"?\s*$/m)?.[1] ?? '';
export const essayDate = (md) => frontmatter(md).match(/^date:\s*"?(\d{4}-\d{2}-\d{2})/m)?.[1] ?? '';

export const prose = (md) => scannableText(stripFrontmatter(md))
  .replace(/^#{1,6}\s.*$/gm, ' ')
  .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
  .replace(/[*_]+/g, '')
  .replace(/[[\]]/g, '');

const WORD = /[A-Za-z][A-Za-z'’]*(?:-[A-Za-z]+)*/g;
export const words = (text) => text.match(WORD) ?? [];
export const sentences = (text) => text.replace(/\s+/g, ' ').trim()
  .split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/).filter((s) => words(s).length);
export const paragraphs = (text) => text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => words(p).length);

// The usual vowel-group heuristic. Off by one on some words ("penetrated" is
// 3, not 4); it is only ever compared with itself, draft against rewrite and
// essay against corpus, so the bias cancels.
export function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return Math.max(1, (trimmed.match(/[aeiouy]{1,2}/g) ?? []).length);
}

export const tokens = (body) => [...body.matchAll(WORD)].map((m) => ({
  w: m[0], lower: m[0].toLowerCase().replace(/’/g, "'"), at: m.index, end: m.index + m[0].length,
}));

// Never auto-fixed: a source's own words, link text and targets, code, HTML.
const PROTECT = [
  /```[\s\S]*?```/g, /`[^`]*`/g, /<svg[\s\S]*?<\/svg>/gi, /<[^>]+>/g,
  /["“][^"”\n]{12,}["”]/g, /^>.*$/gm, /\[[^\]]*\]\([^)]*\)/g, /https?:\/\/\S+/g,
];
export function protectedSpans(body) {
  const spans = [];
  for (const re of PROTECT) for (const m of body.matchAll(re)) spans.push([m.index, m.index + m[0].length]);
  return spans.sort((a, b) => a[0] - b[0]);
}
export const isProtected = (spans, at, end) => spans.some(([s, e]) => at < e && end > s);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-text.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/line/style/text.mjs scripts/line/test/style-text.test.mjs
git commit -m "Style checks: shared text utilities

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Vendored data and the lexicon (`lexicon.mjs`)

**Files:**
- Create: `scripts/line/style/data/build-zipf.py`, `zipf.json` (generated), `plain-map.json`, `lists.json`, `NOTICE.md`
- Create: `scripts/line/style/lexicon.mjs`
- Test: `scripts/line/test/style-lexicon.test.mjs`

**Interfaces:**
- Consumes: `prose`, `words` (Task 1); `ROOT` from `scripts/line/env.mjs`; `loadLedger` from `scripts/line/queue.mjs`.
- Produces:
  - `zipf(word) → number` (0 when unknown)
  - `PLAIN: Record<string, string>` (stiff base form → plain phrase)
  - `LISTS: { functionWords, particles, formalVerbs, variation, aiVocab, nominalStop, domain, hedges }`
  - `FUNCTION_WORDS: Set<string>`
  - `humanEssays({ dir?, exclude? }) → { slug, md }[]`
  - `humanVocab() → Map<word, essayCount>`
  - `ownerUses(word) → boolean` (used in ≥ 2 human essays)
  - `lookupPlain(token) → { base, plain, form } | null` where `form ∈ 'base'|'s'|'ed'|'ing'`
  - `inflectPlain(plain, form, prevWord?) → string`
  - `matchCase(original, replacement) → string`

- [ ] **Step 1: Build the Zipf table**

Create `scripts/line/style/data/build-zipf.py`:

```python
# Builds zipf.json from wordfreq's English data (CC BY-SA 4.0, see NOTICE.md).
# One-off; the output is committed. Run from the repo root:
#   uv run --with wordfreq python scripts/line/style/data/build-zipf.py
import json, pathlib, re
from wordfreq import top_n_list, zipf_frequency

words = [w for w in top_n_list('en', 60000) if re.fullmatch(r"[a-z][a-z'\-]*", w)]
out = {w: round(zipf_frequency(w, 'en'), 2) for w in words}
pathlib.Path(__file__).with_name('zipf.json').write_text(json.dumps(out, separators=(',', ':')))
print(len(out), 'words')
```

Run: `uv run --with wordfreq python scripts/line/style/data/build-zipf.py`
Expected: prints a count above 50000; `scripts/line/style/data/zipf.json` exists (about 1 MB).

Check two values: `node -e "const z=require('./scripts/line/style/data/zipf.json');console.log(z.broke,z.penetrated,z.the)"`
Expected: roughly `4.6 2.9 7.7` (exact decimals vary by wordfreq version; `the` > 7, `penetrated` < 3.5).

- [ ] **Step 2: Write the data files**

Create `scripts/line/style/data/plain-map.json`. Base forms only. Words the owner uses as finance terms (leverage, robust, acquire, subsidiary, utilisation, provide, permit, initial, mitigate, implement, envisage) are deliberately absent:

```json
{
  "utilise": "use",
  "utilize": "use",
  "facilitate": "help",
  "commence": "start",
  "commencement": "start",
  "terminate": "end",
  "termination": "end",
  "cessation": "end",
  "cease": "stop",
  "ascertain": "find out",
  "penetrate": "break into",
  "circumvent": "work around",
  "procure": "buy",
  "obtain": "get",
  "demonstrate": "show",
  "indicate": "show",
  "necessitate": "need",
  "constitute": "make up",
  "ameliorate": "improve",
  "expedite": "speed up",
  "disseminate": "spread",
  "elucidate": "explain",
  "enumerate": "list",
  "initiate": "start",
  "remunerate": "pay",
  "remuneration": "pay",
  "reside": "live",
  "retain": "keep",
  "apprise": "tell",
  "assist": "help",
  "assistance": "help",
  "attain": "reach",
  "convene": "meet",
  "deem": "think",
  "depart": "leave",
  "discontinue": "stop",
  "effectuate": "carry out",
  "enquire": "ask",
  "inquire": "ask",
  "notify": "tell",
  "possess": "have",
  "purport": "claim",
  "solicit": "ask for",
  "substantiate": "back up",
  "supersede": "replace",
  "transmit": "send",
  "augment": "add to",
  "eradicate": "wipe out",
  "exacerbate": "worsen",
  "alleviate": "ease",
  "confer": "give",
  "locate": "find",
  "modify": "change",
  "require": "need",
  "additional": "extra",
  "numerous": "many",
  "sufficient": "enough",
  "approximately": "about",
  "subsequently": "later",
  "subsequent": "later",
  "consequently": "so",
  "additionally": "also",
  "furthermore": "also",
  "henceforth": "from now on",
  "methodology": "method"
}
```

Create `scripts/line/style/data/lists.json`:

```json
{
  "functionWords": ["a","about","above","after","again","against","all","almost","also","although","always","am","among","an","and","another","any","anyone","anything","are","around","as","at","be","because","been","before","being","below","between","both","but","by","can","cannot","could","did","do","does","doing","done","down","during","each","either","else","enough","even","ever","every","few","for","from","further","had","has","have","having","he","her","here","hers","herself","him","himself","his","how","however","i","if","in","into","is","it","its","itself","just","least","less","let","like","many","may","me","might","more","most","much","must","my","myself","neither","never","no","nobody","none","nor","not","nothing","now","of","off","often","on","once","one","only","or","other","others","our","ours","ourselves","out","over","own","perhaps","quite","rather","same","she","should","since","so","some","something","still","such","than","that","the","their","theirs","them","themselves","then","there","therefore","these","they","this","those","though","through","thus","to","too","under","until","up","upon","us","very","was","we","were","what","whatever","when","where","whether","which","while","who","whom","whose","why","will","with","within","without","would","yet","you","your","yours","yourself","it's","that's","don't","doesn't","isn't","can't","won't"],
  "particles": ["up","out","into","round","off","down","over","through","back","on","in","around","away"],
  "formalVerbs": ["penetrate","circumvent","utilise","utilize","facilitate","commence","terminate","ascertain","necessitate","constitute","disseminate","elucidate","remunerate","effectuate","expedite","eradicate","exacerbate","alleviate","ameliorate","augment","procure","obtain","attain","convene","supersede"],
  "variation": [
    ["firm","company","business","organisation","enterprise"],
    ["cfo","finance chief","finance leader","finance director"],
    ["problem","issue","challenge","difficulty"],
    ["plan","strategy","approach","initiative"]
  ],
  "aiVocab": ["delv","tapestr","realm","robust","crucial","pivotal","underscor","seamless","navigat","leverag","testament","meticulous","intricat","multifaceted","landscape","nuanc","showcas","foster","bolster","garner","commendabl","noteworthy","paramount","holistic","synerg","embark","unwavering","profound","streamlin","comprehensive","notably","invaluable","elevat","harness"],
  "nominalStop": ["nation","station","question","mention","portion","moment","comment","payment","apartment","department","government","element","document","instrument","monument","segment","city","university","community","entity","business","witness","sentence","science","experience","balance","instance","evidence","finance","audience","conference","distance","silence","violence","difference","sequence","residence","defence","licence","chance","announcement","statement","investment","management","agreement","settlement","equipment","attention","position","condition","population","generation","relation","election","tradition","million","billion","trillion","opinion","region","division","decision","television"],
  "domain": ["capital","allocation","investment","investments","investor","investors","valuation","liquidity","inflation","deflation","depreciation","amortisation","dividend","dividends","revenue","revenues","operating","financial","company","companies","technology","intelligence","artificial","economy","economic","accounting","regulator","regulators","regulation","treasury","director","directors","executive","executives","officer","superintelligence","ultraintelligent","energy","industry","interest","currency","balance","material","computing","algorithm","analysis","february","january","america","american","europe","european","australia","australian","anthropic","nvidia","openai","alphabet","microsoft"],
  "hedges": ["may","might","could","perhaps","possibly","potentially","arguably","likely","somewhat","seemingly","apparently","conceivably","presumably"]
}
```

Create `scripts/line/style/data/NOTICE.md`:

```markdown
# Style-check data: sources and licences

- `zipf.json`: Zipf word frequencies derived from **wordfreq** by Robyn Speer
  (https://github.com/rspeer/wordfreq), data licensed **CC BY-SA 4.0**. This
  derived table is therefore also CC BY-SA 4.0. Rebuild with `build-zipf.py`.
- `plain-map.json`: written for this repo. Entries were guided by the GOV.UK
  style guide's "words to avoid" (Open Government Licence v3.0) and by plain
  English practice generally. No list is copied; the Plain English Campaign
  A–Z is copyrighted and was not used as a source text.
- `lists.json`: `aiVocab` stems follow the excess-vocabulary findings of
  Kobak et al. (2024, "Delving into ChatGPT usage in academic writing through
  excess vocabulary") and Liang et al. (2024), and Wikipedia's "Signs of AI
  writing" (CC BY-SA 4.0); stems are facts, cited not copied. The function-word
  list is the usual closed-class English set used for Burrows' Delta.
```

- [ ] **Step 3: Write the failing test**

```js
// scripts/line/test/style-lexicon.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { zipf, PLAIN, LISTS, FUNCTION_WORDS, humanEssays, ownerUses, lookupPlain, inflectPlain, matchCase } from '../style/lexicon.mjs';

test('zipf: common words beat rare ones; unknown is 0', () => {
  assert.ok(zipf('the') > 7);
  assert.ok(zipf('broke') > zipf('penetrated'));
  assert.equal(zipf('zzqxv'), 0);
  assert.equal(zipf('Broke'), zipf('broke'));
});

test('data files load', () => {
  assert.equal(PLAIN.penetrate, 'break into');
  assert.ok(FUNCTION_WORDS.has('the'));
  assert.ok(LISTS.particles.includes('into'));
});

test('human corpus excludes the line ledger', () => {
  const slugs = humanEssays().map((e) => e.slug);
  assert.ok(slugs.length >= 59);
  assert.ok(!slugs.includes('the-leash-problem'));
  assert.equal(ownerUses('the'), true);
});

test('lookupPlain finds the base form and the inflection', () => {
  assert.deepEqual(lookupPlain('penetrated'), { base: 'penetrate', plain: 'break into', form: 'ed' });
  assert.deepEqual(lookupPlain('circumventing'), { base: 'circumvent', plain: 'work around', form: 'ing' });
  assert.deepEqual(lookupPlain('utilises'), { base: 'utilise', plain: 'use', form: 's' });
  assert.deepEqual(lookupPlain('conferred'), { base: 'confer', plain: 'give', form: 'ed' });
  assert.deepEqual(lookupPlain('numerous'), { base: 'numerous', plain: 'many', form: 'base' });
  assert.equal(lookupPlain('broke'), null);
});

test('inflectPlain conjugates the first word of the plain phrase', () => {
  assert.equal(inflectPlain('break into', 'ed'), 'broke into');
  assert.equal(inflectPlain('break into', 'ed', 'had'), 'broken into');
  assert.equal(inflectPlain('work around', 'ing'), 'working around');
  assert.equal(inflectPlain('use', 's'), 'uses');
  assert.equal(inflectPlain('have', 's'), 'has');
  assert.equal(inflectPlain('stop', 'ed'), 'stopped');
  assert.equal(inflectPlain('carry out', 'ed'), 'carried out');
  assert.equal(inflectPlain('wipe out', 'ing'), 'wiping out');
  assert.equal(inflectPlain('speed up', 'ed'), 'sped up');
  assert.equal(inflectPlain('many', 'base'), 'many');
});

test('matchCase keeps a capital at the start of a sentence', () => {
  assert.equal(matchCase('Penetrated', 'broke into'), 'Broke into');
  assert.equal(matchCase('penetrated', 'broke into'), 'broke into');
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-lexicon.test.mjs`
Expected: FAIL with `Cannot find module '.../style/lexicon.mjs'`

- [ ] **Step 5: Write the implementation**

```js
// scripts/line/style/lexicon.mjs
//
// Vendored data for the style checks (sources in data/NOTICE.md) and the
// owner's own vocabulary, read from the essays he wrote by hand. A word he has
// used in two or more of them is his, however rare it is in English.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../env.mjs';
import { loadLedger } from '../queue.mjs';
import { prose, words } from './text.mjs';

const DATA = new URL('./data/', import.meta.url).pathname;
const json = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const INSIGHTS = path.join(ROOT, 'src', 'content', 'insights');

let ZIPF;
export const zipf = (w) => (ZIPF ??= json('zipf.json'))[w.toLowerCase().replace(/’/g, "'")] ?? 0;
export const PLAIN = json('plain-map.json');
export const LISTS = json('lists.json');
export const FUNCTION_WORDS = new Set(LISTS.functionWords);

// The essays the owner wrote, never the line's own output.
export function humanEssays({ dir = INSIGHTS, exclude = loadLedger().published.map((p) => p.slug) } = {}) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !exclude.includes(f.slice(0, -3))).sort()
    .map((f) => ({ slug: f.slice(0, -3), md: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

let VOCAB;
export function humanVocab() {
  if (VOCAB) return VOCAB;
  VOCAB = new Map();
  for (const { md } of humanEssays()) {
    for (const w of new Set(words(prose(md)).map((x) => x.toLowerCase().replace(/’/g, "'")))) VOCAB.set(w, (VOCAB.get(w) ?? 0) + 1);
  }
  return VOCAB;
}
export const ownerUses = (w) => (humanVocab().get(w.toLowerCase()) ?? 0) >= 2;

// Candidate base forms for an inflected token, most literal first.
function bases(t) {
  const c = [[t, 'base']];
  if (t.endsWith('ies')) c.push([t.slice(0, -3) + 'y', 's']);
  if (t.endsWith('es')) c.push([t.slice(0, -2), 's']);
  if (t.endsWith('s')) c.push([t.slice(0, -1), 's']);
  if (t.endsWith('ied')) c.push([t.slice(0, -3) + 'y', 'ed']);
  if (t.endsWith('ed')) {
    c.push([t.slice(0, -2), 'ed'], [t.slice(0, -1), 'ed']);
    if (t.at(-3) === t.at(-4)) c.push([t.slice(0, -3), 'ed']);
  }
  if (t.endsWith('ing')) {
    c.push([t.slice(0, -3), 'ing'], [t.slice(0, -3) + 'e', 'ing']);
    if (t.at(-4) === t.at(-5)) c.push([t.slice(0, -4), 'ing']);
  }
  return c;
}

export function lookupPlain(token) {
  const t = token.toLowerCase();
  for (const [base, form] of bases(t)) if (Object.hasOwn(PLAIN, base)) return { base, plain: PLAIN[base], form };
  return null;
}

const PAST = { break: 'broke', get: 'got', give: 'gave', go: 'went', make: 'made', take: 'took', set: 'set', put: 'put', run: 'ran', find: 'found', keep: 'kept', hold: 'held', buy: 'bought', bring: 'brought', think: 'thought', cut: 'cut', let: 'let', write: 'wrote', tell: 'told', meet: 'met', leave: 'left', speed: 'sped', spread: 'spread', draw: 'drew', pay: 'paid', have: 'had', say: 'said' };
const PARTICIPLE = { ...PAST, break: 'broken', give: 'given', go: 'gone', take: 'taken', write: 'written', draw: 'drawn' };
const S_FORM = { have: 'has', do: 'does', go: 'goes' };
const DOUBLE = new Set(['set', 'put', 'cut', 'let', 'get', 'run', 'stop', 'plan', 'drop', 'ship', 'step']);
// After these, "-ed" is a participle: "had penetrated" → "had broken into".
const AUX = new Set(['have', 'has', 'had', 'having', 'be', 'been', 'being', 'is', 'are', 'was', 'were', "'s", 'get', 'got']);

function inflectWord(w, form, prev) {
  if (form === 'base') return w;
  if (form === 's') return S_FORM[w] ?? (/(?:s|x|z|ch|sh)$/.test(w) ? w + 'es' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's');
  if (form === 'ing') {
    if (w.endsWith('ie')) return w.slice(0, -2) + 'ying';
    if (DOUBLE.has(w)) return w + w.at(-1) + 'ing';
    if (w.endsWith('e') && !w.endsWith('ee')) return w.slice(0, -1) + 'ing';
    return w + 'ing';
  }
  const table = AUX.has(prev ?? '') ? PARTICIPLE : PAST;
  if (table[w]) return table[w];
  if (w.endsWith('e')) return w + 'd';
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ied';
  if (DOUBLE.has(w)) return w + w.at(-1) + 'ed';
  return w + 'ed';
}

export function inflectPlain(plain, form, prevWord = null) {
  const [first, ...rest] = plain.split(' ');
  return [inflectWord(first, form, prevWord?.toLowerCase()), ...rest].join(' ');
}

export const matchCase = (original, replacement) =>
  (/^[A-Z]/.test(original) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-lexicon.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/line/style/data scripts/line/style/lexicon.mjs scripts/line/test/style-lexicon.test.mjs
git commit -m "Style checks: vendored word data and the lexicon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Statistics (`stats.mjs`)

**Files:**
- Create: `scripts/line/style/stats.mjs`
- Test: `scripts/line/test/style-stats.test.mjs`

**Interfaces:**
- Consumes: `prose, words, sentences, paragraphs, syllables` (Task 1); `LISTS, FUNCTION_WORDS, zipf, ownerUses` (Task 2).
- Produces:
  - `MIN_WORDS = 300`
  - `METRIC_IDS: string[]` (18 ids, see code)
  - `mtld(words) → number`
  - `metrics(md) → { words, sylPerWord, fw, [id]: number }` (every id in `METRIC_IDS` except `delta`)
  - `centroidOf(metricsList) → { [functionWord]: { mean, sd } }`
  - `delta(fw, centroid) → number`
  - `buildBands(metricsList, centroid) → { [id]: { p5, p25, p50, p75, p95 } }`
  - `looOuts(metricsList) → number[]` (per essay: metrics out of band against bands built from the others)
  - `chooseHoldAt(outs) → number` (≥ 3)
  - `bandCheck(m, baseline) → { status, values?, out: { id, value, p5, p95 }[], hold }`

**Note on the hold count:** the spec's "three or more out of band holds" combined with "holds ≤ 5% of human essays" cannot both hold with 18 metrics on p5–p95 bands (about 25% of essays would have three outside by chance). `chooseHoldAt` keeps 3 as the floor and raises it until leave-one-out holds ≤ 5%. The value is written to the baseline as `holdAt`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/style-stats.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_WORDS, METRIC_IDS, mtld, metrics, centroidOf, delta, buildBands, looOuts, chooseHoldAt, bandCheck } from '../style/stats.mjs';

const varied = 'We cut the budget. Then, after a long and difficult quarter in which nobody on the board could agree on what had gone wrong, we cut it again. It worked.';
const flat = 'The company reviewed the budget carefully. The company adjusted the forecast quickly. The company reported the results clearly.';

test('sentence-length variation: varied prose scores higher than flat prose', () => {
  assert.ok(metrics(varied)['sent-cv'] > metrics(flat)['sent-cv']);
});

test('contractions and first person per 1,000 words', () => {
  const m = metrics("We don't know. I can't say. It's late.");
  assert.ok(m.contractions > 0);
  assert.ok(m['first-person'] > 0);
});

test('nominalisations count, stoplisted nouns do not', () => {
  assert.ok(metrics('The implementation of the optimisation required consideration.').nominal > 0);
  assert.equal(metrics('The government made a payment this moment.').nominal, 0);
});

test('mtld: repetition lowers lexical diversity', () => {
  const rep = Array(60).fill('the cat sat').join(' ').split(' ');
  const rich = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango'.split(' ');
  assert.ok(mtld(rich) > mtld(rep));
});

test('metrics returns every id but delta', () => {
  const m = metrics(varied);
  for (const id of METRIC_IDS) if (id !== 'delta') assert.equal(typeof m[id], 'number', id);
  assert.equal(typeof m.fw.the, 'number');
});

test('bands, delta and leave-one-out on a synthetic corpus', () => {
  const ms = Array.from({ length: 40 }, (_, i) => {
    const m = metrics(varied);
    for (const id of METRIC_IDS) if (id !== 'delta') m[id] = 10 + (i % 10);
    m.words = 500;
    return m;
  });
  const c = centroidOf(ms);
  assert.equal(delta(ms[0].fw, c), 0);
  const bands = buildBands(ms, c);
  assert.ok(bands.nominal.p5 <= bands.nominal.p50 && bands.nominal.p50 <= bands.nominal.p95);
  const outs = looOuts(ms);
  assert.equal(outs.length, 40);
  const k = chooseHoldAt(outs);
  assert.ok(k >= 3);
  assert.ok(outs.filter((o) => o >= k).length / outs.length <= 0.05);
});

test('bandCheck: short text skipped, missing baseline reported, out-of-band counted', () => {
  assert.equal(bandCheck(metrics(varied), null).status, 'not calibrated');
  const base = { holdAt: 3, centroid: {}, metrics: { 'sent-cv': { p5: 0, p95: 0.0001 } } };
  assert.match(bandCheck(metrics(varied), base).status, /skipped/);
  const long = { ...metrics(varied), words: MIN_WORDS + 1 };
  const r = bandCheck(long, base);
  assert.equal(r.out.length, 1);
  assert.equal(r.hold, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-stats.test.mjs`
Expected: FAIL with `Cannot find module '.../style/stats.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// scripts/line/style/stats.mjs
//
// Layer 2b (19 Oct 2026): stylometric statistics against the owner's own
// essays. Each metric is judged against the 5th–95th percentile band of his
// hand-written corpus. Detectors weigh the same features: sentence-length
// variation, participial clauses and nominalisations (Reinhart et al., PNAS
// 2025), lexical diversity, rare-word rate, function-word profile (Burrows).
import { prose, words, sentences, paragraphs, syllables } from './text.mjs';
import { LISTS, FUNCTION_WORDS, zipf, ownerUses } from './lexicon.mjs';

export const MIN_WORDS = 300;
export const METRIC_IDS = ['sent-cv', 'sent-short', 'sent-long', 'para-cv', 'nominal', 'participial', 'triads', 'coord-pairs',
  'opener-div', 'connective', 'mtld', 'flesch', 'rare', 'polysyllable', 'repeat-ngrams', 'delta', 'contractions', 'first-person'];

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const cv = (a) => (a.length > 1 && mean(a) ? sd(a) / mean(a) : 0);

export function mtld(ws, threshold = 0.72) {
  const pass = (arr) => {
    let factors = 0, types = new Set(), count = 0;
    for (const w of arr) {
      types.add(w); count++;
      if (types.size / count <= threshold) { factors++; types = new Set(); count = 0; }
    }
    if (count) factors += (1 - types.size / count) / (1 - threshold);
    return factors ? arr.length / factors : arr.length;
  };
  const lw = ws.map((w) => w.toLowerCase());
  return (pass(lw) + pass([...lw].reverse())) / 2;
}

const NOMINAL = /(?:tion|sion|ment|ness|ity|ance|ence|ism)s?$/;
const CONNECTIVE = /^(?:However|Moreover|Furthermore|Additionally|Indeed|Thus|Therefore|Consequently|Meanwhile|Nevertheless|Notably|Importantly|Ultimately)\b/;
const CONTRACTION = /\b(?:\w+n['’]t|\w+['’](?:re|ve|ll|d|m)|(?:it|that|there|what|here|he|she|let|who)['’]s)\b/gi;
const FIRST = new Set(['i', 'we', 'my', 'our', 'me', 'us', 'mine', 'ours']);

export function metrics(md) {
  const text = prose(md);
  const ws = words(text);
  const W = ws.length;
  const per1k = (n) => (W ? (n / W) * 1000 : 0);
  const sents = sentences(text);
  const lens = sents.map((s) => words(s).length);
  const lower = ws.map((w) => w.toLowerCase().replace(/’/g, "'"));
  const content = lower.filter((w) => !FUNCTION_WORDS.has(w));
  const stop = new Set(LISTS.nominalStop), domain = new Set(LISTS.domain);
  const firsts = sents.map((s) => words(s)[0]?.toLowerCase()).filter(Boolean);
  const fw = Object.fromEntries(LISTS.functionWords.map((f) => [f, 0]));
  for (const w of lower) if (Object.hasOwn(fw, w)) fw[w] += 1 / W;
  const grams = new Map();
  for (const n of [3, 4]) {
    for (let i = 0; i + n <= lower.length; i++) {
      const g = lower.slice(i, i + n);
      if (g.filter((w) => !FUNCTION_WORDS.has(w)).length < 2) continue;
      const k = g.join(' ');
      grams.set(k, (grams.get(k) ?? 0) + 1);
    }
  }
  // "X, Y and Z": weighted up when the three items are the same length.
  const triads = [...text.matchAll(/\b(\w+(?: \w+){0,2}), (\w+(?: \w+){0,2}),? and (\w+(?: \w+){0,2})\b/g)]
    .reduce((s, m) => s + (new Set([m[1], m[2], m[3]].map((x) => x.split(' ').length)).size === 1 ? 1.5 : 1), 0);
  const pairs = [...text.matchAll(/\b([a-z]{4,}) and ([a-z]{4,})\b/g)].filter((m) => !FUNCTION_WORDS.has(m[1]) && !FUNCTION_WORDS.has(m[2])).length;
  const participial = [...text.matchAll(/(?:^|[.!?]\s+|,\s+)[A-Za-z]+(?:ing|ed)\b/gm)].length;
  const syl = ws.map(syllables);
  const sylTotal = syl.reduce((a, b) => a + b, 0);
  return {
    words: W,
    sylPerWord: W ? sylTotal / W : 0,
    fw,
    'sent-cv': cv(lens),
    'sent-short': mean(lens.map((l) => (l < 8 ? 1 : 0))),
    'sent-long': mean(lens.map((l) => (l > 30 ? 1 : 0))),
    'para-cv': cv(paragraphs(text).map((p) => words(p).length)),
    nominal: per1k(lower.filter((w) => w.length >= 7 && NOMINAL.test(w) && !stop.has(w) && !stop.has(w.replace(/s$/, ''))).length),
    participial: per1k(participial),
    triads: per1k(triads),
    'coord-pairs': per1k(pairs),
    'opener-div': firsts.length ? new Set(firsts).size / firsts.length : 0,
    connective: mean(sents.map((s) => (CONNECTIVE.test(s) ? 1 : 0))),
    mtld: mtld(ws),
    flesch: W && sents.length ? 206.835 - 1.015 * (W / sents.length) - 84.6 * (sylTotal / W) : 0,
    rare: per1k(content.filter((w) => /^[a-z]+$/.test(w) && zipf(w) < 3 && !ownerUses(w)).length),
    polysyllable: per1k(ws.filter((w, i) => syl[i] >= 3 && !domain.has(lower[i])).length),
    'repeat-ngrams': per1k([...grams.values()].filter((c) => c >= 2).length),
    contractions: per1k((text.match(CONTRACTION) ?? []).length),
    'first-person': per1k(lower.filter((w) => FIRST.has(w)).length),
  };
}

export function centroidOf(ms) {
  const out = {};
  for (const f of LISTS.functionWords) {
    const v = ms.map((m) => m.fw[f] ?? 0);
    out[f] = { mean: mean(v), sd: sd(v) };
  }
  return out;
}

// Burrows' Delta: mean absolute z-score of function-word rates against the
// corpus centroid. High means the voice has moved.
export function delta(fw, centroid) {
  const z = Object.entries(centroid).filter(([, c]) => c.sd > 0).map(([f, c]) => Math.abs(((fw[f] ?? 0) - c.mean) / c.sd));
  return mean(z);
}

const pct = (sorted, p) => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

const valueOf = (m, id, centroid) => (id === 'delta' ? delta(m.fw, centroid) : m[id]);

export function buildBands(ms, centroid) {
  const out = {};
  for (const id of METRIC_IDS) {
    const v = ms.map((m) => valueOf(m, id, centroid)).sort((a, b) => a - b);
    out[id] = { p5: pct(v, 0.05), p25: pct(v, 0.25), p50: pct(v, 0.5), p75: pct(v, 0.75), p95: pct(v, 0.95) };
  }
  return out;
}

const outsAgainst = (m, bands, centroid) =>
  METRIC_IDS.filter((id) => { const v = valueOf(m, id, centroid); return v < bands[id].p5 || v > bands[id].p95; });

export function looOuts(ms) {
  return ms.map((m, i) => {
    const others = ms.filter((_, j) => j !== i);
    const c = centroidOf(others);
    return outsAgainst(m, buildBands(others, c), c).length;
  });
}

export const HOLD_SHARE = 0.05;
export function chooseHoldAt(outs) {
  for (let k = 3; k <= METRIC_IDS.length; k++) if (outs.filter((o) => o >= k).length / outs.length <= HOLD_SHARE) return k;
  return METRIC_IDS.length + 1;
}

export function bandCheck(m, baseline) {
  if (!baseline) return { status: 'not calibrated', out: [], hold: false };
  if (m.words < MIN_WORDS) return { status: `skipped (under ${MIN_WORDS} words)`, out: [], hold: false };
  const values = Object.fromEntries(METRIC_IDS.map((id) => [id, valueOf(m, id, baseline.centroid)]));
  const out = [];
  for (const id of METRIC_IDS) {
    const b = baseline.metrics[id];
    if (!b) continue;
    if (values[id] < b.p5 || values[id] > b.p95) out.push({ id, value: values[id], p5: b.p5, p95: b.p95 });
  }
  return { status: 'checked', values, out, hold: out.length >= baseline.holdAt };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-stats.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/line/style/stats.mjs scripts/line/test/style-stats.test.mjs
git commit -m "Style checks: stylometric statistics and corpus bands

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Phrase rules (`patterns.mjs`) with the corpus guard

**Files:**
- Create: `scripts/line/style/patterns.mjs`
- Test: `scripts/line/test/style-patterns.test.mjs`, `scripts/line/test/style-corpus.test.mjs`

**Interfaces:**
- Consumes: `scanClaudish(md, { rules })` from `scripts/line/claudish.mjs`; `stripFrontmatter, frontmatterTitle, prose, paragraphs, sentences, words` (Task 1); `LISTS, FUNCTION_WORDS, humanEssays` (Task 2).
- Produces:
  - `PATTERN_RULES` (regex rules in the `claudish.mjs` shape)
  - `scanPatterns(md) → hit[]` where `hit = { id, severity, label, fix, line, match, count, allowed }`

- [ ] **Step 1: Write the failing tests**

```js
// scripts/line/test/style-patterns.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanPatterns } from '../style/patterns.mjs';

const ids = (md) => scanPatterns(md).map((h) => `${h.id}:${h.severity}`);

test('copula avoidance warns once and fails from the second', () => {
  assert.deepEqual(ids('The fund serves as a buffer.'), ['copula-avoid:warn']);
  assert.deepEqual(ids('The fund serves as a buffer. The board acts as a brake.'), ['copula-avoid:fail', 'copula-avoid:fail']);
});

test('ing-rider fails, a plain participle mid-sentence does not', () => {
  assert.ok(ids('Margins rose by 3%, highlighting the strength of the model.').includes('ing-rider:fail'));
  assert.deepEqual(ids('Highlighting costs early saved the quarter.'), []);
});

test('negative parallelism fails; the owner\'s "not just X but Y" is allowed', () => {
  assert.ok(ids("It's not a cost problem, it's a timing problem.").includes('neg-parallel:fail'));
  assert.ok(ids('The fight is less about money than about control.').includes('neg-parallel:fail'));
  assert.deepEqual(ids('This is not just a cost but a choice.'), []);
});

test('vague source fails without a name or link nearby, passes with one', () => {
  assert.ok(ids('Experts argue that rates will fall.').includes('vague-source:fail'));
  assert.deepEqual(ids('Experts argue, as Mohamed El-Erian put it last week, that rates will fall.').filter((x) => x.startsWith('vague')), []);
  assert.deepEqual(ids('Studies show [in the Fed survey](https://example.com) that rates fall.').filter((x) => x.startsWith('vague')), []);
});

test('chatbot residue fails', () => {
  assert.ok(ids('Certainly! Here is the plan.').includes('chatbot:fail'));
  assert.ok(ids('The figure is 4% oaicite:3 of revenue.').includes('chatbot:fail'));
});

test('title-case heading fails, sentence-case passes', () => {
  assert.ok(ids('## Why Finance Teams Should Own The Model\n\nText.').includes('title-case-heading:fail'));
  assert.deepEqual(ids('## Why finance teams should own the model\n\nText.'), []);
});

test('moral closer: a lesson opener on the last paragraph fails', () => {
  const md = '---\ntitle: "Cash is a timing problem"\n---\n\nFirst paragraph here.\n\nUltimately, cash wins.\n';
  assert.ok(ids(md).includes('moral-closer:fail'));
});

test('inflated significance, hedge stacks and false ranges only warn', () => {
  assert.deepEqual(ids('It is a testament to the team.'), ['inflated:warn']);
  assert.deepEqual(ids('Rates may potentially fall.'), ['hedge-stack:warn']);
  assert.deepEqual(ids('Everyone from bankers to bakers felt it.'), ['false-range:warn']);
});

test('one AI-vocabulary word is the owner\'s voice; a cluster warns', () => {
  assert.deepEqual(ids('A robust plan.'), []);
  assert.deepEqual(ids('We delve into a rich tapestry across the realm of a robust plan.'), ['ai-vocab-cluster:warn']);
});
```

```js
// scripts/line/test/style-corpus.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { humanEssays } from '../style/lexicon.mjs';
import { scanPatterns } from '../style/patterns.mjs';

// Owner rule: generic tells he uses himself are his voice. A `fail` pattern
// that hits his own essays is wrong, not the essay.
test('no fail pattern fires on any essay the owner wrote by hand', () => {
  const essays = humanEssays();
  assert.ok(essays.length >= 59);
  for (const { slug, md } of essays) {
    const fails = scanPatterns(md).filter((h) => h.severity === 'fail');
    assert.deepEqual(fails.map((h) => `${h.id} line ${h.line}: ${h.match}`), [], slug);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-patterns.test.mjs scripts/line/test/style-corpus.test.mjs`
Expected: FAIL with `Cannot find module '.../style/patterns.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// scripts/line/style/patterns.mjs
//
// Layer 2a (19 Oct 2026): phrase-level tells from Wikipedia's "Signs of AI
// writing" and the humanizer catalogues, in the claudish.mjs rule shape so the
// quotation exemptions and the report are shared. Every `fail` rule has zero
// hits on the owner's hand-written essays (style-corpus.test.mjs).
import { scanClaudish, scannableText } from '../claudish.mjs';
import { LISTS, FUNCTION_WORDS } from './lexicon.mjs';
import { stripFrontmatter, frontmatterTitle, prose, paragraphs, sentences, words } from './text.mjs';

export const PATTERN_RULES = [
  { id: 'copula-avoid', severity: 'warn', label: 'copula avoidance ("serves as")',
    re: /\b(?:serves?|served|serving|stands|stood|functions|acts|acted) as (?:a|an|the)\b|\bboasts?\b/gi,
    fix: '"is", "has"' },
  // Warn only: the owner uses "testament" and "pivotal" himself (claudish.mjs header).
  { id: 'inflated', severity: 'warn', label: 'inflated significance',
    re: /\b(?:a testament to|(?:pivotal|vital|key|crucial) role|underscores? the importance|setting the stage|indelible|evolving landscape|in today's (?:fast-paced|ever-changing|rapidly))/gi,
    fix: 'say what it did' },
  { id: 'ing-rider', severity: 'fail', label: 'sentence-final "-ing" rider',
    re: /,\s(?:highlighting|underscoring|ensuring|reflecting|fostering|showcasing|contributing to|emphasising|emphasizing|demonstrating|signalling|signaling|illustrating|underlining)\b[^.!?\n]*[.!?]/gi,
    fix: 'a full stop, then say who did what' },
  { id: 'neg-parallel', severity: 'fail', label: 'negative parallelism',
    re: /\b(?:it|this|that)(?:'s|’s| is| was) not (?:just |only |merely )?[^,.;!?\n]{1,60}[,;]\s*(?:it|this|that)(?:'s|’s| is| was)\b|\bno [^,.\n]{1,30}, no [^,.\n]{1,30}[,.]\s*(?:just|only)\b|\bless about [^.\n]{1,60}? than\b/gi,
    fix: 'state what it is' },
  { id: 'false-range', severity: 'warn', label: 'false range ("from X to Y")',
    re: /\bfrom (?:the |a |an )?(?!(?:time|start|top|bottom|left|right|beginning|morning|day|week|month|year|one|zero)\b)[a-z]+ to (?:the |a |an )?[a-z]+\b/gi,
    fix: 'name the actual set' },
  { id: 'hedge-stack', severity: 'warn', label: 'stacked hedges',
    re: new RegExp(`\\b(?:${LISTS.hedges.join('|')})\\b(?:\\W+\\w+){0,5}?\\W+(?:${LISTS.hedges.join('|')})\\b`, 'gi'),
    fix: 'one hedge, or none' },
  { id: 'chatbot', severity: 'fail', label: 'chatbot residue',
    re: /\bI hope this helps\b|\bCertainly!|\blet me know if you (?:have|need|would)\b|\bas of my (?:knowledge|last)\b|\bas an AI\b|oaicite|contentReference|turn\d+search\d*|\[cite:\s*\d+\]/gi,
    fix: 'delete it' },
];

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const hit = (id, severity, label, fix, line, match) => ({ id, severity, label, fix, line, match: match.trim().slice(0, 40), count: 1, allowed: 0 });

function titleCaseHeadings(body) {
  const out = [];
  for (const m of body.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const ws = m[1].split(/\s+/).slice(1).filter((w) => /^[A-Za-z]/.test(w) && w.replace(/[^A-Za-z]/g, '').length >= 4);
    if (ws.length < 2) continue;
    if (ws.filter((w) => /^[A-Z]/.test(w)).length / ws.length > 0.6) {
      out.push(hit('title-case-heading', 'fail', 'Title Case heading', 'sentence case', lineOf(body, m.index), m[1]));
    }
  }
  return out;
}

const VAGUE = /\b(?:experts? (?:argue|say|warn|believe|agree)|observers (?:note|say)|studies (?:show|suggest|find)|research (?:suggests|shows|finds)|many (?:believe|argue|say)|critics (?:say|argue)|analysts (?:say|expect|believe))\b/gi;
// A capitalised word that does not start a sentence: a person, a firm, a body.
const NAME = /(?<![.!?]["”]?\s)(?<!^)\b[A-Z][a-z]{2,}/;
function vagueSources(body) {
  const text = scannableText(body); // keeps "[link text]" as the trace of a link
  const out = [];
  for (const m of text.matchAll(VAGUE)) {
    const before = text.slice(0, m.index).split(/\s+/).slice(-15).join(' ');
    const after = text.slice(m.index + m[0].length).split(/\s+/).slice(0, 16).join(' ');
    if (/\]/.test(before + after) || NAME.test(after.trim()) || NAME.test(before.split(/[.!?]\s/).at(-1) ?? '')) continue;
    out.push(hit('vague-source', 'fail', 'unattributed source', 'name the source or link it', lineOf(text, m.index), m[0]));
  }
  return out;
}

const content = (t) => new Set(words(t).map((w) => w.toLowerCase()).filter((w) => w.length >= 3 && !FUNCTION_WORDS.has(w)));
function moralCloser(md, body) {
  const paras = paragraphs(prose(md));
  const last = paras.at(-1) ?? '';
  const line = body.trimEnd().split('\n').length;
  const out = [];
  if (/^(?:In short|Ultimately|The lesson|The takeaway|In the end|In conclusion)\b/.test(last)) {
    out.push(hit('moral-closer', 'fail', 'moral-of-the-story close', 'end on the last real point', line, last));
  } else {
    const title = content(frontmatterTitle(md));
    const end = content(sentences(last).at(-1) ?? '');
    const shared = [...title].filter((w) => end.has(w)).length;
    if (title.size >= 3 && shared / title.size >= 0.4) {
      out.push(hit('moral-closer', 'fail', 'last sentence restates the title', 'end on the last real point', line, sentences(last).at(-1)));
    }
  }
  return out;
}

const WINDOW = 150, CLUSTER = 3;
function aiVocabCluster(body) {
  const ws = words(prose(body)).map((w) => w.toLowerCase());
  const stemOf = (w) => LISTS.aiVocab.find((s) => w.startsWith(s));
  for (let i = 0; i < ws.length; i++) {
    const found = new Set(ws.slice(i, i + WINDOW).map(stemOf).filter(Boolean));
    if (found.size >= CLUSTER) {
      const first = [...found][0];
      return [hit('ai-vocab-cluster', 'warn', `AI-vocabulary cluster (${[...found].join(', ')})`, 'keep one', lineOf(body, body.toLowerCase().indexOf(first)), [...found].join(' '))];
    }
  }
  return [];
}

export function scanPatterns(md) {
  const body = stripFrontmatter(md);
  const hits = scanClaudish(body, { rules: PATTERN_RULES });
  const copula = hits.filter((h) => h.id === 'copula-avoid');
  if (copula.length >= 2) for (const h of copula) h.severity = 'fail';
  hits.push(...titleCaseHeadings(body), ...vagueSources(body), ...moralCloser(md, body), ...aiVocabCluster(body));
  return hits.sort((a, b) => a.line - b.line);
}
```

- [ ] **Step 4: Run the unit tests**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-patterns.test.mjs`
Expected: PASS, 9 tests. If one fails, fix the regex in `patterns.mjs`, never the test's expectation.

- [ ] **Step 5: Run the corpus guard and narrow rules against the owner's essays**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-corpus.test.mjs`
Expected on first run: it may FAIL and list `slug` and `id line N: match` for each hit.

For each hit, decide by reading the essay line:
- If the match is a different construction from the one the rule targets (e.g. `title-case-heading` on a heading made of proper nouns, `vague-source` on "analysts expect" followed by a named bank two sentences on), narrow the regex or the procedural test in `patterns.mjs` so that line no longer matches, and add a unit test in `style-patterns.test.mjs` with that exact sentence expecting no hit.
- If it is the same construction the owner writes himself (e.g. Title Case headings in his early essays, a closing line echoing the title), change that rule's `severity` to `'warn'` and add a comment above it in the form `// Warn, not fail: the owner's own habit (N essays, e.g. <slug>), measured 19 Oct 2026.`, and update the unit test expectation for that rule from `:fail` to `:warn`.

Re-run until PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/line/style/patterns.mjs scripts/line/test/style-patterns.test.mjs scripts/line/test/style-corpus.test.mjs
git commit -m "Style checks: phrase rules, guarded against the owner's own essays

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Draft-versus-rewrite detection (`compare.mjs`, detection half)

**Files:**
- Create: `scripts/line/style/compare.mjs`
- Test: `scripts/line/test/style-compare.test.mjs`

**Interfaces:**
- Consumes: `tokens` (Task 1); `zipf, ownerUses, lookupPlain, FUNCTION_WORDS, LISTS` (Task 2); `metrics` (Task 3).
- Produces:
  - `SWAP = { common: 4.5, commonDrop: 1.0, rare: 3.0, rareDrop: 0.3 }`
  - `swapRarer(oldWord, newWord) → boolean`
  - `diffHunks(tokensA, tokensB) → { old: token[], new: token[] }[]`
  - `registerHits(draftBody, body) → hit[]`, `hit = { id: 'swap-rarer'|'phrasal-latinate'|'plain-list', old, new, at, end, restore: string|null, hunk?: { at, end }, zipf? }`
  - `variationHits(draftBody, body) → { id: 'variation', new, cluster, at, end }[]`
  - `meaningHits(draftBody, body) → { id: 'meaning', kind: 'number'|'name'|'negation'|'modal'|'link', item, draft, rewrite }[]`
  - `driftHits(draftBody, body, baseline|null) → { id: 'drift', what, draft, rewrite }[]`

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/style-compare.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens } from '../style/text.mjs';
import { swapRarer, diffHunks, registerHits, variationHits, meaningHits, driftHits } from '../style/compare.mjs';

test('swapRarer: a common word swapped for a rare one is caught; a sideways swap is not', () => {
  assert.equal(swapRarer('broke', 'penetrated'), true);
  assert.equal(swapRarer('big', 'large'), false);
});

test('diffHunks isolates the changed words', () => {
  const h = diffHunks(tokens('They broke into the servers.'), tokens('They penetrated the servers.'));
  assert.equal(h.length, 1);
  assert.deepEqual(h[0].old.map((t) => t.w), ['broke', 'into']);
  assert.deepEqual(h[0].new.map((t) => t.w), ['penetrated']);
});

test('phrasal verb turned Latinate is caught with the draft words to restore', () => {
  const hits = registerHits('They broke into the servers.', 'They penetrated the servers.');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'phrasal-latinate');
  assert.equal(hits[0].restore, 'broke into');
});

test('swap-rarer within a hunk; plain-list for a stiff word added elsewhere', () => {
  const hits = registerHits('The plan is simple.', 'The plan is rudimentary.');
  assert.ok(hits.some((h) => h.id === 'swap-rarer' && h.new === 'rudimentary'));
  const p = registerHits('We will start in May and finish in June with the old team.', 'We will commence in May and finish in June with the old team.');
  assert.ok(p.some((h) => h.new === 'commence'));
});

test('an unchanged text has no register hits', () => {
  assert.deepEqual(registerHits('The same text.', 'The same text.'), []);
});

test('variation: a new synonym for the same thing warns', () => {
  const v = variationHits('The company cut costs. The company grew.', 'The company cut costs. The firm grew.');
  assert.equal(v.length, 1);
  assert.equal(v[0].new, 'firm');
});

test('meaning guard: number, negation, modal, name and link changes', () => {
  const kinds = (a, b) => meaningHits(a, b).map((m) => m.kind);
  assert.deepEqual(kinds('Sales rose 4% in May.', 'Sales rose 5% in May.'), ['number', 'number']);
  assert.deepEqual(kinds('It did not work.', 'It worked.'), ['negation']);
  assert.deepEqual(kinds('Rates may fall.', 'Rates will fall.'), ['modal', 'modal']);
  assert.deepEqual(kinds('We asked Nvidia twice.', 'We asked the chipmaker twice.'), ['name']);
  assert.deepEqual(kinds('See [it](https://a.b/1).', 'See [it](https://a.b/2).'), ['link', 'link']);
  assert.deepEqual(kinds('Sales rose 1,000 units.', 'Sales climbed 1000 units.'), []);
});

test('drift: a rewrite that drops contractions and first person is flagged', () => {
  const draft = Array(20).fill("We don't know yet, and I can't say we will. It's early.").join(' ');
  const stiff = Array(20).fill('The organisation does not possess sufficient information regarding eventual implementation outcomes.').join(' ');
  const what = driftHits(draft, stiff, null).map((d) => d.what);
  assert.ok(what.includes('contractions'));
  assert.ok(what.includes('first-person'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-compare.test.mjs`
Expected: FAIL with `Cannot find module '.../style/compare.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// scripts/line/style/compare.mjs
//
// Layer 1 (19 Oct 2026): the draft against its rewrite. On 12 Oct Layer B
// turned "broke into" into "penetrated" and "working around" into
// "circumventing"; every other check passed and the essay read as machine
// prose to a detector. Here each changed hunk is compared word for word, a
// swap to a rarer or more formal word is caught, and (autoFix, below) put
// back where that is safe.
import { tokens, protectedSpans, isProtected } from './text.mjs';
import { zipf, ownerUses, lookupPlain, inflectPlain, matchCase, FUNCTION_WORDS, LISTS } from './lexicon.mjs';
import { metrics } from './stats.mjs';

export const SWAP = { common: 4.5, commonDrop: 1.0, rare: 3.0, rareDrop: 0.3 };
export function swapRarer(oldW, newW) {
  const zo = zipf(oldW), zn = zipf(newW);
  return (zn < SWAP.common && zo - zn >= SWAP.commonDrop) || (zn < SWAP.rare && zo - zn >= SWAP.rareDrop);
}

const MAX_CELLS = 2e7;
export function diffHunks(a, b) {
  const n = a.length, m = b.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) throw new Error(`register diff: texts too long (${n} × ${m} words)`);
  const L = new Uint16Array((n + 1) * (m + 1));
  const at = (i, j) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[at(i, j)] = a[i].lower === b[j].lower ? L[at(i + 1, j + 1)] + 1 : Math.max(L[at(i + 1, j)], L[at(i, j + 1)]);
    }
  }
  const hunks = [];
  let i = 0, j = 0, cur = null;
  while (i < n || j < m) {
    if (i < n && j < m && a[i].lower === b[j].lower) { if (cur) hunks.push(cur); cur = null; i++; j++; continue; }
    cur ??= { old: [], new: [] };
    if (j < m && (i === n || L[at(i, j + 1)] >= L[at(i + 1, j)])) cur.new.push(b[j++]); else cur.old.push(a[i++]);
  }
  if (cur) hunks.push(cur);
  return hunks;
}

const isContent = (t) => !FUNCTION_WORDS.has(t.lower) && /^[a-z]/.test(t.lower);
const PHRASAL_NEW = /(?:ate|ise|ize|ify|ent|vene)(?:s|d|ed|ing)?$/;
const SMALL = 4;

export function registerHits(draftBody, body) {
  const a = tokens(draftBody), b = tokens(body);
  const draftVocab = new Set(a.map((t) => t.lower));
  const hits = [];
  for (const h of diffHunks(a, b)) {
    if (!h.new.length) continue;
    const hunk = { at: h.new[0].at, end: h.new.at(-1).end };
    // A small hunk can be put back word for word; a reworded sentence cannot.
    const restore = h.old.length && h.old.length <= SMALL && h.new.length <= SMALL
      ? draftBody.slice(h.old[0].at, h.old.at(-1).end) : null;
    const oc = h.old.filter(isContent), nc = h.new.filter(isContent);
    const phrasalOld = h.old.length >= 2 && h.old.length <= SMALL && h.old.slice(1).some((t) => LISTS.particles.includes(t.lower));
    if (phrasalOld && nc.length === 1 && h.new.length <= 2
      && (PHRASAL_NEW.test(nc[0].lower) || LISTS.formalVerbs.includes(nc[0].lower) || lookupPlain(nc[0].lower))) {
      hits.push({ id: 'phrasal-latinate', old: draftBody.slice(h.old[0].at, h.old.at(-1).end), new: body.slice(hunk.at, hunk.end), ...hunk, hunk, restore });
      continue;
    }
    for (let k = 0; k < Math.min(oc.length, nc.length); k++) {
      const o = oc[k], t = nc[k];
      if (draftVocab.has(t.lower) || ownerUses(t.lower)) continue;
      if (swapRarer(o.lower, t.lower)) {
        hits.push({ id: 'swap-rarer', old: o.w, new: t.w, at: t.at, end: t.end, hunk, restore, zipf: [zipf(o.lower), zipf(t.lower)] });
      }
    }
  }
  for (const t of b) {
    if (draftVocab.has(t.lower) || hits.some((h) => h.at <= t.at && t.end <= h.end)) continue;
    const p = lookupPlain(t.lower);
    if (p && !draftVocab.has(p.base)) hits.push({ id: 'plain-list', old: null, new: t.w, at: t.at, end: t.end, restore: null });
  }
  return hits.sort((x, y) => x.at - y.at);
}

const memberRe = (w) => new RegExp(`\\b${w.replace(/ /g, '\\s+')}s?\\b`, 'gi');
export function variationHits(draftBody, body) {
  const out = [];
  for (const cluster of LISTS.variation) {
    const inDraft = cluster.filter((w) => memberRe(w).test(draftBody));
    if (!inDraft.length) continue;
    for (const w of cluster.filter((x) => !inDraft.includes(x))) {
      const m = memberRe(w).exec(body);
      if (m) { out.push({ id: 'variation', new: m[0], cluster: inDraft.join('/'), at: m.index, end: m.index + m[0].length }); break; }
    }
  }
  return out;
}

const NUM = /[£$€]?\d[\d,.]*\d?(?:%|bn|tn|m|k)?/g;
const NEG = /\b(?:not|no|never|nobody|nothing|none|neither|nor|cannot)\b|n['’]t\b/gi;
const MODAL = /\b(?:may|might|must|can|could|should|would|will)\b/gi;
const LINK = /\]\(([^)\s]+)/g;
const unlinked = (t) => t.replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, ' ');
const tally = (items) => items.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
function compareTallies(kind, a, b) {
  const out = [];
  for (const item of new Set([...a.keys(), ...b.keys()])) {
    const d = a.get(item) ?? 0, r = b.get(item) ?? 0;
    if (d !== r) out.push({ id: 'meaning', kind, item, draft: d, rewrite: r });
  }
  return out;
}
// A capitalised word whose previous character is a letter, digit, comma or
// semicolon is mid-sentence, so it is a name, not a sentence start.
function namesIn(text) {
  const out = new Set();
  for (const t of tokens(text)) {
    if (!/^[A-Z]/.test(t.w) || FUNCTION_WORDS.has(t.lower)) continue;
    if (/[A-Za-z0-9,;]\s*$/.test(text.slice(Math.max(0, t.at - 3), t.at))) out.add(t.w.replace(/['’]s$/, ''));
  }
  return out;
}
const countName = (text, n) => (text.match(new RegExp(`\\b${n}\\b`, 'g')) ?? []).length;

export function meaningHits(draftBody, body) {
  const a = unlinked(draftBody), b = unlinked(body);
  const nums = (t) => tally((t.match(NUM) ?? []).map((x) => x.replace(/,/g, '').replace(/\.$/, '')));
  const low = (re, t) => tally((t.match(re) ?? []).map((x) => x.toLowerCase().replace(/’/g, "'")));
  const names = [...new Set([...namesIn(a), ...namesIn(b)])];
  // Negators are compared as a total: "nobody" → "no one" keeps the meaning.
  const negA = (a.match(NEG) ?? []).length, negB = (b.match(NEG) ?? []).length;
  return [
    ...compareTallies('number', nums(a), nums(b)),
    ...compareTallies('name', new Map(names.map((n) => [n, countName(a, n)])), new Map(names.map((n) => [n, countName(b, n)]))),
    ...(negA !== negB ? [{ id: 'meaning', kind: 'negation', item: "not/no/never/n't", draft: negA, rewrite: negB }] : []),
    ...compareTallies('modal', low(MODAL, a), low(MODAL, b)),
    ...compareTallies('link', tally([...draftBody.matchAll(LINK)].map((m) => m[1])), tally([...body.matchAll(LINK)].map((m) => m[1]))),
  ];
}

export function driftHits(draftBody, body, baseline) {
  const a = metrics(draftBody), b = metrics(body);
  const out = [];
  const add = (what, d, r) => out.push({ id: 'drift', what, draft: d, rewrite: r });
  if (b.sylPerWord - a.sylPerWord >= 0.05) add('syllables per word', a.sylPerWord, b.sylPerWord);
  if (a.flesch - b.flesch >= 5) add('reading ease', a.flesch, b.flesch);
  if (a.nominal > 0 && b.nominal >= a.nominal * 1.15) add('nominalisations', a.nominal, b.nominal);
  const iqr = baseline?.metrics?.mtld ? baseline.metrics.mtld.p75 - baseline.metrics.mtld.p25 : null;
  if (iqr != null && b.mtld - a.mtld > iqr) add('lexical diversity', a.mtld, b.mtld);
  if (a.contractions > 0 && b.contractions <= a.contractions / 2) add('contractions', a.contractions, b.contractions);
  if (a['first-person'] > 0 && b['first-person'] <= a['first-person'] / 2) add('first-person', a['first-person'], b['first-person']);
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-compare.test.mjs`
Expected: PASS, 8 tests. The negation case `'It did not work.'` vs `'It worked.'` yields exactly one `negation` hit.

- [ ] **Step 5: Commit**

```bash
git add scripts/line/style/compare.mjs scripts/line/test/style-compare.test.mjs
git commit -m "Style checks: draft-versus-rewrite register, variation, meaning and drift

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The auto-fix (`compare.mjs`, `autoFix`)

**Files:**
- Modify: `scripts/line/style/compare.mjs` (append)
- Test: `scripts/line/test/style-autofix.test.mjs`

**Interfaces:**
- Consumes: `registerHits` (Task 5), `protectedSpans, isProtected` (Task 1), `lookupPlain, inflectPlain, matchCase` (Task 2).
- Produces: `autoFix(draftBody, body, hits, { recheck }) → { text, applied: { old, new, rule, at, end }[] }`. `recheck(text) → { meaning: number, patternFails: number }`. Sets `hit.fixed = true` or `hit.unfixed = '<reason>'` on each register hit.

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/style-autofix.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHits, autoFix, meaningHits } from '../style/compare.mjs';

const noRecheck = () => ({ meaning: 0, patternFails: 0 });
const run = (draft, body, recheck = noRecheck) => {
  const hits = registerHits(draft, body);
  return { hits, ...autoFix(draft, body, hits, { recheck }) };
};

test('restores the draft words for a small hunk', () => {
  const r = run('They broke into the servers.', 'They penetrated the servers.');
  assert.equal(r.text, 'They broke into the servers.');
  assert.deepEqual(r.applied.map((a) => [a.old, a.new, a.rule]), [['penetrated', 'broke into', 'phrasal-latinate']]);
  assert.equal(r.hits[0].fixed, true);
});

test('falls back to the plain map, inflected, when the hunk is too big to restore', () => {
  const draft = 'Nobody wants to be shut down by the people who built them in the first place.';
  const body = 'The systems began circumventing every rule that their own builders had written for them.';
  const r = run(draft, body);
  assert.ok(r.text.includes('working around'), r.text);
});

test('keeps the capital at the start of a sentence', () => {
  const draft = 'A long sentence about something else entirely that has nothing in common here.';
  const body = 'Subsequently the firm wrote to every shareholder it had on the register that week.';
  assert.ok(run(draft, body).text.startsWith('Later the firm'));
});

test('never touches quotations, links or code', () => {
  const draft = 'He said "we will start the work in the spring" and left.';
  const body = 'He said "we will commence the work in the spring" and left.';
  const r = run(draft, body);
  assert.ok(r.text.includes('commence'));
  assert.match(r.hits.find((h) => h.new === 'commence').unfixed, /quotation/);
});

test('a fix that would change meaning is reverted and left as a hold', () => {
  const recheck = (t) => ({ meaning: t.includes('broke into') ? 1 : 0, patternFails: 0 });
  const r = run('They broke into the servers.', 'They penetrated the servers.', recheck);
  assert.equal(r.text, 'They penetrated the servers.');
  assert.match(r.hits[0].unfixed, /meaning/);
});

test('the real meaning guard does not object to a restored phrase', () => {
  const draft = 'They broke into 3 servers.';
  const r = run(draft, 'They penetrated 3 servers.', (t) => ({ meaning: meaningHits(draft, t).length, patternFails: 0 }));
  assert.equal(r.text, draft);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-autofix.test.mjs`
Expected: FAIL with `autoFix is not a function` (or no export named `autoFix`).

- [ ] **Step 3: Append the implementation to `compare.mjs`**

```js
const FIXABLE = new Set(['swap-rarer', 'phrasal-latinate', 'plain-list']);
const prevWord = (body, at) => body.slice(0, at).match(/([A-Za-z'’]+)\W*$/)?.[1]?.toLowerCase() ?? null;

// Owner decision, 19 Oct 2026: auto-fix, then report. A stiff word the rewrite
// brought in goes back to the draft's own words where the hunk is small, or to
// the vetted plain word otherwise. Each fix is kept only if the meaning guard
// and the pattern rules are no worse afterwards; anything else is a hold.
export function autoFix(draftBody, body, hits, { recheck }) {
  const spans = protectedSpans(body);
  const edits = new Map();
  for (const h of hits.filter((x) => FIXABLE.has(x.id))) {
    let edit = null;
    if (h.restore != null) {
      const s = h.hunk ?? { at: h.at, end: h.end };
      edit = { at: s.at, end: s.end, text: matchCase(body.slice(s.at, s.end), h.restore) };
    } else {
      const p = lookupPlain(h.new);
      if (p) edit = { at: h.at, end: h.end, text: matchCase(h.new, inflectPlain(p.plain, p.form, prevWord(body, h.at))) };
    }
    if (!edit) { h.unfixed = 'no plain replacement'; continue; }
    if (isProtected(spans, edit.at, edit.end)) { h.unfixed = 'inside a quotation, link or code'; continue; }
    const key = `${edit.at}:${edit.end}`;
    if (!edits.has(key)) edits.set(key, { ...edit, rule: h.id, hits: [] });
    edits.get(key).hits.push(h);
  }
  let text = body;
  let base = recheck(text);
  const applied = [];
  for (const e of [...edits.values()].sort((x, y) => y.at - x.at)) {
    const next = text.slice(0, e.at) + e.text + text.slice(e.end);
    const r = recheck(next);
    if (r.meaning > base.meaning || r.patternFails > base.patternFails) {
      for (const h of e.hits) h.unfixed = 'fix would change meaning or add a pattern';
      continue;
    }
    applied.unshift({ old: text.slice(e.at, e.end), new: e.text, rule: e.rule, at: e.at, end: e.end });
    text = next;
    base = r;
    for (const h of e.hits) h.fixed = true;
  }
  return { text, applied };
}
```

`matchCase` on a restore uses the case of the rewrite's first letter, so a sentence-initial hunk stays capitalised. Edits are applied from the end of the text backwards so earlier offsets stay valid; `applied` is listed in reading order.

- [ ] **Step 4: Run test to verify it passes**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-autofix.test.mjs scripts/line/test/style-compare.test.mjs`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/line/style/compare.mjs scripts/line/test/style-autofix.test.mjs
git commit -m "Style checks: auto-fix stiff swaps back to the draft or the plain word

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `checkStyle`, the calibration CLI and the baseline

**Files:**
- Create: `scripts/line/style/index.mjs`, `scripts/line/style/calibrate.mjs`
- Create (generated): `distribution/line/style-baseline.json`
- Modify: `package.json` (scripts)
- Test: `scripts/line/test/style-index.test.mjs`, `scripts/line/test/style-baseline.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces:
  - `BASELINE` (path), `loadBaseline(file?) → object|null`
  - `checkStyle({ text, draft?, kind?, baseline? }) → StyleResult` where
    `StyleResult = { fixed: string|null, applied, register: { ran, hits, meaning, variation, drift }, patterns, stats, lm: { status }, holds: string[], warns: string[], hold: boolean }`. `text` and `draft` may include frontmatter; `fixed` is `text` with the fixed body (frontmatter kept) or `null` when nothing changed.
  - `renderStyle(r) → { register: string, stats: string, detector: string }`
  - `buildBaseline({ essays?, today? }) → baseline` (exported from `calibrate.mjs`)
  - Baseline shape: `{ date, newestHuman, corpus: { human }, holdAt, looHeldShare, metrics: { [id]: { p5, p25, p50, p75, p95 } }, centroid, lm: { enforce: false } }`

- [ ] **Step 1: Write the failing tests**

```js
// scripts/line/test/style-index.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStyle, renderStyle } from '../style/index.mjs';

const FM = '---\ntitle: "Test"\n---\n';

test('no draft: patterns run, register is skipped, nothing fixed', () => {
  const r = checkStyle({ text: FM + 'Experts argue that it works.\n', baseline: null });
  assert.equal(r.register.ran, false);
  assert.equal(r.fixed, null);
  assert.equal(r.hold, true);
  assert.ok(r.holds.some((h) => h.startsWith('vague-source')));
});

test('with a draft: the stiff swap is fixed and the frontmatter kept', () => {
  const r = checkStyle({ text: FM + 'They penetrated the servers.\n', draft: FM + 'They broke into the servers.\n', baseline: null });
  assert.equal(r.fixed, FM + 'They broke into the servers.\n');
  assert.equal(r.hold, false);
  assert.equal(r.applied.length, 1);
});

test('a meaning change always holds', () => {
  const r = checkStyle({ text: 'Sales rose 5%.', draft: 'Sales rose 4%.', baseline: null });
  assert.equal(r.hold, true);
  assert.ok(r.holds[0].startsWith('meaning'));
});

test('the detector layer reports not run in phase 1, and warns', () => {
  const r = checkStyle({ text: 'Plain text.', baseline: null });
  assert.match(r.lm.status, /not run/);
  assert.ok(r.warns.some((w) => /detector/.test(w)));
});

test('renderStyle gives three sections', () => {
  const s = renderStyle(checkStyle({ text: FM + 'They penetrated the servers.\n', draft: FM + 'They broke into the servers.\n', baseline: null }));
  assert.match(s.register, /penetrated → broke into/);
  assert.match(s.stats, /not calibrated/);
  assert.match(s.detector, /not run/);
});
```

```js
// scripts/line/test/style-baseline.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBaseline } from '../style/index.mjs';
import { humanEssays } from '../style/lexicon.mjs';
import { essayDate } from '../style/text.mjs';
import { metrics, MIN_WORDS, looOuts, chooseHoldAt } from '../style/stats.mjs';

const DAY = 86400000;

test('the baseline exists and is not stale (newest human essay ≤ 60 days after it)', () => {
  const b = loadBaseline();
  assert.ok(b, 'run: npm run style:calibrate -- --write');
  const newest = humanEssays().map((e) => essayDate(e.md)).filter(Boolean).sort().at(-1);
  assert.ok((Date.parse(newest) - Date.parse(b.date)) / DAY <= 60, `baseline ${b.date}, newest essay ${newest}`);
});

// Recomputed here, leave-one-out, from the essays themselves: reading the
// committed numbers back would pass whatever they said.
test('statistics hold at most 5% of the owner\'s own essays, at a hold count that still means something', () => {
  const ms = humanEssays().map((e) => metrics(e.md)).filter((m) => m.words >= MIN_WORDS);
  const outs = looOuts(ms);
  const k = chooseHoldAt(outs);
  assert.ok(outs.filter((o) => o >= k).length / outs.length <= 0.05);
  assert.ok(k <= 6, `hold count ${k}: the statistics barely bite; report to the owner`);
  assert.equal(loadBaseline().holdAt, k, 'baseline out of date: npm run style:calibrate -- --write');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-index.test.mjs scripts/line/test/style-baseline.test.mjs`
Expected: FAIL with `Cannot find module '.../style/index.mjs'`

- [ ] **Step 3: Write `index.mjs`**

```js
// scripts/line/style/index.mjs
//
// The style checks in one call (19 Oct 2026). Layer 1 compares the rewrite
// with its draft and fixes stiff swaps; layer 2a is the phrase rules; layer 2b
// the statistics against the owner's corpus; layer 3, the local detector
// model, arrives in phase 2 and until then reports "not run".
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../env.mjs';
import { renderClaudish } from '../claudish.mjs';
import { stripFrontmatter } from './text.mjs';
import { registerHits, variationHits, meaningHits, driftHits, autoFix } from './compare.mjs';
import { scanPatterns } from './patterns.mjs';
import { metrics, bandCheck } from './stats.mjs';

export const BASELINE = path.join(ROOT, 'distribution', 'line', 'style-baseline.json');
export const loadBaseline = (file = BASELINE) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };

const patternFails = (t) => scanPatterns(t).filter((h) => h.severity === 'fail').length;
const n2 = (x) => Number(x).toFixed(2);

export function checkStyle({ text, draft = null, kind = 'essay', baseline = loadBaseline() }) {
  const body = stripFrontmatter(text);
  const fm = text.slice(0, text.length - body.length);
  const register = { ran: false, hits: [], meaning: [], variation: [], drift: [] };
  let shipped = body, applied = [];
  if (draft != null) {
    const d = stripFrontmatter(draft);
    register.ran = true;
    register.hits = registerHits(d, body);
    ({ text: shipped, applied } = autoFix(d, body, register.hits, { recheck: (t) => ({ meaning: meaningHits(d, t).length, patternFails: patternFails(t) }) }));
    register.meaning = meaningHits(d, shipped);
    register.variation = variationHits(d, shipped);
    register.drift = driftHits(d, shipped, baseline);
  }
  const patterns = scanPatterns(fm + shipped);
  const stats = kind === 'essay' ? bandCheck(metrics(shipped), baseline) : { status: `skipped (${kind})`, out: [], hold: false };
  const lm = { status: 'not run (phase 2)' };
  const holds = [
    ...register.meaning.map((m) => `meaning: ${m.kind} "${m.item}" ${m.draft} in draft, ${m.rewrite} in rewrite`),
    ...register.hits.filter((h) => !h.fixed).map((h) => `${h.id}: "${h.new}" (${h.unfixed ?? 'not fixed'})`),
    ...patterns.filter((h) => h.severity === 'fail').map((h) => `${h.id}: line ${h.line} "${h.match}"`),
    ...(stats.hold ? [`statistics: ${stats.out.length} metrics outside the owner's band (holds at ${baseline.holdAt})`] : []),
  ];
  const warns = [
    ...register.variation.map((v) => `variation: "${v.new}" where the draft says ${v.cluster}`),
    ...register.drift.map((d) => `drift: ${d.what} ${n2(d.draft)} → ${n2(d.rewrite)}`),
    ...patterns.filter((h) => h.severity === 'warn').map((h) => `${h.id}: line ${h.line} "${h.match}"`),
    ...(!stats.hold ? stats.out.map((o) => `statistics: ${o.id} ${n2(o.value)} outside ${n2(o.p5)}–${n2(o.p95)}`) : []),
    ...(stats.status === 'not calibrated' ? ['statistics: no baseline (npm run style:calibrate -- --write)'] : []),
    `detector: ${lm.status}`,
  ];
  return { fixed: shipped === body ? null : fm + shipped, applied, register, patterns, stats, lm, holds, warns, hold: holds.length > 0 };
}

export function renderStyle(r) {
  const reg = r.register;
  const register = !reg.ran ? 'skipped (no draft to compare)' : [
    r.applied.length ? `Fixed ${r.applied.length}:` : 'Nothing to fix.',
    ...r.applied.map((a) => `- ${a.old} → ${a.new} (${a.rule})`),
    ...reg.hits.filter((h) => !h.fixed).map((h) => `- ❌ ${h.id}: "${h.new}"${h.old ? ` (draft: "${h.old}")` : ''} — ${h.unfixed ?? 'not fixed'}`),
    ...reg.meaning.map((m) => `- ❌ meaning: ${m.kind} "${m.item}" ${m.draft} → ${m.rewrite}`),
    ...reg.variation.map((v) => `- ⚠️ variation: "${v.new}" (draft: ${v.cluster})`),
    ...reg.drift.map((d) => `- ⚠️ drift: ${d.what} ${n2(d.draft)} → ${n2(d.rewrite)}`),
  ].join('\n');
  const s = r.stats;
  const stats = [
    renderClaudish(r.patterns).replace('No Claudish constructions found.', 'No pattern hits.'),
    s.status !== 'checked' ? `Statistics: ${s.status}` : `Statistics: ${s.out.length} of 18 outside the owner's band${s.hold ? ' ❌ HOLD' : ''}`,
    ...s.out.map((o) => `- ${o.id}: ${n2(o.value)} (band ${n2(o.p5)}–${n2(o.p95)})`),
  ].join('\n');
  return { register, stats, detector: `Detector: ${r.lm.status}` };
}
```

- [ ] **Step 4: Write `calibrate.mjs`**

```js
#!/usr/bin/env node
// scripts/line/style/calibrate.mjs
//
// Measures the owner's hand-written essays and writes the baseline the style
// statistics are judged against. Re-run when he adds essays (a test fails 60
// days after the newest one). With _sources/ present it also prints, never
// saves, how the line's own drafts and draft/gated pairs score: those texts are
// internal and stay out of the repo.
//   npm run style:calibrate             print only
//   npm run style:calibrate -- --write  write distribution/line/style-baseline.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../env.mjs';
import { humanEssays } from './lexicon.mjs';
import { essayDate } from './text.mjs';
import { metrics, MIN_WORDS, centroidOf, buildBands, looOuts, chooseHoldAt, bandCheck } from './stats.mjs';
import { registerHits, meaningHits, variationHits, driftHits } from './compare.mjs';
import { BASELINE } from './index.mjs';

const STAGING = path.join(ROOT, '_sources', 'staging-articles');

export function buildBaseline({ essays = humanEssays(), today = new Date().toISOString().slice(0, 10) } = {}) {
  const ms = essays.map((e) => metrics(e.md)).filter((m) => m.words >= MIN_WORDS);
  const centroid = centroidOf(ms);
  const outs = looOuts(ms);
  const holdAt = chooseHoldAt(outs);
  return {
    date: today,
    newestHuman: essays.map((e) => essayDate(e.md)).filter(Boolean).sort().at(-1),
    corpus: { human: ms.length },
    holdAt,
    looHeldShare: outs.filter((o) => o >= holdAt).length / outs.length,
    metrics: buildBands(ms, centroid),
    centroid,
    lm: { enforce: false },
  };
}

function internalReport(baseline) {
  if (!fs.existsSync(STAGING)) return ['_sources/ not present: AI-draft and pair numbers skipped.'];
  const L = [];
  const dirs = fs.readdirSync(STAGING).map((d) => path.join(STAGING, d)).filter((d) => fs.existsSync(path.join(d, 'draft.md')));
  let caught = 0;
  for (const d of dirs) {
    const r = bandCheck(metrics(fs.readFileSync(path.join(d, 'draft.md'), 'utf8')), baseline);
    if (r.hold) caught++;
    L.push(`AI draft ${path.basename(d)}: ${r.status}, ${r.out.length} out (${r.out.map((o) => o.id).join(', ')})`);
    const gated = path.join(d, 'gated.md');
    if (fs.existsSync(gated)) {
      const a = fs.readFileSync(path.join(d, 'draft.md'), 'utf8'), b = fs.readFileSync(gated, 'utf8');
      const ids = registerHits(a, b).map((h) => h.id);
      const count = (id) => ids.filter((x) => x === id).length;
      L.push(`  pair: swap-rarer ${count('swap-rarer')}, phrasal ${count('phrasal-latinate')}, plain ${count('plain-list')}, meaning ${meaningHits(a, b).length}, variation ${variationHits(a, b).length}, drift ${driftHits(a, b, baseline).length}`);
    }
  }
  L.push(`AI drafts held by statistics: ${caught} of ${dirs.length}`);
  return L;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const b = buildBaseline();
  console.log(`Human essays measured: ${b.corpus.human}; hold at ${b.holdAt} metrics out; leave-one-out holds ${(b.looHeldShare * 100).toFixed(1)}% of them.`);
  for (const [id, x] of Object.entries(b.metrics)) console.log(`  ${id.padEnd(14)} p5 ${x.p5.toFixed(2).padStart(8)}  p50 ${x.p50.toFixed(2).padStart(8)}  p95 ${x.p95.toFixed(2).padStart(8)}`);
  for (const l of internalReport(b)) console.log(l);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(BASELINE, JSON.stringify(b, null, 2) + '\n');
    console.log(`Wrote ${path.relative(ROOT, BASELINE)}`);
  }
}
```

In `package.json` `"scripts"`, add after `"humanise:posts"`:

```json
    "style:calibrate": "node scripts/line/style/calibrate.mjs"
```

- [ ] **Step 5: Calibrate**

Run: `npm run style:calibrate -- --write`
Expected: "Human essays measured: N" with N between 50 and 59, a hold count of 3–6, a table of 18 metrics, AI-draft lines (on the owner's Mac where `_sources/` exists), and "Wrote distribution/line/style-baseline.json".

Copy the console output into the task report: the owner decides later whether the numbers justify the hold count. If the hold count printed is above 6, stop and report; do not edit thresholds.

- [ ] **Step 6: Run the tests**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-index.test.mjs scripts/line/test/style-baseline.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/line/style/index.mjs scripts/line/style/calibrate.mjs distribution/line/style-baseline.json package.json scripts/line/test/style-index.test.mjs scripts/line/test/style-baseline.test.mjs
git commit -m "Style checks: checkStyle, calibration CLI and the human baseline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Leash regression fixture

**Files:**
- Create: `scripts/line/fixtures/leash-stiff.md`, `scripts/line/fixtures/leash-plain.md`
- Test: `scripts/line/test/style-leash.test.mjs`

**Interfaces:**
- Consumes: `checkStyle` (Task 7).
- Produces: nothing new; locks behaviour on the case that started this.

- [ ] **Step 1: Vendor the two published versions from git history**

Both are public versions of a published essay. The stiff one is the Layer B output that shipped to staging on 12 Oct; the plain one is the hand-fixed version that went live.

```bash
git show 728f082:src/content/insights/the-leash-problem.md > scripts/line/fixtures/leash-stiff.md
git show 3f4710d:src/content/insights/the-leash-problem.md > scripts/line/fixtures/leash-plain.md
grep -c "penetrated\|circumventing" scripts/line/fixtures/leash-stiff.md
```

Expected: the count is 2 or more.

- [ ] **Step 2: Write the test**

```js
// scripts/line/test/style-leash.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkStyle } from '../style/index.mjs';

// 12 Oct 2026: the leash essay passed every gate check and still read as
// machine prose. The 24 swaps the owner's plain-voice pass undid (3f4710d) are
// what layer 1 exists to catch. The plain version stands in for the draft.
const read = (f) => fs.readFileSync(new URL(`../fixtures/${f}`, import.meta.url), 'utf8');
const stiff = read('leash-stiff.md'), plain = read('leash-plain.md');
const SWAPS = new Set(['swap-rarer', 'phrasal-latinate', 'plain-list']);

test('stiff leash against the plain text: the swaps are caught and put back', () => {
  const r = checkStyle({ text: stiff, draft: plain, kind: 'essay' });
  const caught = r.register.hits.filter((h) => SWAPS.has(h.id));
  assert.ok(caught.length >= 5, `only ${caught.length} swaps caught: ${caught.map((h) => h.new).join(', ')}`);
  const out = r.fixed ?? stiff;
  assert.ok(!/\bpenetrated\b/.test(out), 'penetrated survived');
  assert.ok(!/\bcircumventing\b/.test(out), 'circumventing survived');
  assert.ok(r.hold || r.applied.length >= 5);
});

test('the plain leash passes layers 1 and 2', () => {
  const r = checkStyle({ text: plain, draft: plain, kind: 'essay' });
  assert.deepEqual(r.register.hits, []);
  assert.deepEqual(r.register.meaning, []);
  assert.deepEqual(r.patterns.filter((h) => h.severity === 'fail').map((h) => `${h.id}: ${h.match}`), []);
  assert.equal(r.stats.hold, false, JSON.stringify(r.stats.out));
});
```

- [ ] **Step 3: Run it**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/style-leash.test.mjs`
Expected: PASS, 2 tests.

If the first test fails because a named word is allowlisted (`ownerUses` says the owner used "penetrated" or "circumventing" in two essays), or the second fails on a statistics hold, do not change any threshold: report the failing assertion and the numbers to the owner and stop this task.

- [ ] **Step 4: Commit**

```bash
git add scripts/line/fixtures/leash-stiff.md scripts/line/fixtures/leash-plain.md scripts/line/test/style-leash.test.mjs
git commit -m "Style checks: leash regression fixture (stiff 728f082 vs plain 3f4710d)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Gate integration (step 3a, report sections 3a/3e/3f)

**Files:**
- Modify: `scripts/line/gate.mjs`
- Test: `scripts/line/test/gate-style.test.mjs`

**Interfaces:**
- Consumes: `checkStyle`, `renderStyle` (Task 7); `divergence(before, after)` from `scripts/line/layerb.mjs`.
- Produces: `GATE_DEPS.checkStyle`; `checks.style` (a `StyleResult` plus `divergence` when Layer B ran); fail entry `style (N holds)`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/line/test/gate-style.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runGate } from '../gate.mjs';

// Every paid or networked step faked; checkStyle is the real one.
const fakes = {
  serviceUp: () => true,
  layerBEssay: (i, o) => {
    fs.writeFileSync(o, fs.readFileSync(i, 'utf8').replace('broke into', 'penetrated'));
    return { changed: 1, divergence: { rate: 0.2, survived: 1, total: 5 } };
  },
  checkPlagiarism: () => ({ verdict: 'pass', sentences: [], citations: [], cost_usd: 0 }),
  loadNeverList: () => [],
  neverListHits: () => [],
  checkHumaniser: () => ({ flags: [], dropped: 0, words: 10, rate: 0, cost_usd: 0 }),
  inspectFile: () => ({ suspicious: false }),
  cleanFile: () => {},
};

function gate(body, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-style-'));
  const inPath = path.join(dir, 'in.md'), outPath = path.join(dir, 'out.md');
  fs.writeFileSync(inPath, `---\ntitle: "Test"\n---\n\n${body}\n`);
  const r = runGate({ inPath, outPath, deps: { ...fakes, ...extra } });
  return { r, out: fs.readFileSync(outPath, 'utf8') };
}

test('step 3a puts back the stiff word Layer B introduced and the gate passes', () => {
  const { r, out } = gate('They broke into the servers last year.');
  assert.equal(r.verdict, 'pass', r.report);
  assert.ok(out.includes('broke into'));
  assert.ok(!out.includes('penetrated'));
  assert.match(r.report, /## 3a\. Register/);
  assert.match(r.report, /penetrated → broke into/);
  assert.match(r.report, /## 3e\. Style patterns and statistics/);
  assert.match(r.report, /## 3f\. Detector/);
  assert.ok(r.checks.style.divergence, 'divergence recomputed after the fix');
});

test('a style hold fails the gate', () => {
  const { r } = gate('Experts argue that they broke into the servers.');
  assert.equal(r.verdict, 'fail');
  assert.ok(r.report.includes('style ('));
});

test('later steps see the fixed body', () => {
  let seen = '';
  gate('They broke into the servers last year.', { checkHumaniser: (t) => { seen = t; return { flags: [], dropped: 0, words: 10, rate: 0, cost_usd: 0 }; } });
  assert.ok(seen.includes('broke into'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/gate-style.test.mjs`
Expected: FAIL: the report has no `## 3a. Register` and `out.md` still says "penetrated".

- [ ] **Step 3: Modify `gate.mjs`**

Imports: change the Layer B import line and add the style import:

```js
import { layerBEssay, divergence } from './layerb.mjs';
import { checkStyle, renderStyle } from './style/index.mjs';
```

`GATE_DEPS` becomes:

```js
export const GATE_DEPS = { layerBEssay, checkPlagiarism, inspectFile, cleanFile, serviceUp, loadNeverList, neverListHits, scanClaudish, checkHumaniser, checkStyle };
```

In `runGate`, change `const md = joinFrontmatter(meta, fixedBody.text, raw);` to `let md = joinFrontmatter(meta, fixedBody.text, raw);`, and insert directly after the line `checks.bre = { ... };`:

```js
    // 3a. Register (19 Oct 2026): Layer B's rewrite against the draft it was
    // given. Stiff swaps go back to the draft's words or the plain word; the
    // file that ships is rewritten here so every later step sees the fix.
    stage = 'register';
    const draftBody = skipLayerB ? null : splitFrontmatter(fs.readFileSync(inPath, 'utf8')).body;
    checks.style = deps.checkStyle({ text: fixedBody.text, draft: draftBody, kind: 'essay' });
    const shipBody = checks.style.fixed ?? fixedBody.text;
    if (checks.style.fixed) {
      md = joinFrontmatter(meta, shipBody, raw);
      fs.writeFileSync(outPath, md);
    }
    // What ships, not what Layer B produced: putting draft words back raises
    // the 3-gram survival Layer B reported.
    if (checks.layerb && draftBody != null) checks.style.divergence = divergence(draftBody, shipBody);
```

Then in steps 3c and 3d replace `checkableText(meta, fixedBody.text)` with `checkableText(meta, shipBody)` (two places).

In the fails block, after the humaniser line, add:

```js
  if (checks.style?.hold) fails.push(`style (${checks.style.holds.length} holds)`);
```

In `renderReport`, compute the sections once near the top (after `const L = …`):

```js
  const style = checks.style ? renderStyle(checks.style) : null;
```

After the `## 3. British English` block and before `## 3b. Never-list`, add:

```js
  const dv = checks.style?.divergence;
  L.push('## 3a. Register (draft against rewrite)',
    style ? `${style.register}${dv ? `\n3-gram survival after fixes: ${(dv.rate * 100).toFixed(0)}%` : ''}` : 'not reached', '');
```

After the `## 3d. Humaniser read` block and before the Layer A block, add:

```js
  L.push('## 3e. Style patterns and statistics', style ? style.stats : 'not reached', '');
  L.push('## 3f. Detector', style ? style.detector : 'not reached', '');
```

- [ ] **Step 4: Run the new and existing gate tests**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/gate-style.test.mjs scripts/line/test/gate.test.mjs`
Expected: PASS (the paid live fixture stays skipped).

- [ ] **Step 5: Commit**

```bash
git add scripts/line/gate.mjs scripts/line/test/gate-style.test.mjs
git commit -m "Gate: step 3a register auto-fix, style statistics and detector sections

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Humaniser CLI, the reader's rewrites, and the Layer B prompt

**Files:**
- Modify: `scripts/humanise.mjs`, `scripts/line/humaniser.mjs`, `scripts/line/claudish.mjs`
- Test: `scripts/line/test/humanise-style.test.mjs`; extend `scripts/line/test/claudish.test.mjs`

**Interfaces:**
- Consumes: `checkStyle`, `renderStyle` (Task 7); `PATTERN_RULES` (Task 4); `scripts/line/style/data/plain-map.json` (Task 2).
- Produces:
  - `humaniseFile(file, { kind, useModel, apply, check, draft?, style? })` result gains `style: StyleResult`; `hold` includes `style.hold`.
  - `humaniseText(text, { …, style? })` result gains `style`.
  - CLI flag `--draft <file>`.
  - `plainWordBan() → string` and a `['plain-words', …]` entry in `PROMPT_BANS`.

- [ ] **Step 1: Write the failing tests**

```js
// scripts/line/test/humanise-style.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { humaniseFile, humaniseText, renderResult } from '../../humanise.mjs';
import { vetFlags } from '../humaniser.mjs';

const tmp = (name, text) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hum-style-')), name);
  fs.writeFileSync(f, text);
  return f;
};

test('style checks run on every file and can hold it', () => {
  const r = humaniseFile(tmp('a.md', 'Experts argue that it works.\n'), { kind: 'essay', useModel: false });
  assert.equal(r.style.hold, true);
  assert.equal(r.hold, true);
  assert.match(renderResult(r), /### Style checks/);
});

test('--draft: the stiff swap is fixed in the .humanised.md copy, the original untouched', () => {
  const draft = tmp('draft.md', 'They broke into the servers.\n');
  const file = tmp('b.md', 'They penetrated the servers.\n');
  const r = humaniseFile(file, { kind: 'essay', useModel: false, apply: true, draft });
  assert.equal(fs.readFileSync(file, 'utf8'), 'They penetrated the servers.\n');
  assert.equal(fs.readFileSync(r.out.path, 'utf8'), 'They broke into the servers.\n');
});

test('comment replies get the pattern rules', () => {
  assert.equal(humaniseText('Certainly! The utilisation number matters.', { useModel: false }).style.hold, true);
});

test('the reader may not suggest a rewrite that trips a new pattern rule', () => {
  const essay = 'Margins rose by 3% last year.';
  const { flags } = vetFlags([{ sentence: essay, why: 'x', rewrite: 'Margins rose by 3%, highlighting the strength of the model.' }], essay);
  assert.equal(flags[0].rewrite, '');
  assert.match(flags[0].rewriteRejected, /ing-rider/);
});
```

Append to `scripts/line/test/claudish.test.mjs`:

```js
test('every plain-map word is banned in the Layer B prompt', async () => {
  const { promptBanText } = await import('../claudish.mjs');
  const { PLAIN } = await import('../style/lexicon.mjs');
  const text = promptBanText();
  assert.ok(PROMPT_BANS.some(([id]) => id === 'plain-words'));
  for (const [stiff, plain] of Object.entries(PLAIN)) assert.ok(text.includes(`"${plain}" not "${stiff}"`), stiff);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `LINE_NO_FILE_LOG=1 node --test scripts/line/test/humanise-style.test.mjs scripts/line/test/claudish.test.mjs`
Expected: FAIL: `r.style` is undefined; no `plain-words` ban.

- [ ] **Step 3: `claudish.mjs`: the plain-word ban**

At the top of `scripts/line/claudish.mjs`, add `import fs from 'node:fs';`. Directly above `export const PROMPT_BANS = [`, add:

```js
// The plain-word map lives with the style checks; read here as data so this
// module never imports the style code (which imports this one). 19 Oct 2026:
// Layer B's thesaurus swaps were what made the leash essay read as machine prose.
const PLAIN_MAP = JSON.parse(fs.readFileSync(new URL('./style/data/plain-map.json', import.meta.url), 'utf8'));
export const plainWordBan = () =>
  `use the plain word, never the formal one: ${Object.entries(PLAIN_MAP).map(([stiff, plain]) => `"${plain}" not "${stiff}"`).join(', ')}`;
```

and add as the last entry of `PROMPT_BANS`:

```js
  ['plain-words', plainWordBan()],
```

- [ ] **Step 4: `humaniser.mjs`: vet rewrites against the new rules too**

Change the claudish import line to:

```js
import { scannableText, scanClaudish, claudishFails, RULES } from './claudish.mjs';
import { PATTERN_RULES } from './style/patterns.mjs';
```

and in `vetFlags` replace

```js
    const bad = claudishFails(scanClaudish(f.rewrite ?? ''));
```

with

```js
    const bad = claudishFails(scanClaudish(f.rewrite ?? '', { rules: [...RULES, ...PATTERN_RULES] }));
```

- [ ] **Step 5: `humanise.mjs`: style checks, `--draft`, fixes in the copy**

Add the import:

```js
import { checkStyle, renderStyle } from './line/style/index.mjs';
```

Update the header comment's numbered list by adding, after item 2:

```js
//   3. the style checks (19 Oct 2026): phrase rules and corpus statistics on
//      every file; with --draft <file>, the draft-against-rewrite register
//      check, whose stiff-word fixes go into the --apply copy;
```

and renumber the old item 3 to 4. Add `node scripts/humanise.mjs <file> --draft <draft.md> [--apply]` to the Usage lines.

Replace `humaniseBody` and `humaniseFile` with:

```js
function humaniseBody(body, { kind, useModel, check, style = checkStyle, draft = null }) {
  const rules = RULES_FOR[kind] ?? RULES;
  const hits = scanClaudish(body, { rules });
  const claudish = claudishFails(hits);
  const read = useModel ? check(body, { kind }) : null;
  const readHolds = read ? (HOLD_AT[kind] ? read.flags.length >= HOLD_AT[kind] : humaniserFails(read)) : false;
  const st = style({ text: body, draft, kind });
  return { kind, hits, claudishFails: claudish.length, read, style: st, hold: claudish.length > 0 || readHolds || st.hold, out: null };
}

export function humaniseFile(file, { kind = kindFor(file), useModel = true, apply = false, check = checkHumaniser, draft = null, style = checkStyle } = {}) {
  const md = fs.readFileSync(file, 'utf8');
  const { fm, body } = splitFm(md);
  const draftBody = draft ? splitFm(fs.readFileSync(draft, 'utf8')).body : null;
  const r = humaniseBody(body, { kind, useModel, check, style, draft: draftBody });
  if (apply && (r.read?.flags.length || r.style.fixed)) {
    const a = applyRewrites(fm + (r.style.fixed ?? body), r.read?.flags ?? []);
    const out = file.replace(/\.md$/, '') + '.humanised.md';
    fs.writeFileSync(out, a.md);
    r.out = { path: out, applied: a.applied.length + r.style.applied.length, unapplied: a.unapplied.length };
  }
  return { file, ...r };
}
```

In `humaniseText`, change the signature and first line to pass `style` through:

```js
export function humaniseText(text, { kind = 'comment', useModel = true, apply = false, check = checkHumaniser, style = checkStyle } = {}) {
  const r = humaniseBody(text, { kind, useModel, check, style });
```

In `renderResult`, insert before the `if (r.out?.text !== undefined)` line:

```js
  if (r.style) {
    const s = renderStyle(r.style);
    L.push('### Style checks', s.register === 'skipped (no draft to compare)' ? '' : `Register:\n${s.register}`, s.stats, s.detector, '');
  }
```

and in the `### Rewrite` line change `sentences rewritten` to `changes made (sentence rewrites and plain-word fixes)`.

In the CLI block, read the flag and keep its value out of the file list:

```js
  const di = args.indexOf('--draft');
  const draft = di >= 0 ? args[di + 1] : null;
```

Change the file filter to:

```js
  const files = args.filter((a, i) => !a.startsWith('--') && !(ki >= 0 && i === ki + 1) && !(di >= 0 && i === di + 1));
```

and the `humaniseFile` call to add `draft`:

```js
    const r = humaniseFile(f, { ...(kind ? { kind } : {}), useModel: !args.includes('--no-model'), apply: args.includes('--apply'), draft });
```

- [ ] **Step 6: Run the new tests and every existing line test**

Run: `npm run test:line`
Expected: all pass, live tests skipped. If an existing `humanise.test.mjs` case now holds because its sample text trips a new pattern rule, read the hit: if the sample text is not about style (it tests the reader or the post threshold), pass `style: () => ({ hold: false, fixed: null, applied: [], patterns: [], stats: { status: 'skipped', out: [] }, register: { ran: false, hits: [], meaning: [], variation: [], drift: [] }, lm: { status: 'not run' }, holds: [], warns: [] })` in that call. Never weaken a rule to make an old test pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/humanise.mjs scripts/line/humaniser.mjs scripts/line/claudish.mjs scripts/line/test/humanise-style.test.mjs scripts/line/test/claudish.test.mjs scripts/line/test/humanise.test.mjs
git commit -m "Humaniser: style checks on every file, --draft register fixes, plain-word ban for Layer B

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Smoke run, runbook diagram and memory

**Files:**
- Modify: `distribution/line/README.md`
- Modify: memory (`~/.claude/projects/-Users-himanshu-kher-Documents-devProjects-signal2noise/memory/`)

- [ ] **Step 1: Smoke run on real text (no model, no spend)**

```bash
node scripts/humanise.mjs scripts/line/fixtures/leash-stiff.md --draft scripts/line/fixtures/leash-plain.md --no-model --kind essay
node scripts/humanise.mjs src/content/insights/the-verification-premium.md --no-model --kind essay
node scripts/humanise.mjs "src/content/insights/$(ls src/content/insights | grep -v -e the-leash -e verification -e landlord -e budgeting -e buffett-on-moats | head -1)" --no-model --kind essay
```

Expected: the first prints a Register section listing fixes such as `penetrated → broke into`; the third (an owner essay) shows no ❌ in Style checks. Paste all three outputs into the task report.

- [ ] **Step 2: Update the runbook diagram**

In `distribution/line/README.md`, in the mermaid `GATE` subgraph, replace

```
        BRE --> NEV["3b. Never-list"]:::check
```

with

```
        BRE --> REG["3a. Register<br/>draft against rewrite, stiff swaps put back,<br/>meaning guard"]:::check
        REG --> NEV["3b. Never-list"]:::check
```

and replace

```
        HU --> LA["4. Layer A<br/>invisible Unicode, look-alikes, AI frontmatter"]:::check
```

with

```
        HU --> ST["3e. Style patterns and statistics<br/>phrase rules, 18 metrics against the owner's essays"]:::check
        ST --> DET["3f. Detector<br/>local model (phase 2)"]:::check
        DET --> LA["4. Layer A<br/>invisible Unicode, look-alikes, AI frontmatter"]:::check
```

Below the diagram's closing fence, add a paragraph:

```markdown
**Style checks (19 Oct 2026).** `scripts/line/style/` holds the register
check (Layer B's rewrite against its draft; stiff words put back
automatically, meaning changes held), the phrase rules and the statistics.
The statistics are judged against `distribution/line/style-baseline.json`,
built from the owner's hand-written essays by `npm run style:calibrate --
--write`; re-run it when he adds essays (a test fails 60 days after the
newest). `npm run humanise -- <file> --draft <draft.md>` runs the same checks
outside the gate.
```

- [ ] **Step 3: Run the full suite one last time**

Run: `npm run test:line`
Expected: all pass, live tests skipped.

- [ ] **Step 4: Commit**

```bash
git add distribution/line/README.md
git commit -m "Runbook: style checks in the gate diagram

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Memory**

Write `project-humaniser-style-checks.md` in the memory directory:

```markdown
---
name: project-humaniser-style-checks
description: Humaniser style checks phase 1 built 19 Oct 2026 (register auto-fix, phrase rules, stats); phase 2 local detector model still to plan
metadata:
  type: project
---
Phase 1 of the humaniser style checks is in `scripts/line/style/` (spec
docs/superpowers/specs/2026-10-19-humaniser-style-checks-design.md, plan
docs/superpowers/plans/2026-10-19-humaniser-style-checks.md). The gate's step
3a puts Layer B's stiff swaps back; 3e runs the phrase rules and the 18
statistics against `distribution/line/style-baseline.json`.

**Why:** the leash essay (12 Oct) passed every check but read as machine
prose because of Layer B thesaurus swaps.

**How to apply:** re-run `npm run style:calibrate -- --write` when the owner
adds hand-written essays. Phase 2 (Qwen2.5-0.5B base + Instruct via
Transformers.js, onnx-community ids confirmed to exist 19 Oct) needs its own
plan, using this phase's calibration numbers. Related: [[feedback-claudish-test]],
[[project-in-repo-layers]].
```

and add to `MEMORY.md`, after the in-repo layers line:

```
- [Humaniser style checks phase 1 (19 Oct)](project-humaniser-style-checks.md) — register auto-fix + phrase rules + stats in gate 3a/3e; phase 2 detector model still to plan
```

---

## Phase 2 (separate plan)

The local detector model (`lm.mjs`, `npm run style:setup`, Fast-DetectGPT, Binoculars, perplexity) is planned after Task 7's calibration output exists, because its thresholds and the `lm.enforce` decision depend on those numbers. Facts already checked for that plan: `onnx-community/Qwen2.5-0.5B` and `onnx-community/Qwen2.5-0.5B-Instruct` both exist on Hugging Face (19 Oct 2026); the package must be an `optionalDependency` loaded with a dynamic `import()` inside the scorer so `npm run test:line` and every gate run never load onnxruntime; model ids go in `distribution/line/config.json` under `models.style`; the gate is synchronous, so scoring runs in a child process through `runChild` from `scripts/line/proc.mjs`.
