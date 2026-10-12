# In-repo Layer A and Layer B — design

Date: 12 Oct 2026. Status: approved in chat, awaiting spec review.

## Why

Both layers of the essay gate broke on 12 Oct 2026 for reasons outside this
repo:

- **Layer A** calls the `watermarks-remover` Docker service over HTTP. Its
  9 Oct release changed `/inspect`'s `suspicious` field from a boolean to an
  object (`{ verdict, classes }`). `scripts/line/layera.mjs` does
  `Boolean(j.suspicious)`, so every file now reads as suspicious and the gate
  fails every essay (the live test `inspect flags the planted zero-width space
  and clean removes it` fails).
- **Layer B** shells out to the Codex CLI, which takes its model from the
  owner's global `~/.codex/config.toml`. That names `gpt-6-astra`, which a
  ChatGPT-account Codex now rejects, so Layer B errors before rewriting.

Goal: Layer A runs entirely in the repo, and Layer B's model is pinned by the
repo. Neither can be broken by a third-party release or a global config edit.

## Decisions (owner, 12 Oct 2026)

1. Layer B keeps Codex on the ChatGPT account, with the model pinned in repo
   config. No new API key, no new cost.
2. The Docker watermarks service leaves the gate entirely. It stays installed
   for manual use (images, audits) and is no longer a gate dependency.

## Layer A — `scripts/line/layera.mjs` (rewritten)

Pure Node, stdlib only, no network, synchronous.

### Interface

```js
inspectText(text)  → { suspicious: boolean, findings: Finding[] }
cleanText(text)    → { text: string, removed: number, replaced: number, findings: Finding[] }
// Finding = { kind, codepoint, index, line }   kind ∈ see table below

// Kept for the gate and final.mjs; same shapes as today:
inspectFile(path)  → { suspicious, report: { findings }, kind: 'text' }
cleanFile(path)    → { changed, report: { removed, replaced, findings } }   // rewrites the file in place
serviceUp()        → true      // kept so GATE_DEPS and tests need no change; always available now
```

`resolveServiceUrl`, `post` and `plausibleClean` are deleted. `suspicious` is
true when `findings.length > 0`.

### What it does

The frontmatter and the body are both scanned. In the frontmatter, only values
change; keys and YAML structure are preserved.

| Kind | Characters | Action |
|---|---|---|
| `zero-width` | U+200B–U+200F, U+2060–U+2064, U+FEFF (anywhere except offset 0 of the file) | remove |
| `bidi` | U+202A–U+202E, U+2066–U+2069 | remove |
| `soft-hyphen` | U+00AD | remove |
| `tag` | U+E0000–U+E007F | remove |
| `mvs` | U+180E | remove |
| `variation-selector` | U+FE00–U+FE0F, U+E0100–U+E01EF, **unless** directly after an emoji (Extended_Pictographic) or keycap base | remove |
| `odd-space` | U+00A0, U+2000–U+200A, U+202F, U+205F, U+3000 | replace with U+0020 |
| `homoglyph` | Cyrillic or Greek letter that has a Latin look-alike (table of the ~40 common confusables: а е о р с х у і ј ԁ ɡ ο ν ρ τ etc.) inside a word whose other letters are all Latin | replace with the Latin letter |
| `ai-frontmatter` | frontmatter keys matching `/^(generator|generated_by|ai_.*|model|prompt|llm|assistant)$/i` (key name only: values are never inspected, because essays about Anthropic or OpenAI name them in `title`, `excerpt` and `seoDescription`) | remove the key |
| `data-uri` | `data:` URIs in markdown/HTML image or link targets | remove the target, leave the alt text |

**Always preserved:** U+200D (ZWJ) when it sits between two Extended_Pictographic
characters (emoji sequences); emoji such as 👉; £, €, accented Latin, curly
quotes, en dashes, the ellipsis; a BOM at offset 0 (left alone, reported
nowhere). A word written entirely in Cyrillic or Greek is not touched.

`cleanFile` refuses to write a result shorter than 90% of the input, the same
safeguard as today's `plausibleClean`, and throws instead.

### Gate changes

