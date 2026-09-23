# The essay line as it actually runs — audit, 21 September 2026

Written after running the whole loop end to end in one morning and hitting six
defects doing it. This describes the machine as built, not as designed; where
the two differ, that is a finding. The feature design for the Monday shortlist
lives in `2026-09-21-shortlist-design.md`, which this document cross-references.

Scope: `scripts/line/*.mjs` (2,070 lines), `distribution/line/README.md`, and
the two essays briefed on 21 September.

---

## 1. The loop, stage by stage

The runner wakes at 06:30 and hourly from 07:00 to 23:00. Nothing happens
between wakes. One essay advances per wake, but that essay runs as far as it
can — `check-veto`, `draft`, `gate` and `cover` chain within a single wake, and
the chain stops at `send-final`, a gate fail, an error or idle.

| # | Stage | Trigger | What runs | Observed cost | Writes | What checks it |
|---|---|---|---|---|---|---|
| 1 | `scan` | any wake 06:00–12:00 where the board is not today's | `scan` skill, WebSearch, JSON schema, ≤8 items | not recorded per run | `peg-board.json`, `peg-board.md`, appends to `ARTICLE-IDEAS.md` | never-list filter; schema |
| 2 | `brief` | Mon, wake 06:00–12:00, once per ISO week, max 2 attempts | `pickTopic()` then `brief` skill with WebSearch/WebFetch | **$0.53** | `<slug>/brief.md`, state `briefed`, email | never-list on output (and, since today, on owner notes) |
| 3 | `check-veto` | every wake while `briefed` | IMAP poll for the exact word | free | state `approved` / `killed` / `hold` | sender allow-list, auto-reply headers, `In-Reply-To` |
| 4 | `draft` | the wake that sees `go` | `write-essay` skill, WebSearch/WebFetch/Read/Write | **$3.95** | `OUTLINE.md`, `draft.md` | word count 1,100–2,100; **frontmatter `REQUIRED`**; never-list; unexpected-writes |
| 5 | `gate` | after `draft` | Layer B (Codex) → plagiarism → British English → never-list → Layer A | **$0.61–$1.11 per run**, plus an untracked Codex call | `gated.md`, `gate-report.md` | itself — nothing checks its output |
| 6 | `cover` | gate `pass` | `cover` skill, then `render-cover.mjs` | **$4.59** | `src/covers/<slug>.ts`, `cover-alt.txt`, `public/img/<slug>.webp` | `motionPx ≥ 60`; caption regex; unexpected-writes |
| 7 | `send-final` | after `cover` | `buildFinal()` — Layer B + BrE + never-list on the alt, then Layer A on the whole file | untracked Codex call | `final.md`, report §5, email with the webp attached | never-list; Layer A re-inspect |
| 8 | `check-final` | every wake while `final-sent` | IMAP poll | free | `approved`, or `hold`/`killed`, or corrections | as stage 3 |
| 9 | `corrections` | any prose reply to the final | `corrections` skill on `final.md`, then **the full gate again** | Codex + plagiarism | `corrected.md`, re-gated `gated.md` | unexpected-writes; protected-file hashes |
| 10 | `publish` | first wake at or after `publish_not_before` (Wed 08:00) | copy to `src/content/insights/`, `make-og-images`, `npm run build`, git add/commit, `deploy.sh`, live check, git push | — | the site | `npm run build`; `waitLive` on page/cover/og |
| 11 | Substack mirror | separate job, daily 09:15, essay older than 48 h | — | — | — | — |
| 12 | Metrics | separate job, Mon 07:30 | — | — | `distribution/metrics/<date>.json` | — |

**One essay, one morning, real cost:** $0.53 brief + $3.95 draft + $3.75 across
four gate runs + $4.59 cover = **$13.50 recorded**, plus **$5.64 unrecorded**
(D3) = about **$19.14**. The previous essay shipped complete at $8.58.

