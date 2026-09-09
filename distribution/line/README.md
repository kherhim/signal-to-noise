# distribution/line/

The weekly essay line: one essay a week on signal-to-noise.co with no human
in the loop except two emails. Full design in
[`../../docs/specs/2026-09-09-weekly-essay-line-design.md`](../../docs/specs/2026-09-09-weekly-essay-line-design.md);
this is the operational reference.

## Prerequisites

The gate's Layer A step (invisible-Unicode inspect and clean) runs against a
**local watermarks service**, and the gate now refuses to start without it
rather than spending on Layer B and the plagiarism check first:

```bash
cd ~/Documents/devProjects/watermarks-remover && make serve   # serves http://127.0.0.1:8765
```

Override the address with `WATERMARKS_SERVICE_URL` in `.env` if you must; it has
to be a loopback host. When the service is down, `runGate` writes an ERROR gate
report saying so and returns `fail` without calling a paid model.

## The weekly rhythm

The runner wakes at 06:30, 12:00, 19:00 and 22:00 (`infra/co.signal-to-noise.essay-line.plist`).
Nothing happens between wakes, so every row below names the wake that does the work.

| When | What | Who |
|---|---|---|
| Daily 06:30 | Scanner refreshes the peg board | automation |
| Mon, the 06:30 wake | Brief email: topic, angle, why now, sources, peg score if any | automation |
| Mon until 19:00 | Veto window: reply "no" (kill), "hold" (park), or nothing (go) | owner, optional |
| Mon 19:00 → Tue | Outline, draft, gate (Layer B, plagiarism, BrE, never-list, Layer A), cover | automation |
| Tue evening | "Final for approval" email: exact shipping text, cover attached, gate report | automation |
| Tue → Wed 06:00 | Reply "publish", "hold", or corrections. No reply = hold | owner |
| Wed, the 12:00 wake | Publish if approved — the first wake after the 08:00 UK slot. A late "publish" ships at the next wake past 08:00 | automation |
| Daily 09:15, so Sat for a Wed essay | Substack mirror (`co.signal-to-noise.substack-mirror`) | automation |
| Mon 07:30 | Metrics pull (`co.signal-to-noise.metrics`) | automation |
| Mon, attended | Readout, peg board, LinkedIn edition for last Wednesday's essay, native post scheduled 08:00 UK | owner + Claude in Chrome (`.claude/skills/essay-line-monday/`) |

**Why Saturday for the mirror.** The mirror job runs every day at 09:15 and
mirrors anything older than `min_age_hours_substack` (48 h). The essay goes live
at Wednesday's 12:00 wake, so it clears 48 h at Friday 12:00 — after Friday's
09:15 run. The mirror therefore goes out on **Saturday's** 09:15 run, not
Friday's. An essay is only ever mirrored once, so the extra day costs nothing
but the wait.

## The two-email rules

- **Monday brief — silence means go.** A reply of `no` kills the essay; `hold`
  parks it. Any other prose reply is **not** consent: the essay is parked
  with `hold: true`, the text is kept, and the owner is emailed once. Silence
  still means go.
- **Tuesday final — silence means hold.** Only the exact word `publish`
  ships. An `ok` reply does nothing and the owner is told so, once. `hold` or
  `no` parks or kills it. Any other text is taken as corrections, which
  re-enter the gate before a new final is sent.

## Kill switch and per-essay hold/kill

- `distribution/autopilot/PAUSE` (a file, gitignored) halts every job: the
  runner logs `PAUSE present` and does nothing. Remove the file to resume.
- `state.json` `hold: true` parks one essay; `killed: true` stops it for
  good. Both are checked before any other logic in `advance()`.
- Three things set `hold` for you: three failures at the same action, a gate
  that returns `fail` (before or after corrections), and a final left
  unanswered for seven days (`final_expired_at` records that you were told,
  once). Clear `hold` by hand once the cause is fixed — **and for a gate fail,
  also set `stage` back to `drafted`**, because a `gated` essay with
  `gate_verdict: 'fail'` has no next action whatever `hold` says, so clearing
  `hold` alone leaves it sitting there. That is the recovery after a watermarks
  outage too: start the service, set `stage: "drafted"`, clear `hold`.
- `stage: brief-sending` means the send crashed part-way: the owner may or may
  not have the email. The runner deliberately does nothing with it — check the
  inbox, then set the stage to `briefed` (with the message id) or delete the
  directory and let Monday come round again.

## Where state and logs live

- Per-essay state: `_sources/staging-articles/<slug>/state.json` plus
  `brief.md`, `OUTLINE.md`, `draft.md`, `gate-report.md`, `final.md`
  (gitignored, local-only).
- Peg board: `distribution/line/peg-board.json` and `.md`.
- Script log: `~/Library/Logs/signal2noise-essay-line.log`.
- launchd stdout/stderr: `~/Library/Logs/signal2noise-essay-line-launchd.log`.

## Running a stage by hand

```bash
node scripts/line/scan.mjs [--dry]                                    # refresh the peg board
node scripts/line/brief.mjs [--dry]                                   # this week's brief (no slug — it picks the topic)
node scripts/line/draft.mjs <slug>                                    # outline + draft from the brief
node scripts/line/gate.mjs <in.md> <out.md> [--report <path>] [--skip-layerb]   # Layer B, plagiarism, BrE, never-list, Layer A
node scripts/line/publish.mjs <slug> [--dry]                          # commit, build, deploy, verify
node scripts/line/runner.mjs [--dry] [--now <ISO>]                    # one full tick — the launchd entry point
```

`cover.mjs` and `final.mjs` export functions (`makeCover`, `sendFinal`,
`readFinalReply`, `applyCorrections`) called by the runner; they have no
standalone CLI, so exercise them through `runner.mjs` or the test suite.

## Tests

```bash
npm run test:line   # node --test scripts/line/test/*.mjs — no network, no paid model, no spend
```

## Calibration note

The scanner (`scan.mjs`) runs score-only (no preempting the queue) until
`calibration_until` in `distribution/line/config.json` (`2026-10-07`); until
then the peg board is shown on Mondays for calibration but never jumps the
seed queue.

## Two operational caveats

- **The morning window.** The Monday brief and the daily scan both fire only
  in the 06:00–12:00 local window (`tick()`'s own guard, independent of the
  launchd wake times). A Mac first woken after noon on a Monday produces no
  essay that week — there is no evening catch-up.
- **No retry cap inside the window.** The tick-level scan and brief calls
  have no retry cap of their own: if a brief fails after its paid step (the
  brief skill call), a catch-up wake later in the same 06:00–12:00 window
  will try again and may re-spend on the paid step. The per-essay stages
  (draft, gate, cover, publish) are protected by the three-failure cap in
  `runner.mjs`; the tick-level scan/brief calls are not.
