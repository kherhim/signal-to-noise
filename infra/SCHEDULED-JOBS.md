# Scheduled jobs

Every recurring job is registered in `ops/jobs.json`. A daily watchdog
(`.github/workflows/watchdog.yml`) checks each one against its cadence and
raises a GitHub issue when one has not run, or has failed. The Monday session
prints a health line from the same data.

## The jobs

| Job | Runs on | Cadence (UTC) | UK time | Heartbeat | Grace |
| --- | --- | --- | --- | --- | --- |
| `token-prices` | GitHub Actions (`token-prices.yml`) | 1st of each month, 11:00 | 11:00 GMT, 12:00 BST | workflow runs | 48 h |
| `hyperscalers-reminder` | GitHub Actions (`hyperscalers-reminder.yml`) | 1 Feb, May, Aug, Nov, 09:00 | 09:00 GMT, 10:00 BST | workflow runs | 48 h |
| `metrics` | Mac launchd (`co.signal-to-noise.metrics`) | Mondays, 07:30 | GMT: Mondays 07:30. BST: in effect Mondays 10:00 (see below) | repo variable `HEARTBEAT_METRICS` | 24 h |
| `humaniser-learn` | Mac launchd (`co.signal-to-noise.humaniser-learn`) | Mondays, 07:45 | GMT: Mondays 07:45. BST: in effect Mondays 10:00 (see below) | repo variable `HEARTBEAT_HUMANISER_LEARN` | 24 h |
| `watchdog` | GitHub Actions (`watchdog.yml`) | daily, 05:00 | 05:00 GMT, 06:00 BST | workflow runs | 48 h |

The registry slots are UTC, set to the GMT values. The plists fire at Mac
local time: Monday 07:30 or 07:45, plus a daily 10:00 catch-up. In GMT the two
agree. In BST the Monday fire lands at 06:30Z or 06:45Z, an hour before the UTC
slot, so it counts towards the previous week and normally skips; the job then
does this week's run at the 10:00 local catch-up (09:00Z). An ok stamped less
than 6 hours before a slot also counts for that slot, so a catch-up that ran
just before it (after a missed week) is not repeated at the slot.

The Mac jobs also run a catch-up check whenever the Mac wakes from a missed
slot or the agent is loaded (`RunAtLoad`), so a closed lid on Monday morning
does not lose the week.

Not in the registry: the Tuesday essay-audio job
(`infra/co.signal-to-noise.essay-audio.plist`). It is not installed, and
whether to schedule it is an open owner decision.

## Reading the status

