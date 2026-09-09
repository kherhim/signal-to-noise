# Task 16: Runner state machine — report

## What was implemented

- `scripts/line/runner.mjs` — `nextAction(st, now, cfg)`, `advance(slug, now, { dry })`, `tick({ now, dry })`, and a CLI entry (`node scripts/line/runner.mjs [--dry] [--now ISO]`), per the brief, adjusted to the real interfaces on the branch (see Departures below).
- `scripts/line/test/runner.test.mjs` — the brief's 5 tests, verbatim.
- `distribution/line/config.json` — `brief_hour_local` changed 7 → 6, so `tick()` fires the Monday brief at the hour the Task 17 launchd job (06:30) actually wakes it.

## Departures from the brief's code, and why

1. **`check-veto`'s `findReply` call now passes `token: st.brief_token` alongside `messageId: st.brief_message_id`.** The brief's draft called `findReply({ messageId: st.brief_message_id })` only. The real `findReply` in `mail.mjs` throws `'findReply needs token or subjectNeedle'` unless it gets a `token` or `subjectNeedle` — `messageId` alone isn't a search needle, only an optional In-Reply-To filter. Without this fix, every veto check would throw immediately. State already carries `brief_token` (set by `runBrief` via `sendMail`'s returned token), so this was a straightforward wiring fix, not a design change. (`check-final` needed no equivalent fix: it goes through `readFinalReply(slug)`, which already calls `findReply({ messageId: st.final_message_id, token: st.final_token })` internally.)

2. **`send-final` now catches `sendFinal`'s `'final send in progress; not resending'` throw and treats it as idle** (logs and returns `'idle'`) instead of letting it fall into the outer catch, which would record a `last_error`, email an "Essay line failed" notification, and return `error:send-final`. `sendFinal` throws this deliberately when `finalSendAllowed` says the retry window (60 min) hasn't elapsed — `nextAction` already gates `'final-sending'` on `finalSendAllowed`, so this is normally unreachable, but it's a real race (a second `advance()` call between the gate check and the send) and the task's resolutions call it out explicitly. Not a failure worth alerting the owner about.