Three of those four gate runs were manual retries while chasing D4, so that
$3.75 is the line's cost plus the cost of debugging the line. **Every Codex call
is excluded from all of these figures** — `layerBText()` shells out to the
`codex` CLI, which returns no cost, so only `runSkill()` spend is ever counted.
The true total is higher than $19.14 by an unknown amount.

---

## 2. Where the machine diverges from its own runbook

- **The runbook assumes one runner.** It documents wakes, `PAUSE`, `hold` and
  `killed` as the only concurrency controls. There is no lock, and a manual
  `node scripts/line/runner.mjs` will run a full tick alongside a launchd wake.
  That happened today and destroyed work (D3).
- **"Draft, gate, cover and the Final email, all in that one wake (about an
  hour)."** True only when the gate passes first time. A gate fail parks the
  essay and every retry is a fresh manual cycle; today's essay took four.
- **The frontmatter contract is enforced once, at stage 4**, and then three
  later steps rewrite frontmatter with nothing revalidating (D2).
- **Owner notes reach the writer only through the brief.** `runDraft()` passes
  `brief.md` and nothing else, so an instruction added to the brief propagates
  into the outline and the essay with no further gate. On 21 September I put a
  mandatory AI-authorship disclosure into the brief as an owner note; the brief
  absorbed it, `OUTLINE.md` line 9 carries it, the essay printed it, and the
  owner struck it out on sight. Nothing in the machine was wrong — which is the
  point: a bad instruction in the brief is unopposed all the way to the page.
- **Minor doc error:** the mirror section says "The essay goes live at
  Wednesday's 12:00 wake"; `publish_hour_uk` is 8 and the rhythm table says
  08:00. The 48-hour arithmetic still lands on Saturday either way.

---

## 3. Defect register

Two axes, because they matter differently. **Blocks this week** — would have
broken Wednesday's publish on its own. **Has been wrong all along** — silently
true of essays already published, which is the more expensive category.

| | Blocks this week | Has been wrong all along |
|---|---|---|
| **D1** Layer B rewrites every sentence unread | | ● |
| **D2** Layer A deletes frontmatter keys | ● | |
| **D3** Two runners collide, work destroyed | ● | |
| **D4** Plagiarism checker flaps run to run | | ● |
| **D5** Gate-fail email is unactionable | | ● |
| **D6** Failed paid steps record no cost | | ● |

D2 and D3 are today's emergencies and are cheap to fix. **D1 is the one that
answers "it does not seem to be working as I would expect":** the step that
rewrites every sentence in every essay has no check on its output at all.

### D1 — Layer B rewrites every sentence and nothing reads the result · **has been wrong all along**

Layer B exists to break statistical watermarks, and it is thorough: on this
essay it rewrote **seven blocks — effectively the whole body**. The log line
"3 strings changed" counts the body as one string.

| Draft | After Layer B |
|---|---|
| "The headline reads as a vote of confidence, and it may well be one." | "Read as a vote of confidence, the headline may well be justified." |
| "Follow that one hop at a time. Nvidia invests in Anthropic. Anthropic buys Azure capacity from Microsoft." | "Trace each hop. Into Anthropic goes Nvidia's investment. From Microsoft, Anthropic buys Azure capacity." |
| "The supplier tightened its own financing, and its own revenue fell." | "Its own financing became tighter, and the supplier's own revenue dropped." |
| "You take a minority stake… You extend terms… You fund…" | "After taking a minority stake…, you book sales through them. A reseller unable otherwise to carry the stock gets extended terms from you." |

It inverts syntax, and in doing so loses referents ("Its own" now points at
nothing), destroys parallel constructions that were the rhetorical point, and
turns claims into category errors — a headline cannot be "justified"; an
investment can. The hop-by-hop paragraph is the clearest casualty: the draft's
word order mirrored the flow of money and the rewrite scrambles it.

The prompt in `buildPrompt()` is explicit — "its meaning, structure, facts,
figures, quotations, links and citations stay exactly the same", "keep the
author's voice (plain, direct, CFO-to-CFO)". The output above breaks both
instructions, and `checkOutput()` verifies only that the result is not empty,
does not echo the prompt and is no shorter than 60% of the input. Meaning and
voice are asserted, never checked.

