# The weekly essay line — design

**Status:** approved in conversation 9 Sep 2026, awaiting written review.
**Owner:** Himanshu. **Builder:** Claude Code.
**Goal:** publish one essay a week on signal-to-noise.co with no human in the
loop except two emails, while keeping every standing rule (British English,
plagiarism and provenance, Layer A and Layer B, never Axi) enforced by code.

## 1. Decisions taken

| Question | Decision |
|---|---|
| Owner time per essay | Mode C: near zero. Corrections by exception, by email reply. No attended drafting mode. |
| LinkedIn legs | One attended Monday session with Claude in Chrome, about fifteen minutes. No cookie automation. |
| Hard rules for unattended weeks | (A) never name employer, colleagues or clients, past or present; (B) never publish on a company where the owner holds a position or inside knowledge; (D) never cite a source the line could not open and read; (E) every essay is preceded by a one-line brief the owner can veto. |
| Monday brief | Silence means go. |
| Tuesday final | Silence means **hold**. Publishing needs an explicit "publish" reply. |
| News pegs | A news-peggable piece never ships without its peg. It waits in a holding pen with its trigger written down. |
| Scanner latitude | May propose brand-new topics, only as a vetoable brief and only at score 70 or above; every proposal is written to the ideas file. |
| Mechanism | Option 1: a staged local pipeline driven by launchd, headless Claude as the worker for creative stages, plain scripts for mechanical ones. |

## 2. The weekly rhythm

| When | What | Who |
|---|---|---|
| Daily 06:30 | Scanner refreshes the peg board | automation |
| Mon 07:00 | Brief email: topic, angle, why now, sources, peg score if any | automation |
| Mon until 19:00 | Veto window: reply "no" (kill), "hold" (park), or nothing (go) | owner, optional |
| Mon 19:00 → Tue | Outline, draft, gate (Layer B, plagiarism, BrE, Layer A), cover | automation |
| Tue evening | "Final for approval" email: exact shipping text, cover attached, gate report | automation |
| Tue → Wed 06:00 | Reply "publish", "hold", or corrections. No reply = hold | owner |
| Wed 08:00 UK | Publish if approved. A late "publish" ships the next morning at 08:00 | automation |
| Fri 09:15 | Substack mirror (already live, `scripts/substack-mirror.mjs`) | automation |
| Mon 07:30 | Metrics pull (already live, `scripts/metrics-pull.mjs`) | automation |
| Mon, attended | Readout, peg board, LinkedIn edition for last Wednesday's essay, native post scheduled 08:00 UK | owner + Claude in Chrome |

Corrections received after Wed 06:00 roll the essay to the following Wednesday
so a correction is never rushed past the gate.

Reply handling rules (settled during the build, 9 Sep):
- A prose reply to the Monday brief is not consent: the essay is parked with
  `hold: true`, the text is kept, and the owner is emailed once. Silence still
  means go.
- An `ok` reply to the Tuesday final does nothing and the owner is told so;
  only `publish` ships.
- Every acted-on reply is recorded (`*_reply_seen`) so un-parking an essay by
  hand does not re-apply the old reply.
- A stage that fails three times is parked and the owner is emailed on the
  first failure and on parking, never on every wake.
- The runner advances at most one essay per wake, and the Monday brief and
  daily scan fire in a morning window (06:00–12:00) guarded by "already done
  this week/today", so a missed 06:30 wake does not skip the week.

## 3. Topic engine

### 3.1 Sourcing order for Monday's brief

1. **A news peg that fits the corpus** (peg board score ≥ 70 and corpus fit ≥ 8).
2. **The queue** — the ranked list in `distribution/ARTICLE-IDEAS.md`, top item.
3. **Series balance** — no two consecutive weeks from the same family
   (metered cognition, Buffett, CFO mandate, capital allocation, leadership).

### 3.2 The never-list

One owner-maintained file, `_sources/NEVER-LIST.md` (local-only, never
committed, because it names employers and holdings): employers, colleagues,
clients, and companies where the owner holds a position or inside knowledge. Every brief
and every draft is scanned against it. A hit stops the essay and emails the
owner. "Axi" is on it from day one.

### 3.3 Holding pen

News-peggable ideas carry a `trigger:` line. They cannot be briefed until the
scanner records a matching hit. Initial pen:

| Idea | Trigger |
|---|---|
| Two banks, one start line (built, staged) | JPMorgan / Citi Q3 results, mid-October 2026 |
| The depreciation cliff | Hyperscaler earnings, late October 2026 |
| Pricing cyber like a CFO | A large breach headline; else evergreen after week 9 |
| What the 10-K can't see | Any AI-spend disclosure story; else evergreen after week 12 |

### 3.4 Seed queue (twelve weeks)