- `gate.mjs`: drop the `serviceUp()` pre-check, its error message and the
  `resolveServiceUrl` import. The Layer A step and the report line keep their
  current shape. The report adds counts, e.g.
  `Before: SUSPICIOUS (3 zero-width) · After: clean`.
- `final.mjs`: no change. It uses `inspectFile`/`cleanFile`, which keep their
  signatures.
- `distribution/line/README.md`: the "Prerequisites" section about the
  watermarks service becomes one paragraph saying Layer A is in-repo. The
  `co.signal-to-noise.watermarks` LaunchAgent is unloaded
  (`launchctl bootout`); its plist and `infra/watermarks-ensure.sh` stay in
  `infra/` for manual use.

## Layer B — `scripts/line/layerb.mjs` (amended)

### Pinned model

- `distribution/line/config.json` gains `models.layerb: "gpt-5.5"`.
- `codexArgs(outFile, model)` becomes
  `['exec', '-m', model, '-c', 'service_tier=default', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '-o', outFile]`.
- `layerBText` reads the model from `loadConfig().models.layerb` and throws a
  clear error if it is missing. No fallback to the global config.

### Divergence check

```js
divergence(before, after) → { survived: number, total: number, rate: number }
```

- Tokenise both texts to lower-case words. Exclude from `before` any 3-gram
  that touches a figure (digits, %, £, $), a capitalised word other than the
  first word of a sentence, text inside quotation marks, or a markdown
  link/URL. Those are meant to survive.
- `rate` = share of the remaining 3-grams of `before` that also appear in
  `after`.
- Threshold: `LAYERB_MAX_SURVIVAL = 0.35`. Above it, `layerBText` retries
  once with the same prompt. If the retry is still above it, the result is
  kept and flagged; the warning appears in the gate report and does not fail
  the gate.
- `layerBEssay` returns `{ changed, divergence }` for the body. The gate
  report's Layer B line becomes, e.g.,
  `1 string rewritten; 3-gram survival 18% (target ≤ 35%)`.

Frontmatter strings are short; divergence is computed for the body only.

## Testing

All under `scripts/line/test/`, run by `npm run test:line`. No network, no
paid model.

- `layera.test.mjs` (rewritten; the live-service test goes):
  - each kind in the table is planted, detected by `inspectText` and removed or
    replaced by `cleanText`, with the correct counts;
  - the 👨‍👩‍👧 ZWJ sequence, 👉, a keycap `1️⃣`, £, café, curly quotes and
    an en dash survive untouched;
  - an all-Cyrillic word survives; `pаyment` (Cyrillic а) becomes `payment`;
  - AI frontmatter keys go, other keys and their order stay;
  - `cleanFile` throws on an implausibly short result.
- **Corpus guard:** for every file in `src/content/insights/*.md`,
  `cleanText(text).text === text`. A false positive on the owner's published
  writing fails this test, not an essay. If the first run finds hits (a
  deliberate non-breaking space, say), each is reviewed with the owner and
  either fixed in the essay or added to an explicit allowlist in the test;
  the rules are not loosened to make it pass.
- `layerb.test.mjs` (extended): `codexArgs` includes `-m <model>`;
  `divergence` on identical text gives a rate of 1, on a full reword
  near 0; figures, names, quotes and links are excluded; a missing
  `models.layerb` throws.
- Existing `gate` tests keep passing with `serviceUp` stubbed or real (it now
  always returns true).

## Out of scope

- Images, PDFs, DOCX: the gate ships markdown only. Covers come from
  `render-cover.mjs`.
- Statistical watermark detection (SynthID, KGW). Detectors need the
  embedder's key; Layer B's divergence check is the evidence that the
  fingerprint changed.
- An API fallback for Layer B. Add it only if Codex on the ChatGPT account
  stops being viable.
- Re-enabling the essay line (paused by the owner on 12 Oct 2026).

## Rollout

1. Implement and test on `main` while the line is paused.
2. Re-gate one published essay end to end as a smoke test (expect PASS, Layer
   A clean, divergence reported).
3. Unload the watermarks LaunchAgent; update the README.
4. Record in memory that the gate no longer needs Docker.