The gate checks provenance, spelling, the never-list and invisible Unicode.
**None of those reads the prose.** Layer B's output ships unread, and this is
true of every essay the line has published.

*Fix options, for the owner to choose:* run Layer B only on passages that
actually carry a watermark signal rather than the whole body; or add a coherence
read after it; or accept the rewrite and have the owner read the gated text
rather than the draft. Compounding matters too — `applyCorrections()` re-gates,
so **Layer B rewrites the owner's own corrections** immediately after they are
applied.

### D2 — Layer A deletes frontmatter keys that name an AI vendor · **blocks this week**

`cleanFile()` treats a frontmatter *value* mentioning Anthropic or Claude as
AI-provenance metadata and removes **the whole key**. Probed directly:

| `excerpt` value | Result |
|---|---|
| "Anthropic is listing at $2tn and Nvidia may anchor it." | flagged → key deleted |
| "The supplier is listing at $2tn and the chipmaker may anchor it." | clean |
| "A model made by Claude wrote this." | flagged → key deleted |

`excerpt` is required by `src/content.config.ts`. Layer A runs **last** in the
gate and **again** in `buildFinal()`, after every other check has passed, so the
gate reported PASS on a file that cannot build. `validateFrontmatter()` exists
and is correct — it is simply never called after stage 4.

*Blast radius:* any essay about an AI company, or whose excerpt names one.
*Fix:* call `validateFrontmatter()` after Layer A in both the gate and
`buildFinal()`, and fail loudly. Then fix the service to match on keys
(`generator`, `ai_model`), not prose, and to clean values rather than drop keys.
*Effort:* the guard is a few lines and a test.

### D3 — Two runners run at once; the loser deletes the winner's work · **blocks this week**

No lock. Today, local time:

| Time | Event |
|---|---|
| 10:48 | manual runner starts; gate passes; `makeCover` begins |
| 11:00:05 | launchd wake fires **mid-cover** and starts a second `makeCover` |
| 11:00:47 | first cover succeeds, $4.59, writes `src/covers/<slug>.ts` |
| 11:01 | final email sent; essay reaches `final-sent` |
| 11:12:30 | second cover finishes, $5.64, sees the first run's `.webp` as an unexpected write, and `cleanupCover()` **deletes the good module** |

The `unexpectedWrites` check is correct in single-process operation: `makeCover`
snapshots, runs the skill, checks, and only *then* calls `render-cover.mjs`. The
second runner's `before` snapshot predated the first runner's webp, so it
attributed another process's output to its own skill call.

*Fix:* a pid+timestamp lock file taken at the top of `tick()` and released in a
`finally`; a stale lock (pid gone, or older than the longest `proc.mjs` timeout)
is broken and taken. Separately, `cleanupCover()` should remove only paths that
appeared during its own run rather than deleting by name.

*Side effect worth knowing:* `nextFig()` derives the next figure number by
scanning `src/covers/*.ts`, so deleting a cover silently frees its number.

### D4 — The plagiarism checker is non-deterministic and re-fetches every run · **has been wrong all along**

Its verdict depends on which pages load that minute. Three consecutive runs over
the same file:

| String | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| "The plans remain under negotiation and could change." | ✅ verbatim, Investing.com | ❌ "not found on any page opened" | — |
| "about 15% of free cash flow" | ✅ verbatim, Yahoo Finance | ❌ "no url" | — |
| "anchor investor, locking in shares…" | ✅ The Decoder | ✅ The Decoder | ❌ "no url" |

Run 1 said the source reads "about $9 billion" and to change "roughly"; run 2,
after the change, said the source reads "roughly" and rejected "about".

The mechanism: `extractQuotes()` collects every `"…"` of 12+ characters, and
`verdictFrom()` fails if **any** citation is unverified. So each quotation mark
is a hard gate against a flaky fetch. Four runs cost $3.75, two of which bought
nothing.

