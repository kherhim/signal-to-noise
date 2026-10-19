# Humaniser style checks — design

Date: 19 Oct 2026. Status: design approved in chat ("looks right"), awaiting spec review.

## Why

On 12 Oct the leash essay passed every gate check (Claudish clean, humaniser
read 0 flags) and still scored 64% "AI" on TextGuard. The cause was Layer B:
the Codex rewrite swapped plain words for stiff, rarer ones ("broke into" →
"penetrated", "side goals" → "subsidiary objectives", "working around" →
"circumventing"). A hand pass of 24 swaps fixed it. Nothing in the gate looks
for this, and commercial detectors now treat paraphraser register shift as a
positive AI signal (Pangram DAMAGE study, arXiv 2501.03437; Turnitin bypasser
detection, Aug 2025).

Goal: the humaniser catches and, where safe, fixes what a good detector or a
careful reader would flag, using only local code, local data and a small local
model. No new per-essay API cost.

## Owner decisions (12 and 19 Oct 2026)

1. **Auto-fix, then report.** Stiff words the rewrite introduced, with a vetted
   plain replacement, are swapped back automatically and listed. Findings a
   swap cannot fix hold the essay for the owner.
2. **Everything now.** The rules, the statistics and the local detector model
   are all built in this round, in two phases.
3. Standing rule kept: generic "AI words" are the owner's voice
   (`claudish.mjs` header). On their own they never fail; only a dense cluster
   warns.

## Architecture

New folder `scripts/line/style/`, one responsibility per file, all pure
functions except `lm.mjs` and `calibrate.mjs`.

| File | Job |
|---|---|
| `lexicon.mjs` | Loads vendored data: Zipf frequency table, plain-word map, phrase lists, stoplists, domain allowlist. |
| `text.mjs` | Shared tokenising: prose extraction (reuses `scannableText`), sentences, paragraphs, words, syllables. |
| `compare.mjs` | Draft-vs-rewrite checks and the auto-fix (layer 1). |
| `patterns.mjs` | New phrase rules in the `claudish.mjs` rule format (layer 2a). |
| `stats.mjs` | Stylometric statistics and the band test against the baseline (layer 2b). |
| `lm.mjs` | Local detector model: perplexity, Fast-DetectGPT, Binoculars (layer 3). |
| `calibrate.mjs` | CLI that measures the corpora and writes `distribution/line/style-baseline.json`. |
| `index.mjs` | `checkStyle({ text, draft, kind })` → one result object, plus `renderStyle()` for the report. |

Data lives in `scripts/line/style/data/` with `NOTICE.md` (sources, licences,
attribution).

## Layer 1 — draft vs rewrite (`compare.mjs`)

Runs whenever a pre-rewrite text exists: in the gate, the `inPath` body
against Layer B's output body.

Words are aligned with a word-level LCS diff. Within each changed hunk,
content words are paired in order.

