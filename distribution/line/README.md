# distribution/line/

The weekly essay line: one essay a week on signal-to-noise.co with no human
in the loop except two emails. Full design in
[`../../docs/specs/2026-09-09-weekly-essay-line-design.md`](../../docs/specs/2026-09-09-weekly-essay-line-design.md);
this is the operational reference.

## The weekly rhythm

| When | What | Who |
|---|---|---|
| Daily 06:30 | Scanner refreshes the peg board | automation |
| Mon 07:00 | Brief email: topic, angle, why now, sources, peg score if any | automation |
| Mon until 19:00 | Veto window: reply "no" (kill), "hold" (park), or nothing (go) | owner, optional |
| Mon 19:00 → Tue | Outline, draft, gate (Layer B, plagiarism, BrE, Layer A), cover | automation |
| Tue evening | "Final for approval" email: exact shipping text, cover attached, gate report | automation |
| Tue → Wed 06:00 | Reply "publish", "hold", or corrections. No reply = hold | owner |
| Wed 08:00 UK | Publish if approved. A late "publish" ships the next morning at 08:00 | automation |
| Fri 09:15 | Substack mirror (`co.signal-to-noise.substack-mirror`) | automation |
| Mon 07:30 | Metrics pull (`co.signal-to-noise.metrics`) | automation |
| Mon, attended | Readout, peg board, LinkedIn edition for last Wednesday's essay, native post scheduled 08:00 UK | owner + Claude in Chrome (`essay-line-monday` skill) |

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
node scripts/line/gate.mjs <in.md> <out.md> [--report <path>] [--skip-layerb]   # the four-check gate
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
