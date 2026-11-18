# Scheduled jobs that run, or say they didn't

Design, 13 November 2026. Owner asked for this after the November token-price snapshot was missed and the earlier essay-line failures.

## Why

The site's scheduled jobs run on the owner's laptop under launchd and fail silently. Nobody is told when a job doesn't run, so a stale tracker is found by accident, days or weeks later.

What has gone wrong so far:

- **Token price snapshot, 1 Nov 2026.** The Mac was shut down from Fri 30 Oct 22:25 to Sat 7 Nov 10:08. launchd does not run a calendar job that fell due while the machine was off, so the job never ran (`runs = 0`, no log file). A manual run of the wrapper on 13 Nov then failed at `git add` because the snapshot file was not written inside its temporary worktree. The same script works when run directly (PR #55 was made that way). The job would probably have failed even with the Mac on.
- **Essay line, Sep–Oct 2026.** SMTP timeouts, a broken Codex model setting and process timeouts. Each failure was found by the owner, not reported by the system. The line is paused (owner decision, 12 Oct).
- **Hyperscaler tracker.** It has no job at all. Q3 results from Alphabet, Microsoft and Amazon sat unrecorded for two weeks.

## Goals

1. A job that can run without the Mac runs without the Mac.
2. A job that must run on the Mac catches up at the next wake or login after a missed slot.
3. Every job reports success. A missing or failed run raises an alert within a day of the due time (plus a grace period), through a channel that does not depend on the Mac or on email.
4. The owner sees all job health in one place: a GitHub issue while something is wrong, and one line at the top of the Monday session.
5. £0 a month in new running costs.

## Non-goals

- Re-enabling the essay line. It stays paused until the owner says otherwise. When it comes back it joins this system (heartbeat plus catch-up) with no special treatment.
- Automating the hyperscaler figures. The quarterly job opens a reminder; a person (or a Claude session) still pulls and checks the numbers.
- Moving the site's hosting. Unrelated, and parked separately.
- Merging anything automatically. Every job still proposes through a PR, and merging stays the approval.

## Anti-goals (failure even if it technically works)

- Alerts by email. Email delivery is what failed last time.
- Noise: an alert that fires every day for a known, accepted gap, or one issue per run. One open issue per problem, updated in place, closed when the job recovers.
- Secrets in public logs. The repo is public, so its Actions logs are public too.
- Silent self-healing that hides a broken job. A catch-up run still records that the slot was missed.

## Constraints

- The repo `kherhim/signal-to-noise` is public, so GitHub Actions minutes on standard runners are free.
- The repo has no `.github/workflows` today; this adds the first ones.
- Owner rules: work goes through small PRs against `main`, merged with a merge commit, with a deploy after each merge that touches the site. British English in anything the owner reads. Silence never counts as consent.
- Jobs that need the owner's local logins stay on the Mac. `humaniser-learn` uses the local `claude` CLI login (about $0.47 a run); moving it would mean a paid API key in the cloud. `metrics-pull` reads an owner-maintained file and writes a local, untracked snapshot that the Monday session reads.

## Decisions

The approach below is the assistant's call; the owner asked for the design to be written without a question round.

### Where each job runs

| Job | Today | After | Cadence |
|---|---|---|---|
| Token price snapshot | launchd, 1st of month 12:00 | **GitHub Actions** | monthly, 1st, after 10:00 UTC (outside DeepSeek peak hours) |
| Hyperscaler Q-results reminder | none | **GitHub Actions** | 1 Feb, 1 May, 1 Aug, 1 Nov: opens a "results are in" issue listing companies whose latest quarter is missing |
| Watchdog | none | **GitHub Actions** | daily |
| Metrics pull | launchd, Mon 07:30 | launchd, plus catch-up and heartbeat | weekly |
| Humaniser learn | launchd, Mon 07:45 | launchd, plus catch-up and heartbeat | weekly |
| Essay line | paused | unchanged; joins on re-enable | — |

### Cloud jobs

- The token-price workflow runs the existing `token-prices.mjs` on a checkout, opens the PR with `GITHUB_TOKEN` (permissions limited to `contents: write` and `pull-requests: write`) and reuses `prBody()`. The launchd job and plist are retired in the same PR.
- The wrapper's `git add` bug is diagnosed and fixed first, with a test, because the same wrapper logic carries over.
- No secrets are needed for the token job. OpenRouter's model list is public.

### Catch-up on the Mac

- Each Mac job keeps its calendar slot and gains `RunAtLoad` plus a daily check slot. On each run the script first asks "is this period's work already done?" (the snapshot file or PR for this week exists) and exits quietly if it is. A missed Monday run then happens at the next login or wake.
- A catch-up run says in its output and heartbeat that it was late.

### Heartbeats

- On success, every job records a timestamp against its name. Cloud jobs need nothing extra, because the watchdog reads their workflow run history. Mac jobs write `gh variable set HEARTBEAT_<JOB> --body <ISO time>` on the repo. Actions variables are not secrets, hold only a timestamp and create no commits.
- On failure, a Mac job records `failed:<ISO time>:<short reason>` in the same variable, so the watchdog can tell "failed" from "never ran".

### Watchdog

- A daily workflow knows each job's expected cadence and grace period (monthly: 2 days; weekly: 1 day; quarterly reminder: 2 days).
- When a job is overdue or failed, it opens one issue titled `Scheduled job needs attention: <job>`, or updates the existing one with a comment. When the job is healthy again, it closes the issue with a comment.
- GitHub notifies the owner of new issues on their own repo through the GitHub app and web. That is the alert channel; no email is sent by this system.
- A Mac that is off for a week will raise issues for the Mac jobs. That is intended: it tells the owner the weekly numbers are missing.

### Monday line

- The Monday session's existing health line reads the same job list and shows one line per job: last success, next due, and any open watchdog issue.

### Single source of truth

- One file, `ops/jobs.json`, lists every job: name, where it runs, cadence, grace and heartbeat source. The watchdog, the Monday line and the docs all read it, so adding a job is one entry.

## Proposed PR split

1. **Fix the token-price wrapper bug**, with a test that reproduces it.
2. **Token-price snapshot on Actions**: workflow, retire the launchd job, `ops/jobs.json` with the first entry.
3. **Heartbeats and catch-up for the Mac jobs** (`metrics`, `humaniser-learn`): `RunAtLoad`, the already-done check, `gh variable` heartbeats, updated plists and install notes.
4. **Watchdog workflow** and issue handling, tested with a forced-stale job.
5. **Hyperscaler quarterly reminder workflow.**
6. **Monday health line and the runbook page** (`infra/` or `distribution/` docs).

Each PR stands alone; after 2 and 4 the most important gap (silent misses) is closed.

## Left to the builder

- The exact catch-up check for each Mac job, and how the daily slot is expressed in the plist.
- The watchdog's implementation language (Node to match the repo, or a small `actions/github-script` step).
- Whether the hyperscaler reminder works out "missing quarter" from `quarters.json` or simply from the calendar.
- Wording of issue titles and bodies (British English).

## Open for the owner

- Should the token-price workflow also post a short summary to the PR when new models appear (the November run listed eight)? The assumption here is yes, as part of the PR body it already writes.
