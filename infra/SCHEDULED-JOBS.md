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
| `metrics` | Mac launchd (`co.signal-to-noise.metrics`) | Mondays, 07:30 | Mondays 07:30 (the plist uses Mac local time), plus a 10:00 daily catch-up | repo variable `HEARTBEAT_METRICS` | 24 h |
| `humaniser-learn` | Mac launchd (`co.signal-to-noise.humaniser-learn`) | Mondays, 07:45 | Mondays 07:45 (Mac local time), plus a 10:00 daily catch-up | repo variable `HEARTBEAT_HUMANISER_LEARN` | 24 h |
| `watchdog` | GitHub Actions (`watchdog.yml`) | daily, 05:00 | 05:00 GMT, 06:00 BST | workflow runs | 48 h |

The Mac jobs also run a catch-up check whenever the Mac wakes from a missed
slot or the agent is loaded (`RunAtLoad`), so a closed lid on Monday morning
does not lose the week.

Not in the registry: the Tuesday essay-audio job
(`infra/co.signal-to-noise.essay-audio.plist`). It is not installed, and
whether to schedule it is an open owner decision.

## Reading the status

Run `node scripts/ops/health-line.mjs` on the Mac (the Monday skill does this).
It prints one line per job, for example:

    ✅ token-prices: last ok 1 Dec 11:02, next due 1 Jan
    ❌ metrics: overdue since Mon 7 Dec 07:30 (issue #61)

then a `launchd:` section saying whether each Mac job's launchd label is
loaded. It is read-only. If `gh` cannot reach GitHub it prints one line saying
so and exits non-zero. The watchdog gets a line too: it never raises an issue
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
   Add `RunAtLoad` and a daily catch-up interval, as in the existing plists.
4. For a variable heartbeat, add the `HEARTBEAT_<NAME>` line to the `env:` block
   of `.github/workflows/watchdog.yml`. The test suite enforces this; without
   it the watchdog cannot see the job.
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

Set `"paused": true` on the job in `ops/jobs.json`. A paused job never alerts,
shows as paused on the health line, and any open issue is left alone. Remove the
flag to resume; the job is then judged from its next due slot.

## Dry runs

Workflow runs whose title contains "(dry run)" do not count as evidence, either
way. Use that tag in the run name of any manual rehearsal.

## Retired: token-prices plist

The old Mac plist for token prices
(`infra/co.signal-to-noise.token-prices.plist`) was retired when the job moved
to GitHub Actions. On 13 Nov 2026 the installed copy was moved to
`~/Library/LaunchAgents/disabled/`. Do not load it again; two copies would race.

## Reloading a Mac job

After changing a plist, copy it to `~/Library/LaunchAgents/` and reload:

    launchctl bootout gui/$(id -u)/co.signal-to-noise.<name>
    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/co.signal-to-noise.<name>.plist

`RunAtLoad` is set, so bootstrapping fires the catch-up check immediately. If
the current period's run is already recorded it does nothing; if it is missing
it runs the job straight away.

## Known limits

- One wrong workflow name in `ops/jobs.json` makes the watchdog fail every day
  until it is fixed (the failed watchdog run is itself the signal).
- Removing a job from `ops/jobs.json` leaves its open issue behind. Close it by
  hand.
- Cancelled and timed-out runs count as no evidence, so the job shows as overdue
  rather than failed.
- The Mac jobs run the code checked out in the main project folder
  (`~/Documents/devProjects/signal2noise`). Keep it on an up-to-date branch, or
  the jobs run stale code.
- The watchdog cannot see a Mac that is switched off for longer than the grace
  period; that shows as overdue, which is correct.