| Wk | Working title | Family |
|---|---|---|
| 1 | The verification premium | Metered cognition |
| 2 | Alignment is a capital-allocation problem | CFO mandate |
| 3 | The broken rung | Metered cognition |
| 4 | Buffett on moats when cognition is a commodity | Buffett |
| 5 | The invisible balance sheet | Metered cognition |
| 6 | Two banks, one start line | Capital allocation (pen) |
| 7 | The 90-day notice | Metered cognition |
| 8 | The depreciation cliff | News-peg (pen) |
| 9 | Pricing cyber like a CFO | CFO mandate (pen) |
| 10 | The transformation that never finishes | CFO mandate |
| 11 | Budgeting for deflation | Metered cognition |
| 12 | What the 10-K can't see | Capital allocation (pen) |

A pen item jumps the queue the week its trigger fires; the displaced evergreen
slides down one. After 11 November the keynote is harvested into two or three
further essays.

### 3.5 Scanner scoring

Hard filters first: drop any story that names a never-list entry, or whose
only sources cannot be opened and read.

| Dimension | Weight | 0 | 5 | 10 |
|---|---|---|---|---|
| Corpus fit | 35% | Generic finance/AI news | Touches a family, no specific essay | Directly instantiates a named idea or published essay |
| Magnitude | 25% | Trade press only | One major outlet | FT/WSJ front page, or a mega-cap earnings event |
| Velocity | 20% | Slow structural story | About a week of coverage | Breaking, two-to-three-day window |
| Number in it | 20% | Opinion only | A percentage or survey figure | A dollar amount, valuation, ratio, or dated deadline |

| Score | Action |
|---|---|
| < 50 | Logged to the peg board |
| 50–69 | Queues a native LinkedIn post on the matching published essay for Monday |
| 70–84 | Preempts the queue for that week's brief (or next week's if sent) |
| ≥ 85 | Same-morning email proposing an off-cycle fast piece; one-word reply accepts |

Rules: preempting requires corpus fit ≥ 8; a new-topic proposal requires
≥ 70 and is written to the ideas file regardless. **First four weeks: score
only, no preempting**, board shown on Mondays for calibration.

## 4. Stages and the runner

### 4.1 Per-essay folder