*Workaround that converges, proven today:* quote only primary sources. Company
releases and SEC filings loaded in all four runs; news outlets did not. Once
every quotation came from `anthropic.com` or `sec.gov`, the gate passed first
time with zero failures.
*Fix:* cache confirmations keyed on string+URL, and accept any verified wording
rather than demanding the outlet read first.

*Related:* `pickSentences()` samples only the **8 longest sentences** for
originality. The originality check is a spot check, not full coverage.

### D5 — The gate-fail email gives the owner nothing to do · **wastes the owner's time**

Raised by the owner after receiving three. The body is one line of
`gateFailRecovery()` plus the full report: it asks for a hand edit to
`state.json`, does not say which lines failed (two ❌ among a dozen ✅), carries
**no reply word** — the only mail in the line where replying does nothing — and
a gate-held essay **never expires**, because `briefExpired()` fires only on
stage `briefed` and `finalExpired()` only on `final-sent`.

*Fix:* lead with the failing items and what must change; wire prose replies to
`applyCorrections()`, which already exists and already does exactly this for the
final email; add a gate-held expiry mirroring the other two.

### D6 — Cost is not recorded when a paid step fails · **understates every essay**

Two different mechanisms, one effect. In `draft.mjs` the `addCost()` call sits
at line 66, *after* the word-count, frontmatter and never-list throws. For
`cover` the responsibility is the runner's: `runner.mjs` calls `makeCover()` and
then `addCost()`, so a `makeCover()` that throws never returns a cost to record.
Either way, a step that spends money and then fails validation records nothing.
Today's $5.64 duplicate cover is invisible in `cost_usd`.

On top of that, **no Codex spend is tracked at all.** `layerBText()` shells out
to the `codex` CLI through `runChild()`, which returns no cost figure; only
`runSkill()` reports one. Layer B runs on the whole body at every gate and on
the alt at every final build, and none of it appears anywhere.

*Fix:* carry `cost_usd` on the thrown error (or record it inside the caller the
moment `runSkill()` returns, before validating), and find a way to attribute
Codex spend — even a per-call token count would make the ledger honest.

---

## 4. What the cover pipeline actually is

Worth stating once, because the parts are easy to confuse.

- `src/covers/<slug>.ts` exports `still(alt)` — the complete `<svg>` of the
  resting composition, pure string building — and `motion(svg)`, which attaches
  Web Animations API animations client-side.
- `AnimatedCover.astro` inlines `still()` **at build time**, so the essay page
  paints its cover with no JavaScript and no image request. `motion()` runs on
  `astro:page-load` and does nothing under `prefers-reduced-motion`.
- `render-cover.mjs` rasterises `still()` to `public/img/<slug>.webp`
  (2400×1350). The `.webp` is a **derivative**, used by topic-page thumbnails,
  the OG pipeline, the final email attachment, and the `coverImage` fallback
  branch in `PostLayout.astro`. It is a still by design; nothing produces an
  animated raster.
- `cover-alt.txt` is the raw alt; `buildFinal()` gates it and writes the result
  into `final.md`.

Today the module was deleted (D2) while the `.webp` survived — so the
composition exists as a picture and the motion is gone with the code.
`AnimatedCover.astro` throws rather than falling back when the module is
missing, so the page 500s until either the module returns or `coverAnimation`
is removed from the frontmatter.

---

## 5. Open decisions for the owner

1. **`excerpt` on the essay now at `final-sent`.** Re-gate (~$0.61–$1.00,
   compliant, covers the text edits made today) or patch `final.md` by hand
   (free, but that string would not have been through Layer B).
2. **The deleted cover.** `makeCover` again at ~$4.60, producing a *different*
   composition — or rebuild the module by hand from the surviving `.webp` and
   the alt text, then `render-cover.mjs` and diff the new raster against the old
   to prove the still is identical.
3. **Layer B (D1).** The most consequential decision here, because it affects
   every essay already published, not just this one.
4. **`preempt` / `calibration_until`.** Once the owner picks from a ranked
   shortlist each Monday, the automatic preempt path is dead weight. See the
   shortlist design.