Run `node scripts/ops/health-line.mjs` on the Mac (the Monday skill does this).
It prints one line per job, for example:

    ✅ token-prices: last ok 1 Dec 11:02 UTC, next due 1 Jan
    ✅ humaniser-learn: last ok 8 Dec 09:00 UTC (late), next due Mon 14 Dec
    ❌ metrics: overdue since Mon 7 Dec 07:30 UTC (issue #61)

then a `launchd:` section saying whether each Mac job's launchd label is
loaded. All times are UTC. "(late)" means the last run was more than 6 hours
after its slot, for example a catch-up on Tuesday after the Mac was off on
Monday. It is read-only. If `gh` cannot
reach GitHub it prints one line saying so and exits non-zero; if a job's
`heartbeat.workflow` names a workflow GitHub does not have, it says which
instead. The watchdog gets a line too: it never raises an issue
about itself, so this line is how its own outage is seen.

## Adding a job

1. Add an entry to `ops/jobs.json`: `name`, `runs_on` (`actions` or `mac`),
   `since` (first date the job is expected), `cadence`, `grace_hours` and a
   `heartbeat`.
2. For an Actions job, the heartbeat is the workflow file (`"workflow": "x.yml"`);
   its successful and failed runs on `main` are the evidence. Add a `schedule`
   trigger matching the cadence.
3. For a Mac job, write a plist in `infra/` with the label
   `co.signal-to-noise.<name>`, pass `--scheduled` to the script, and have the
   script write its heartbeat to a repo variable (`"variable": "HEARTBEAT_<NAME>"`).
   Add `RunAtLoad` and a daily catch-up interval, and run the command through
   the same `/bin/sh -c` guard as the existing plists (see "The plist guard").
   Add the job to `EXPECTED` in `ops/test/plists.test.mjs`.
4. For a variable heartbeat, add the `HEARTBEAT_<NAME>` line to the `env:` block
   of `.github/workflows/watchdog.yml`. The test suite enforces this; without
   it the watchdog cannot see the job. The tests also check that each
   `heartbeat.workflow` exists and that its `schedule` crons match the cadence.
5. Run `npm run test:ops`, then open a PR.

## How alerts work

- The watchdog runs daily and judges each job against the latest scheduled
  slot whose grace period has expired.
- An unhealthy job (overdue, failed or never run) gets one issue, titled
  "Scheduled job needs attention: <name>". The workflow opens it; the job is
  identified by a hidden marker at the top of the body, so renaming the issue
  title is safe.
- The issue gets a comment only when the status or detail changes, so an
  unchanged outage does not repeat itself daily.
- When the job next succeeds the watchdog comments and closes the issue.
- Alerts are GitHub issues only. Nothing is emailed.
- Only issues and comments authored by `github-actions` are trusted.

## Pausing a job

Set `"paused": true` on the job in `ops/jobs.json`. This only silences alerts:
a paused job never raises an issue, shows as paused on the health line, and any
open issue is left alone. It does not stop the job. A paused Mac job still runs
at every fire (the scripts ignore `paused`) until its plist is unloaded with
`launchctl bootout`; a paused Actions job still runs until its workflow is
disabled.

To resume, remove the flag and set `since` to today's date. Otherwise the job
is judged against the slots it missed while paused and shows as overdue at
once.

## Dry runs

Workflow runs whose title contains "(dry run)" do not count as evidence, either
way. Use that tag in the run name of any manual rehearsal.

## Retired: token-prices plist

The old Mac plist for token prices
(`infra/co.signal-to-noise.token-prices.plist`) was retired when the job moved
to GitHub Actions. On 13 Nov 2026 the installed copy was moved to
`~/Library/LaunchAgents/disabled/`. Do not load it again; two copies would race.

## The plist guard

launchd runs the scripts in the main project folder on whatever branch is
checked out there. On a branch older than the heartbeat work, `--scheduled`
would be ignored and `humaniser-learn` (a paid model run) would run at every
login and every day. So each Mac plist runs its command through `/bin/sh -c`:
if `scripts/ops/heartbeat.mjs` is missing it writes one line to the job's log
(`~/Library/Logs/signal2noise-<name>.log`, "... not run; scripts/ops/heartbeat.mjs
is missing ...") and exits 1; otherwise it `exec`s the original command
unchanged. `ops/test/plists.test.mjs` checks this.

A plist change only takes effect once the installed copy is replaced and
reloaded (next section). The guard was added on 13 Nov 2026, so both Mac plists
must be copied and reloaded once after that change merges.

## Failure reasons

A Mac job that fails writes `failed:<time>:failed; see ~/Library/Logs/signal2noise-<name>.log`
to its heartbeat variable. The watchdog quotes that in a public issue, so the
error itself (which can hold stderr or model output) stays in the local log
only. Read the log on the Mac for the detail.

## Reloading a Mac job

After changing a plist, copy it to `~/Library/LaunchAgents/` and reload:

    launchctl bootout gui/$(id -u)/co.signal-to-noise.<name>
    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/co.signal-to-noise.<name>.plist

`RunAtLoad` is set, so bootstrapping fires the catch-up check immediately. If
the current period's run is already recorded it does nothing; if it is missing
it runs the job straight away.

## Known limits

- One wrong workflow name in `ops/jobs.json` makes the watchdog fail every day
  until it is fixed. The tests now catch a missing workflow file before merge;
  a workflow renamed or deleted on GitHub only would still do it, and the health
  line names the job.
- In a public repository GitHub disables scheduled workflows automatically when
  no repository activity has occurred in 60 days. That would stop every Actions
  job and the watchdog together, so no issue would be raised; only the Monday
  health line would show it (the watchdog's own line goes overdue). Re-enable
  each workflow from the Actions tab or with `gh workflow enable <file>`.
  (GitHub docs, "Disabling and enabling a workflow", checked 13 Nov 2026.)
- Removing a job from `ops/jobs.json` leaves its open issue behind. Close it by
  hand.
- Cancelled and timed-out runs count as no evidence, so the job shows as overdue
  rather than failed.
- The Mac jobs run the code checked out in the main project folder
  (`~/Documents/devProjects/signal2noise`). Keep it on an up-to-date branch, or
  the jobs run stale code. The plist guard stops them outright only on a branch
  that predates the heartbeat code.
- If `humaniser-learn` pushes its branch and then fails to open the PR, a later
  scheduled fire that day sees the branch, records ok and opens no PR. Check
  the log, and open the PR by hand from the pushed branch.
- The watchdog cannot see a Mac that is switched off for longer than the grace
  period; that shows as overdue, which is correct.