`_sources/staging-articles/<slug>/` (gitignored, local-only like today's staging):

```
state.json        stage, timestamps, brief text, veto deadline, corrections, token use
brief.md          what was emailed Monday
OUTLINE.md
draft.md          Claude draft
layerb.md         Codex rewrite = working draft from here on
gate-report.md    the four checks, evidence, verdict
final.md          exact shipping text (post-corrections, post-gate)
```

Published artefacts land where they do today: `src/content/insights/<slug>.md`,
`src/covers/<slug>.ts`, `public/img/<slug>.webp`, OG jpg.

### 4.2 Stages

| Stage | Does | Run by |
|---|---|---|
| scanned | Daily peg board `distribution/peg-board.md` | script + WebSearch in headless Claude |
| briefed | Pick topic (§3.1), never-list check, email brief, record deadline | headless Claude, `brief` skill |
| approved | Read Zoho inbox after 19:00; apply "no"/"hold"/silence | script (mail module) |
| drafted | Outline then draft from the corpus style guide and the brief's sources | headless Claude, `write-essay` skill |
| gated | §5 gate; any fail stops here and emails the owner | scripts + Codex |
| covered | Cover module from the argument; render webp + OG; 700 px motion check | headless Claude, `cover` skill + render scripts |
| final-sent | Tuesday email with `final.md`, cover, gate report | script |
| published | On "publish": commit, build, `deploy.sh`, verify 200s, ledger, LinkedIn registry placeholder | script |

Corrections re-enter at `gated` for the changed strings and re-run the full
gate, then re-send the final email.

### 4.3 Runner

One launchd job, `co.signal-to-noise.essay-line`, fires 06:30, 12:00, 19:00
and 22:00 daily. Each run: read all `state.json`, advance whichever essay is due
for its next stage (deadlines respected), exit. A stage completes and records
itself, or fails and records why; nothing is half-done between wakes. A
sleeping Mac delays, never corrupts. Re-running a passed stage is a no-op.
Publishing checks the live site for the slug before deploying.

### 4.4 Skills

Creative stages call `claude -p` with a skill from `.claude/skills/essay-line/`:
`brief`, `write-essay`, `cover`, `monday`. The voice rules, British English,
never-list check, "no numbers from memory", and the essay format live in these
files so they are versioned and readable.

## 5. The gate

Fixed order; one report; binary verdict.

1. **Layer B first.** Every shipping string (body, excerpt, seoDescription,
   coverImageAlt, caption) through Codex for the statistical rewrite. Output
   becomes the working draft; sentence-level diff kept.
2. **Plagiarism and provenance.** Eight most distinctive original sentences
   searched as exact quoted strings, expecting zero verbatim hits. Every quoted
   source line checked verbatim against the opened source. Borrowed terms
   credited in text. Any hit or unverifiable citation fails.
3. **British English.** The American-form list from the standing rule plus
   house style resolved against the corpus ("learned" not "learnt"). Fixes that
   change more than spelling go back through Layer B.
4. **Layer A last.** Invisible-Unicode scan on the exact files that ship, via
   the local watermarks service on :8765 (never SuperCompress). Strip and
   re-scan. Nothing edits the file after this step.

Any fail: essay stays at `gated`, owner gets a "held at gate" email with the
failing check and evidence. The line never overrides the gate.

**Cover rules:** designed from the finished argument, not the title; the
existing animated-fabric system (`src/covers/_lib.ts`); caption "NOUN,
ADJECTIVE"; next FIG number; alt text goes through the gate; a 700-pixel frame
is rendered and animated elements must move by a visible amount.

## 6. Publishing, mail, Monday, failure, cost

**Publish:** commit essay + cover + images to main with the gate summary in the
message; build; `deploy.sh` (includes Cloudflare purge); verify essay URL, OG
and cover return 200; write the ledger; add a placeholder to
`distribution/metrics/linkedin-posts.json`. The Substack mirror picks the essay
up on its own once live for 48 h.

**Mail module:** sends from himanshu@signal-to-noise.co (Zoho SMTP,
`smtppro.zoho.eu:465`) to the owner's personal Gmail, with
`Reply-To: essay-line@signal-to-noise.co`. **The reply-to must be the alias,
never the mailbox address:** Gmail has the mailbox address configured as a
send-as alias, so a Gmail reply to it never leaves Google (verified 9 Sep,
test 1 vanished; test 2 via the alias arrived in 40 s). Reads the Zoho inbox
over IMAP (`imappro.zoho.eu:993`, IMAP Access enabled 9 Sep) only for messages
whose subject carries the automation's token (`[S2N <token>]`, which Gmail
preserves in a reply); Zoho's IMAP cannot search the `In-Reply-To` header
(verified 9 Sep), so that header is checked only when present. All other mail
is never read or stored. Recognised replies: `no`, `hold`, `publish`; anything
else is correction text, taken from the plain-text part above the quoted
original. Credentials in `.env` (all set 9 Sep): `ZOHO_USER`,
`ZOHO_APP_PASSWORD` (app password "essay-line"), `ZOHO_SMTP_HOST`,
`ZOHO_IMAP_HOST`, `OWNER_EMAIL`, `ESSAY_LINE_REPLY_TO`. Round trip verified.

**Monday session:** say "Monday" in Claude Code → the `monday` skill shows the
health line, the readout, the peg board, then walks the LinkedIn edition and
native post in Chrome with the owner watching and confirming each. Both texts
are drafted and gate-checked the night before; the native post carries a
number in the hook.

**Failure:** every failure emails one line (stage, essay, reason) and leaves
that essay in place; other essays continue. Expired credentials (Substack
cookie, Zoho password) are detected on first use and reported with the re-grab
recipe. **Kill switch:** `distribution/autopilot/PAUSE` halts the whole line;
`state.json` `hold: true` parks one essay. **Health line** at the top of the
Monday readout: last run and last success per job, anything stuck.

**Cost:** per week roughly one drafting session, one cover session, one Codex
pass, a handful of searches. Token use logged per stage in `state.json`.

## 7. Rollout and testing

Build order, each step usable alone before the next:

1. Mail module — send + read-reply. Round trip already verified by hand with curl on 9 Sep; the module wraps that.
2. Scanner + peg board — live from day one in score-only mode.
3. Gate as a standalone command — run on the staged two-banks essay.
4. Cover stage — run on the same essay; compare with its human-made cover.
5. Drafting stage — week-one topic (the verification premium), run by hand,
   read against the last four essays for voice.
6. Runner + launchd — full dry cycle with publish stubbed, then live.

First live cycle supervised by Claude in session (brief, final, publish).
Fixtures: an essay with a planted American spelling, a planted invisible
character and a planted verbatim sentence, which the gate must catch all three
of; a fixture inbox for the mail reader; state files at every stage for the
runner, which must advance exactly one. Every stage script has a dry-run flag.

Estimate: two working sessions for steps 1–5, a third for the runner and the
supervised cycle. First unattended essay two to three weeks out; the scanner
feeds the queue before then.

## 8. Out of scope

LinkedIn cookie automation (ban risk); Substack Notes (UI-only); attended
drafting mode; any change to the essay format or the cover system; bot
management beyond the WAF rule shipped 9 Sep.