3. **`tick()`'s Monday-brief branch no longer calls `runBrief({ dry })` when `dry` is true — it skips the call entirely and just logs.** This is the one substantive departure from the brief's literal Step 3 code. Tracing `brief.mjs`: `runBrief`'s own `{ dry }` parameter only skips the final `sendMail` call — the paid `runSkill(...)` brief generation and the `fs.writeFileSync(brief.md)` happen unconditionally *before* that check. So passing `dry` straight through would mean a `--dry` tick that lands on Monday at `brief_hour_local` still spends money and writes a real brief file — directly violating "Dry mode must not call any paid or side-effecting function" / "NOTHING live in this task." The brief's own committed pattern for `scan()` already guards it the same way (`hour === 6 && !dry`, skipping the call outright rather than trusting `scan`'s internal dry handling), so this mirrors that existing convention rather than inventing a new one. I caught this myself, then confirmed it with the advisor before committing — my first pass had left it unguarded, reasoning (incorrectly) that the Step 4 demo's chosen time (07:00, which no longer matches `brief_hour_local: 6`) made it moot. That was the demo not exercising the bug, not the requirement being satisfied.
   - Verified with `--dry --now 2026-09-14T06:00:00` (Monday, brief hour): now logs `DRY: would run the Monday brief` and nothing else paid; `essay dir` state untouched.

No other departures. `publish` is called as `publish(slug)` (no dry) exactly as the brief and resolutions specify — `publish()`'s own resumability (reading `stage` and resuming from `deploying`/`deploy-failed`/`push-failed`) needed no wrapping. `gate`, `cover`, `draft`, `check-final`'s correction-retry path, and the outer try/catch/notify/last_error machinery are unchanged from the brief's Step 3 code.

## TDD evidence

**RED** — `node --test scripts/line/test/runner.test.mjs` before `runner.mjs` existed:
```
✖ scripts/line/test/runner.test.mjs (65.795334ms)
  code: 'ERR_MODULE_NOT_FOUND', url: '.../scripts/line/runner.mjs'
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

**GREEN** — after implementing `runner.mjs`:
```
✔ briefed waits for the veto deadline then checks
✔ approved → draft → gate → cover → send-final in order
✔ final-sent polls for a reply; publishes only when approved and after the slot
✔ a failed deploy or push retries publish on the next wake
✔ hold, killed and published do nothing
ℹ tests 5
ℹ pass 5
ℹ fail 0
```
Re-confirmed green after the departure-3 fix (same 5/5 pass).

## Dry-tick output

Exactly as the brief's Step 4 command:
```
$ node scripts/line/runner.mjs --dry --now 2026-09-14T07:00:00
2026-09-09 17:34:26Z  runner     DRY the-verification-premium: would gate
```
Only one essay directory carries a `state.json` (`the-verification-premium`, stage `drafted`), so `nextAction` returns `'gate'` for it — the log line reflects that correctly. At `07:00` neither the scan branch (`hour === 6`) nor the Monday-brief branch (`hour === cfg.brief_hour_local`, now `6`) fires, so the brief's description ("brief would email") doesn't apply verbatim at this exact timestamp — that's a direct, expected consequence of moving `brief_hour_local` from 7 to 6 as this task requires (to match the Task 17 launchd wake time of 06:30). Confirmed the brief branch does fire correctly, and safely, with `--dry --now 2026-09-14T06:00:00`:
```
2026-09-09 17:34:27Z  runner     DRY: would run the Monday brief
2026-09-09 17:34:27Z  runner     DRY the-verification-premium: would gate
```
`_sources/staging-articles/the-verification-premium/state.json` was byte-identical before and after both dry runs — confirmed by diff.

## Full suite (pristine, one run)

```
$ npm run test:line
ℹ tests 81
ℹ pass 80
ℹ fail 0
ℹ cancelled 0
ℹ skipped 1   # LINE_LIVE=1-gated paid gate fixture, opt-in only
```
No paid calls (the scan test explicitly asserts "no spend"; the runner tests are pure `nextAction` logic with no network/model calls).

## Files changed

- `scripts/line/runner.mjs` (new)
- `scripts/line/test/runner.test.mjs` (new)
- `distribution/line/config.json` (`brief_hour_local`: 7 → 6)

## Self-review

- Checked every function `runner.mjs` imports against its actual export in the real file (`mail.mjs`, `scan.mjs`, `brief.mjs`, `draft.mjs`, `gate.mjs`, `cover.mjs`, `final.mjs`, `publish.mjs`, `state.mjs`, `queue.mjs`, `env.mjs`) — signatures and call sites match.
- `nextAction`'s `cfg` parameter is accepted but unused in the function body; this matches the given test file's call shape exactly (deadlines are pre-resolved into ISO timestamps by `brief.mjs`/`final.mjs` at brief/final time, so `nextAction` doesn't need to re-derive them from hour config) — left as specified, not "fixed."
- A `findReply` result classified `'ok'` (one of `classify`'s recognised keywords) falls through `check-final`'s if/else chain as a no-op, same as no reply — consistent with "only the word `publish` ships" and not something the brief's own code handles either; left as-is, out of scope for this task.
- `git add` for the commit includes `distribution/line/config.json` in addition to the two new files (the brief's own Step 5 `git add` line predates this task's config change and would have missed it).
- No extra features, no unrequested refactors, no changes to any file other than the three listed above.

## Concerns

- None blocking. Worth flagging for the owner: with `brief_hour_local` now 6, `runBrief` (unguarded, live) and `scan` (dry-guarded) both fire in the same `hour === 6` tick on a Monday — by design, since Task 17's job wakes once at 06:30 and both jobs are meant to run then. No code change needed, just noting it since it wasn't obviously spelled out anywhere.
