# Weekly shortlist: the owner picks the topic

Design, 21 September 2026. Supersedes the line's automatic topic choice.

## Problem

`pickTopic()` in `scripts/line/brief.mjs` chooses the week's essay by walking
`queue.md` in order and skipping last week's family. It ignores the peg board
entirely, because `preempt` is `false` until `calibration_until` (7 October).

On Monday 21 September that produced a concrete failure. The board carried a
story scored 90 (Nvidia anchoring Anthropic's IPO with up to $10bn) and a 71
whose essay was already written and waiting for exactly that trigger. The line
briefed an unpegged evergreen that scores 58. The owner saw one topic, take it
or leave it, and had no way to know what had been walked past.

## What the owner decided

Asked directly, on 21 September:

1. **Active choice every week.** The list is a decision, not a digest. The line
   researches nothing expensive until the pick comes back.
2. **The brief keeps its own `go`.** Three decisions a week — pick, approve the
   brief, `publish`. Drafting is the costly step (the verification premium cost
   $8.58 all-in; alignment reached $4.65 before it was stopped), and a brief can
   arrive with something to confess that the owner would want to see first.
3. **One merged list from all three pools** — `queue.md`, the peg board and the
   scanner backlog in `ARTICLE-IDEAS.md` — ranked on one score, each row tagged
   with where it came from.

## Scoring

Reuse the peg board's axes and weights unchanged: corpus fit 0.35, magnitude
0.25, velocity 0.20, number 0.20; score is the weighted average on 0–10,
multiplied by ten.

An unpegged evergreen scores **zero on velocity only**. An earlier draft of this
design zeroed magnitude as well; that was wrong. It caps any evergreen at 55 and
makes a news peg permanently unbeatable, which would hollow out the queue that
is the line's editorial spine. Magnitude belongs to the subject, not to the
news: an evergreen about the CFO mandate can carry real weight and should be
able to win a quiet week.

Worked example — "Alignment is a capital-allocation problem": fit 9, magnitude
5, velocity 0, number 7 → 58. Seventh of seven on 21 September; still seventh
under the old rule, at 45.5, so the ranking held either way.

## The flow

```
Mon 06:00–12:00  scan → peg board                    (unchanged)
                 ↓ only if the board carries today's date
Mon ~07:00       shortlist → email: six ranked candidates
                 ↓ owner replies "3"
                 runBrief(chosen) → deep brief email  (unchanged)
                 ↓ owner replies "go"
                 draft → gate → cover → final email   (unchanged)
                 ↓ owner replies "publish"
Wed 08:00        publish                              (unchanged)
```

The ordering guard is load-bearing. On 21 September the brief ran at 07:06 and
the board was written at 08:01, so the brief read the previous day's board.
Harmless while `preempt` is off; under this design the shortlist would rank
yesterday's news. The shortlist must refuse to run unless `boardDate()` equals
today, and wait for a later wake inside the window.

## The email

Subject `Shortlist: week of <Monday> [S2N <token>]`. A ranked table of six:
rank, score, topic, family, origin (`queue` / `peg` / `idea`), and one line on
why it scored where it did. Pegged rows carry the headline and link beneath the
table. Footer:

> Reply with a number (`1`–`6`) to brief that one. `no` skips the week entirely.
> `hold` parks it. Anything else parks it and asks. Nothing happens on silence.

## Consent

The reply is an exact digit within range, nothing else — the owner's rule of
14 September 2026, that one exact word proceeds and silence never consents,
applies unchanged. Prose parks and asks, as it does on the brief today.

`classify()` in `mail.mjs` is **not** extended to digits. It is shared with the
final email, where a stray number must never mean anything. The shortlist poll
gets its own `classifyPick(text, n)`, reusing `stripSignature()`.

A shortlist awaiting a pick counts as in flight, so no second one is sent. It
expires after three days rather than the brief's six: an unanswered shortlist
should die before the week is out, so the next Monday starts clean. Expiry
parks it and says so once, and the week has no essay.

There is deliberately no timeout that falls back to rank 1. That would be
silence meaning consent.

## Constraint discovered on 21 September

A held essay's directory keeps its slug reserved: `slugTaken()` treats a
held-but-not-killed staging directory as taken, and `pickTopic()` would happily
select the same queue row again and throw `slug already taken`, burning both of
the week's brief attempts. So a topic whose staging directory still exists must
not be selectable. The queue row for a parked essay is marked `held`, not
returned to `queued`.

## Implemented ahead of the spec

The 21 September session needed the pick applied by hand, so part of this design
already exists in `scripts/line/brief.mjs`:

- `resolveTopic(title, { board, queue })` — resolves a named topic across the
  board and the queue, attaching the peg when one exists, and throwing rather
  than falling back to an evergreen when the title matches nothing.
- `runBrief({ topic, ownerNote })` — an owner-supplied topic skips `pickTopic()`
  entirely; `pickTopic()` remains the unattended path.
- The peg line passed to the brief skill now carries the scanner's `note`, its
  source and its date. The note holds what the headline does not — corroborating
  figures, how firm the terms are, and any disclosure the essay owes its reader
  — and it is written nowhere else, so it has to travel with the peg.

Five unit tests cover resolution; the line suite is at 180 passing.

## Still to build

1. `scripts/line/shortlist.mjs` — modelled on `scan.mjs`: a schema-constrained
   model call, deterministic post-filters in code (never-list, published slugs,
   staging directories that exist, triggers not yet reached), a rendered
   `distribution/line/shortlist.md`, and the email.
2. Shortlist state, as a single file beside `.brief-attempts.json` in the
   staging tree: `sending` → `sent` → `picked` / `killed` / `expired`.
3. A `check-pick` action in the runner, inside `POLL_ACTIONS` so a network blip
   never counts as a failure, plus its expiry branch.
4. `tick()` reordering: shortlist after the scan, once per ISO week, with its
   own attempts cap mirroring `MAX_BRIEF_ATTEMPTS`.
5. Tests: scoring and rendering, `classifyPick` across digits, out-of-range
   input, prose and signature-stripped replies, expiry, the board-date guard,
   never-list filtering, and resolution from each of the three pools.

## Open question

`preempt` and `calibration_until` exist to let the line preempt the queue on a
hot peg without asking. Once the owner picks from a ranked list every Monday,
that judgement is theirs and the automatic path is dead weight. Recommend
leaving `preempt: false` permanently and treating the peg branch of
`pickTopic()` as the unattended fallback only — but not removing it until the
shortlist has run for a few weeks.

---

# Gate findings, 21 September 2026

Both essays briefed on 21 September failed the gate, and the second failed it
three times before passing. None of it was a research failure. What follows is
scoped separately from the shortlist and can be built independently.

## 1. `write-essay` puts quotation marks around paraphrase

Nine strings across two essays, every one of them a fact the checker
corroborated, wrapped in quotation marks that no source matched word for word.

- Alignment: `"digital first"` (the Conference Board says "accelerating digital
  transformation including AI"), plus `"the return is unproven"` and `"this is
  not what we agreed we were buying"` — both the essay's own illustrative lines,
  quoted as if borrowed.
- The landlord: `"roughly $9 billion at the end of 2025"`, `"surpassed $65
  billion by the end of July"`, `"The plans remain under negotiation and could
  change."`, `"about 15% of free cash flow"`, `"before the U.S. midterm
  elections in November"`, `"anchor investor, locking in shares before the stock
  hits the open market"`.

**Fix.** One instruction in the skill: quotation marks are for character-exact
strings from a page actually opened in this session. An essay's own illustrative
phrasing takes no quotation marks. A figure or a characterisation drawn from
reporting is unquoted attribution with the link — which the gate does not check
verbatim, and which is the more honest register anyway.

## 2. The plagiarism checker is non-deterministic and re-fetches every run

Its verdict depends on which pages load in that particular minute. Evidence from
three consecutive runs over the same file:

| String | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| "The plans remain under negotiation and could change." | ✅ verbatim, Investing.com | ❌ "not found on any page opened" | — |
| "about 15% of free cash flow" | ✅ verbatim, Yahoo Finance | ❌ "no url" | — |
| "anchor investor, locking in shares…" | ✅ verbatim, The Decoder | ✅ verbatim, The Decoder | ❌ "no url" |

Worse, two runs gave contradictory instructions on the same phrase: run 1 said
the source reads "about $9 billion" and to change "roughly"; run 2, after the
change, said the source reads "roughly" and rejected "about". CNBC and Axios
returned 403 throughout; Investing.com loaded once and not again.

The cost of that is real: four gate runs at $1.11, $1.07, $0.95 and $0.61, two
of which bought nothing. The essay reached $13.50 against $8.58 for the
verification premium.

**Fix, two parts.** Cache confirmations across runs, keyed on the string and the
URL, so a quote verified on Monday is not re-fetched on Monday. And accept *any*
verified wording rather than demanding the outlet the checker happened to read
first — the test that matters is whether the essay has lifted someone's words
without credit, not whether it tracks one secondary outlet's phrasing.

**Workaround until then,** and it converges: quote only primary sources. Company
releases and SEC filings loaded reliably in all four runs; news outlets did not.
Once every quotation in the landlord essay came from `anthropic.com` or
`sec.gov`, the gate passed first time with zero failures.

## 3. The gate-fail email gives the owner nothing to do

Raised by the owner on 21 September, having received three of them. The body is
`gateFailRecovery()` plus the full report:

> Recovery: fix the cause, then clear `hold` and set `stage: "drafted"` in
> `<slug>/state.json` — draft.md is re-gated.

Four problems. It asks for a hand edit to JSON, which cannot be done from the
phone where these are read. "Fix the cause" does not say what the cause was —
the failing lines sit among a dozen passing ones. It carries no reply word,
making it the only mail in the line where replying does nothing. And a
gate-held essay never expires: `briefExpired()` fires only on stage `briefed`
and `finalExpired()` only on `final-sent`, so an essay held at the gate sits
silently for ever while briefs are chased after 6 days and finals after 7.

**Fix.**

1. Lead with the failing items only and what has to change in the text. Put the
   full report below a divider.
2. Give it reply words, reusing machinery that already exists: prose runs
   `applyCorrections(slug, text)` — already built, already used for prose
   replies to the final — then re-gates. `no` kills, `hold` leaves it parked.
   Silence continues to do nothing.
3. Add a gate-held expiry mirroring the other two, so a forgotten essay chases
   the owner rather than going quiet.

## 4. Layer A deletes frontmatter fields that name an AI vendor

Found 21 September while checking the landlord essay before publication.
Reproducible, and it breaks the site build.

The watermarks service treats a frontmatter *value* containing an AI vendor
name as AI-provenance metadata — the thing it exists to strip — and
`cleanFile()` removes the entire key rather than cleaning the value:

| `excerpt` value | Layer A |
|---|---|
| "Anthropic is listing at $2tn and Nvidia may anchor it." | flagged → key deleted |
| "The supplier is listing at $2tn and the chipmaker may anchor it." | clean |
| "A model made by Claude wrote this." | flagged → key deleted |
| "Revenue stops being evidence of demand." | clean |

The service reports `has_ai_metadata: true`, `findings: ["frontmatter value hit
on excerpt"]`.

`excerpt` is required by `src/content.config.ts`. Layer A is the last gate step
and runs after every check has passed, so the gate reports PASS on a file that
cannot build. The landlord essay reached `final-sent` with no `excerpt` and
would have failed the Wednesday build.

Three essays were exposed and only this one hit: the verification premium's
excerpt names no vendor, and this essay's `seoDescription` survived only
because Layer B had already rewritten it into a sentence without one. Any essay
about an AI company, or any essay that carries the vendor disclosure in its
excerpt, hits this.

**Fix, in order of who should own it.**

1. **In this repo, now:** assert after Layer A that every key required by the
   content schema is still present, and fail the gate loudly if one has gone.
   Cheap, testable, and it catches whatever the service does next. A silent
   deletion at the last step, after a PASS, is the real defect.
2. **In the service:** a frontmatter prose value is not provenance metadata.
   Match on keys (`generator`, `ai_model`, and similar), not on prose that
   happens to name a vendor — and when a value genuinely does hit, clean the
   value rather than removing the key.

## 5. Two runners can run at once, and the loser deletes the winner's work

The most serious defect found on 21 September. There is no lock: a manual
`node scripts/line/runner.mjs` and the hourly launchd wake will both run a full
tick, concurrently, on the same essay.

What happened (local BST):

| Time | Event |
|---|---|
| 10:48 | manual runner starts; gate passes; `makeCover` begins |
| 11:00:05 | **launchd wake fires** while the first cover is still running, and starts its own `makeCover` |
| 11:00:47 | first cover succeeds, $4.59 — writes `src/covers/the-landlord-finances-the-tenant.ts` |
| 11:01 | final email sent; essay reaches `final-sent` |
| 11:12:30 | second cover finishes after 745s, $5.64. `unexpectedWrites` flags `public/img/<slug>.webp`, so `cleanupCover()` **deletes the cover module and `cover-alt.txt`** — including the good module the first run wrote |

Net effect: $5.64 spent for nothing, and the essay lost the cover it had
already passed. Because `makeCover` threw, `addCost` never ran, so the wasted
$5.64 is not in `cost_usd` either — the essay reads $13.50 and actually cost
about $19.14.

`cleanupCover()` is right to remove a failed run's output. The defect is that
it cannot tell its own output from another process's, and there is nothing
stopping two processes in the first place.

**Fix.**

1. A lock file in the staging tree, taken at the top of `tick()` and released
   in a `finally`, holding the pid and a timestamp. A second runner finding a
   live lock logs and exits. A stale lock — pid gone, or older than the longest
   timeout in `proc.mjs` — is broken and taken.
2. `cleanupCover()` should remove only paths it observed appear during its own
   run, comparing against its own `before` snapshot rather than deleting by
   name.
3. ~~Worth revisiting why `public/img/<slug>.webp` counts as an unexpected
   write at all.~~ **Answered on re-reading `cover.mjs`: it does not.**
   `makeCover()` snapshots, runs the skill, checks for unexpected writes, and
   only *then* calls `render-cover.mjs` to produce the webp. The check is
   correct in single-process operation. The second runner flagged it only
   because its `before` snapshot predated the *first* runner's webp, so it
   attributed another process's output to its own skill call. The lock in
   point 1 is the whole fix; there is nothing wrong with `allowed`.

---

See also `2026-09-21-essay-line-audit.md` — the loop as it actually runs, with the full defect register.