| Id | Check | Rule |
|---|---|---|
| `swap-rarer` | Swap made the word rarer | New word Zipf < 4.5 and ≥ 1.0 below the old word, **or** new word Zipf < 3.0 and ≥ 0.3 below. Words used in ≥ 2 published human essays are allowlisted. |
| `phrasal-latinate` | Phrasal verb became one formal verb | Old hunk is verb + particle (up, out, into, round, off, down, over, through, back, on, in, around); new hunk is one word ending -ate/-ise/-ize/-ify/-ent/-vene or on the formal-verb list. |
| `plain-list` | Stiff word added | Token in the rewrite, not in the draft, on the plain-word map (GOV.UK words to avoid, OGL v3, plus our own list written with the Plain English Campaign A–Z as a guide, not copied). |
| `drift` | Register moved | Any of: syllables/word +0.05; Flesch −5; nominalisations/1k +15%; MTLD up more than the corpus IQR; contractions/1k down by half; first-person/1k down by half. |
| `variation` | Elegant variation | A domain synonym cluster (firm/company/business/organisation/enterprise; CFO/finance chief/finance leader/finance director; problem/issue/challenge/difficulty; plan/strategy/approach/initiative) gains a member the draft did not use for the same slot. |
| `meaning` | Meaning guard | Multisets of numbers (incl. %, £, $, bn, tn), capitalised names mid-sentence, negations (not, no, never, nobody, nothing, none, neither, nor, n't) and modals (may, might, must, can, could, should, would, will) are equal. Link targets equal. |

**Auto-fix.** For `swap-rarer`, `phrasal-latinate` and `plain-list` hits, if
the draft's own word or phrase in that hunk is available, restore it; else, if
the plain map has an entry, use it, inflected to match (‑s, ‑ed, ‑ing,
‑ly; irregular forms from a small table). Never inside quotation marks, link
text or targets, code, or frontmatter identifiers. After fixing, `meaning` and
`patterns` run again on the fixed text; a fix that breaks either is reverted
and becomes a hold. Every applied fix is listed `old → new (rule)`.

`meaning` mismatches always hold. Unfixed `swap-rarer`/`phrasal-latinate`/
`plain-list` hits hold. `drift` and `variation` warn.

## Layer 2a — phrase rules (`patterns.mjs`)

Same shape as `claudish.mjs` RULES (`{ id, severity, label, re, fix }`) and
scanned with `scanClaudish(text, { rules })`, so quotation exemptions and
reporting are shared.

| Id | Catches | Severity |
|---|---|---|
| `copula-avoid` | "serves as", "stands as", "functions as", "acts as a", "boasts" | warn at 1, fail at ≥ 2 |
| `inflated` | "testament to", "pivotal/vital/key role", "underscores the importance", "setting the stage", "indelible", "evolving landscape", "in today's fast-paced" | warn (the owner uses "testament" and "pivotal" himself; `claudish.mjs` header, 21 Sep) |
| `ing-rider` | sentence-final ", highlighting/underscoring/ensuring/reflecting/fostering/showcasing/contributing to/emphasising …" | fail |
| `neg-parallel` | "It's not X, it's Y", "no X, no Y, just Z", "less about X than Y" (the owner's "not just X but Y" stays allowed) | fail |
| `moral-closer` | last paragraph opening "In short", "Ultimately", "The lesson", "The takeaway", "In the end", "In conclusion"; last sentence sharing ≥ 40% content words with the title | fail |
| `false-range` | "from X to Y" with non-scalar X and Y (no digits, dates, times) | warn |
| `vague-source` | "experts argue/say", "observers note", "studies show", "research suggests", "many believe", "critics say" without a link or name within 15 words | fail |
| `hedge-stack` | two hedges within 6 tokens ("may potentially", "could arguably") | warn |
| `chatbot` | "I hope this helps", "Certainly!", "let me know", "as of my knowledge", "as an AI", oaicite / contentReference / turn0search / [cite: n] | fail |
| `title-case-heading` | markdown heading with > 60% capitalised words, short words ignored | fail |
| `ai-vocab-cluster` | ≥ 3 distinct words from the Kobak/Liang/Wikipedia excess-vocabulary list within 150 words | warn only |

Any `fail` rule must have zero hits across the human corpus, enforced by a
corpus test as `layera-corpus.test.mjs` does; a rule that hits the owner's
own essays is narrowed, not allowlisted.

## Layer 2b — statistics (`stats.mjs`)

Each metric is computed per text and compared with the human baseline band
(5th–95th percentile). Rates are per 1,000 words.

| Id | Metric |
|---|---|
| `sent-cv` | Coefficient of variation of sentence length (low is machine-like) |
| `sent-short` / `sent-long` | Share of sentences < 8 words / > 30 words |
| `para-cv` | Coefficient of variation of paragraph length |
| `nominal` | Nominalisations (-tion/-sion/-ment/-ness/-ity/-ance/-ence/-ism minus stoplist) |
| `participial` | Comma or sentence-initial -ing/-ed clauses |
| `triads` | "X, Y and Z" lists, weighted up when items are equal length |
| `coord-pairs` | "noun and noun" / "adjective and adjective" pairs |
| `opener-div` | Distinct first words ÷ sentences; connective-opener rate |
| `mtld` | MTLD lexical diversity (out of band in either direction) |
| `flesch` | Flesch Reading Ease |
| `rare` | Content words Zipf < 3.0 not on the allowlist |
| `polysyllable` | Words of ≥ 3 syllables, allowlisted domain terms excluded |
| `repeat-ngrams` | Repeated non-stopword 3- and 4-grams |
| `delta` | Burrows' Delta on ~150 function words against the corpus centroid (voice drift) |
| `contractions` / `first-person` | Contractions; I/we/my/our |

One metric out of band warns. **Three or more out of band holds.** Texts under
300 words skip layer 2b.

## Layer 3 — local detector model (`lm.mjs`)

Transformers.js (`@huggingface/transformers`) on CPU, models cached under
`~/.cache/s2n-style/`, downloaded once by `npm run style:setup`.

- **Perplexity** (base model): mean and spread of per-sentence log-perplexity.
- **Fast-DetectGPT** (Bao et al., ICLR 2024): analytic conditional probability
  curvature, single model, no perturbation.
- **Binoculars** (Hans et al., 2024): log-perplexity under the base model ÷
  cross-perplexity between base and instruct models.

Model pair: Qwen2.5-0.5B (base) and Qwen2.5-0.5B-Instruct, ONNX q8 (~1GB
total, same tokenizer, as Binoculars requires). Text is scored in windows of
≤ 512 tokens and averaged by length.

**Calibration rule.** Scores warn until `calibrate.mjs` shows separation on
the corpora: at the threshold that holds ≤ 5% of human essays
(leave-one-out), ≥ 70% of AI drafts must be caught. When that is met, the
baseline records `lm.enforce: true` and the score holds above the threshold.
If the model or cache is missing, layer 3 reports "not run" and warns; it
never blocks the gate on its own absence. Research caveat recorded: small
models score plain prose as predictable, so perplexity alone never holds.

## Calibration (`calibrate.mjs`)

- **Human corpus:** `src/content/insights/*.md` minus every slug in the line
  ledger (59 essays as of 19 Oct).
- **AI corpus:** the line's `draft.md` files and pre-Layer-B texts in
  `_sources/staging-articles/` (7 drafts), plus generated mirrors if needed.
  Internal only; never published.
- **Draft/rewrite pairs:** `draft.md` vs `gated.md` in the same folders, and
  the leash body at 728f082 (stiff) vs 3f4710d (plain voice), for
  tuning layer 1 thresholds.
- Output: `distribution/line/style-baseline.json` with p5/p50/p95 per metric,
  the LM thresholds, `lm.enforce`, corpus sizes and date. Re-run when the
  corpus grows; a test fails if the baseline is older than the newest human
  essay by more than 60 days.

## Integration

- **Layer B prompt:** the plain-word map's stiff words join `PROMPT_BANS` as
  "use the plain word: X not Y". A test keeps the map and the prompt in step,
  as the Claudish prompt test does.
- **Gate (`gate.mjs`):** new step **3a. Register** right after BrE fixes
  (draft = `inPath` body, rewrite = shipping body) applying the auto-fix to the
  file; **3e. Style statistics** and **3f. Detector** after the humaniser read.
  `GATE_DEPS` gains `checkStyle` so tests inject fakes. With `--skip-layerb`,
  layer 1 compares the input to itself (no-op) and layers 2–3 still run.
- **`scripts/humanise.mjs`:** runs layers 2a, 2b and 3 on every file; layer 1
  when `--draft <file>` is given. `--apply` writes the auto-fixes into the
  `.humanised.md` copy, as today.
- **Report:** each layer gets a section with fixes, holds and warnings,
  metric values against their band, and model scores against threshold.

## Testing (`npm run test:line`, no network, no paid model)

- Unit tests per check with planted cases, including inflection-correct
  auto-fix ("penetrated" → "broke into", "circumventing" → "working around").
- `meaning` catches a changed number, a dropped "not", a swapped modal.
- Auto-fix never touches quotations, links or frontmatter identifiers.
- Corpus guard: every `fail` pattern has zero hits on the human corpus;
  layer 2b holds ≤ 5% of human essays (leave-one-out).
- **Regression fixture:** the leash essay body at 728f082 (stiff) against
  its `draft.md` must produce `swap-rarer` hits and hold or auto-fix; the
  plain-voice body must pass layers 1–2.
- `lm.mjs` unit tests use a fake scorer; one live test runs only when the
  model cache exists (skipped otherwise, like the live gate fixture).
- Prompt-sync test for the new `PROMPT_BANS`.

## Dependencies and data

- npm: `@huggingface/transformers` (Apache-2.0). Syllables, LCS diff, MTLD and
  Delta are written in-repo (small, testable, no new dependency).
- Zipf table: derived from wordfreq English data (CC BY-SA 4.0), trimmed to
  ~60k words as JSON; attribution in `NOTICE.md`.
- GOV.UK words to avoid (OGL v3); Wikipedia "Signs of AI writing" phrase
  lists (CC BY-SA 4.0); Kobak et al. / Liang et al. excess-word lists (facts,
  cited). Plain English Campaign A–Z is copyrighted and is not vendored.

## Out of scope

- Classifier detectors (GPTZero, Originality, Turnitin, Pangram): not
  reproducible locally; the checks above approximate their features.
- Watermark detection (KGW, SynthID): needs the generator's key.
- Any rewrite beyond the vetted plain-word auto-fix: everything else is
  reported for the owner.
- Optimising against a commercial detector score.
- Re-enabling the essay line (paused since 12 Oct).

## Rollout

1. Phase 1: `text`, `lexicon`, `compare`, `patterns`, `stats`, `calibrate`
   (without LM), gate and `humanise.mjs` integration, prompt bans. Calibrate,
   run on the leash fixture and two published essays.
2. Phase 2: `lm.mjs`, `style:setup`, calibration of LM thresholds, decide
   `lm.enforce` from the numbers.
3. Update `distribution/line/README.md` (diagram gains the new steps) and
   memory.
