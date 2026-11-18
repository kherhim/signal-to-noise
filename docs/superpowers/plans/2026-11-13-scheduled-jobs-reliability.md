# Scheduled Jobs Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every scheduled job either runs or raises one GitHub issue saying it didn't, with CI on every PR.

**Architecture:** A pull-request CI workflow comes first, so every later PR is checked. Jobs that need nothing from the Mac (token-price snapshot, hyperscaler reminder, watchdog) run as GitHub Actions workflows. Mac-bound jobs (metrics pull, humaniser learn) keep launchd but gain catch-up runs and record heartbeats in repo Actions variables. A daily watchdog reads one job registry (`ops/jobs.json`), the workflow run history and those variables, and opens, updates or closes one issue per unhealthy job.

**Tech Stack:** Node 26 ES modules, `node:test`, GitHub Actions (`ubuntu-latest`, `actions/checkout@v4`, `actions/setup-node@v4`), `gh` CLI, launchd plists.

**Spec:** `docs/superpowers/specs/2026-11-13-scheduled-jobs-reliability-design.md`

## Global Constraints

- One PR per task, branched from `main`, merged with a merge commit after CI passes; fast-forward local `main` before the next task (owner rule).
- Deploy after any merge that changes the built site (`npm run build` then `./deploy.sh`, then verify live). Tasks 1–7 change no page except where stated.
- £0 a month in new running costs; no paid API keys in Actions.
- No email alerts. Alerts are GitHub issues only.
- One open issue per problem, updated in place and closed on recovery; never one issue per run.
- Repo is public: workflows never print secrets, tokens or file contents from `.env`.
- Every workflow sets an explicit least-privilege `permissions:` block.
- British English in every string the owner reads (issue titles and bodies, PR bodies, docs); no em dashes; never the word "ledger".
- Nothing merges automatically; jobs propose through PRs or issues.
- The essay line stays paused: do not touch `co.signal-to-noise.essay-line` or `distribution/autopilot/PAUSE`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Review Focus

1. **Mac off for days, then switched on:** each Mac job runs once at login and records `:late`; it does not run twice in the same week. (Task 5 test `runs once per period after a missed slot`.)
2. **Heartbeat write fails** (`gh` offline or logged out): the job's own result still stands, the failure is logged, and the process exits non-zero only if the job itself failed. (Task 5 test `heartbeat failure never masks the job result`.)
3. **Watchdog run while a problem issue is already open and still failing:** comments on the existing issue, no duplicate. (Task 6 test `updates the open issue, never opens a second`.)
4. **Brand-new job with no history yet:** reported as `never-run` only once its first due time plus grace has passed, not on day one. (Task 6 test `new job is not overdue before its first due time`.)
5. **PRs opened by `GITHUB_TOKEN` don't trigger other workflows,** so the token-price PR would arrive with no CI. The token workflow runs the tracker tests and the build itself before opening the PR, and says so in the PR body. (Task 3 step 3.)

---

### Task 1: CI on every pull request

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: whatever fixes the one failing test (see Step 1)

**Interfaces:**
- Produces: a check named `ci / test-and-build` that later PRs wait on.

- [ ] **Step 1: Make the suite green locally.** Today `npm run test:line` reports `pass 295, fail 1`: `owner-rate guard: no kept pair flags the owner's own voice`. Diagnose it (likely a humaniser-learn proposal merged in PR #51 added a pair that flags the owner's own writing). If the cause is a kept pair, remove that pair on this branch and say which one in the PR body. If the fix needs a judgement about the owner's voice, stop and ask the owner. Never skip or delete the test.
- [ ] **Step 2: Verify all four suites pass.** Run `npm run test:line && npm run test:trackers && npm run test:site && npm run test:audio`. Expected: every `ℹ fail 0`.
- [ ] **Step 3: Write `.github/workflows/ci.yml`.** Triggers: `pull_request` to `main` and `push` to `main`. `permissions: contents: read`. One job `test-and-build` on `ubuntu-latest`: checkout, setup-node `node-version: 26` with npm cache, `npm ci`, the four test scripts, `npm run build`. Set `LINE_NO_FILE_LOG=1` at job level. `concurrency` keyed on the ref, cancelling in progress.
- [ ] **Step 4: Verify the build needs no secrets.** Run `env -i PATH="$PATH" HOME="$HOME" npm run build` locally. Expected: success with no `.env`. If any prebuild step needs a secret, gate that step on its env var being present and say so in the PR.
- [ ] **Step 5: Commit, push, open the PR,** and confirm `gh pr checks --watch` shows `test-and-build` passing. Merge, then fast-forward `main`.

### Task 2: Fix the silent no-op in the token-price scripts

Root cause, confirmed 13 Nov: both scripts gate `main()` on `process.argv[1] === fileURLToPath(import.meta.url)`. Inside a macOS temp worktree, `argv[1]` is `/var/folders/...` while `import.meta.url` resolves to `/private/var/folders/...`. The check is false, so the script exits 0 having done nothing, and the wrapper then fails at `git add`.

**Files:**
- Create: `scripts/lib/is-main.mjs`
- Create: `scripts/lib/test/is-main.test.mjs`
- Modify: `scripts/trackers/token-prices.mjs:105`, `scripts/trackers/token-prices-monthly.mjs` (entry check, plus post-run file check)
- Modify: `scripts/trackers/test/token-prices-monthly.test.mjs`
- Modify: `package.json` (add `scripts/lib/test/*.mjs` to `test:site` or a new `test:lib` script, and add it to CI)

**Interfaces:**
- Produces: `isMain(importMetaUrl: string, argv1: string | undefined): boolean` in `scripts/lib/is-main.mjs`.
- Produces: `DEPS.exists(p: string): boolean` on the wrapper's deps (default `fs.existsSync`).

- [ ] **Step 1: Write failing tests.**
  - `is-main.test.mjs`: `isMain detects the entry file through a symlinked directory` creates a temp dir, a file inside it and a symlink to the dir, then asserts `isMain(pathToFileURL(realFile).href, viaSymlink) === true`. Also `isMain is false for another file` and `isMain is false when argv1 is undefined`.
  - Wrapper test `fails loudly when the snapshot file was not written`: fake deps with `exists: () => false` → `runMonthly` throws `/snapshot .*2026-11\.json was not written/`, and no `git add` call appears in `calls`.
- [ ] **Step 2: Run them and see them fail.** `node --test scripts/lib/test/is-main.test.mjs scripts/trackers/test/token-prices-monthly.test.mjs`
- [ ] **Step 3: Implement `isMain`** by comparing `fs.realpathSync` of both sides, returning false if either throws. Use it in both scripts. In `runMonthly`, after the `node` call, throw `snapshot src/data/token-prices/snapshots/<month>.json was not written` unless `deps.exists(path.join(wt, rel))`.
- [ ] **Step 4: Run all tracker tests and the new lib tests.** Expected: pass, fail 0.
- [ ] **Step 5: Reproduce end to end.** Run the wrapper with `ls-remote`, `push` and `gh` stubbed (see the 13 Nov reproduction in the PR body) and confirm the snapshot file now exists in the temp worktree.
- [ ] **Step 6: Commit, PR, CI green, merge, fast-forward `main`.**

### Task 3: Token-price snapshot on GitHub Actions, and the job registry

**Files:**
- Create: `.github/workflows/token-prices.yml`
- Create: `ops/jobs.json`
- Create: `ops/test/jobs.test.mjs`
- Modify: `scripts/trackers/token-prices-monthly.mjs` (`notify` no-op off macOS; the PR body notes CI did not run)
- Delete: `~/Library/LaunchAgents/co.signal-to-noise.token-prices.plist` (local, after `launchctl bootout`); record it in `infra/SCHEDULED-JOBS.md` (created in Task 7, so note it in this PR body for now)

**Interfaces:**
- Produces: `ops/jobs.json`, an array of
  `{ "name": string, "runs_on": "actions" | "mac", "cadence": { "kind": "monthly", "day": number, "hour_utc": number } | { "kind": "weekly", "weekday": 1-7, "hour_utc": number } | { "kind": "quarterly", "months": number[], "day": number, "hour_utc": number }, "grace_hours": number, "heartbeat": { "workflow": string } | { "variable": string }, "paused"?: boolean }`.
  The first entry is `token-prices` (monthly, day 1, 11:00 UTC, grace 48h, workflow `token-prices.yml`).
- Consumes: the Task 2 wrapper.

- [ ] **Step 1: Write a failing test** `ops/test/jobs.test.mjs`: `every job has a valid cadence, grace and exactly one heartbeat source`, and `job names are unique kebab-case`. Add `ops/test/*.mjs` to a `test:ops` script and to CI.
- [ ] **Step 2: Run it, see it fail, then create `ops/jobs.json`** with the `token-prices` entry and run it again to pass.
- [ ] **Step 3: Write the workflow.** `on: schedule: cron '0 11 1 * *'` plus `workflow_dispatch`. `permissions: contents: write, pull-requests: write`. Steps: checkout with `fetch-depth: 0`, setup-node 26, `npm ci`, set the git identity to `github-actions[bot]`, `npm run test:trackers`, `npm run build`, then `node scripts/trackers/token-prices-monthly.mjs` with `GH_TOKEN: ${{ github.token }}`. The PR body gains one line: "CI does not run on PRs opened by the workflow; tracker tests and the build passed before this PR was opened."
- [ ] **Step 4: Check the repo setting.** `gh api repos/kherhim/signal-to-noise/actions/permissions/workflow` must show `can_approve_pull_request_reviews: true` ("Allow GitHub Actions to create and approve pull requests"). If it shows false, ask the owner before changing it, because it's an account setting.
- [ ] **Step 5: Verify with a dry dispatch.** Add an input `dry: boolean` that runs `token-prices.mjs --dry` and skips the PR. Run `gh workflow run token-prices.yml -f dry=true` and expect a green run whose log shows the price table.
- [ ] **Step 6: Retire the launchd job.** `launchctl bootout gui/$(id -u)/co.signal-to-noise.token-prices`, then move the plist to `~/Library/LaunchAgents/disabled/`. Run `launchctl list | grep token-prices` and expect no output.
- [ ] **Step 7: Commit, PR, CI green, merge, fast-forward `main`.**

### Task 4: Hyperscaler quarterly reminder

**Files:**
- Create: `scripts/trackers/hyperscalers-reminder.mjs`
- Create: `scripts/trackers/test/hyperscalers-reminder.test.mjs`
- Create: `.github/workflows/hyperscalers-reminder.yml`
- Modify: `ops/jobs.json` (add `hyperscalers-reminder`: quarterly, months [2,5,8,11], day 1, 09:00 UTC, grace 48h, workflow `hyperscalers-reminder.yml`)

**Interfaces:**
- Produces: `expectedQuarter(now: Date): string` returns the calendar quarter that ended before the start of the previous month (on 1 Nov 2026 that is `"Q3 2026"`; on 1 Feb 2027, `"Q4 2026"`).
- Produces: `missingCompanies(data: object, now: Date): string[]`, the names of companies whose last `quarters[].q` is earlier than `expectedQuarter(now)`.

- [ ] **Step 1: Failing tests.** `expectedQuarter` for 2026-11-01 → `Q3 2026`, 2027-02-01 → `Q4 2026`, 2026-05-01 → `Q1 2026`. `missingCompanies` on fixture data where Meta and Oracle have Q3 and the rest Q2 → `['Alphabet','Microsoft','Amazon']`. With everyone on Q3 → `[]`.
- [ ] **Step 2: Implement both, then run the tests and see them pass.**
- [ ] **Step 3: CLI behaviour.** When the list is non-empty, open an issue titled `Hyperscaler tracker: <quarter> results to add` (or comment on the open one with that title), listing the companies and linking `src/data/hyperscalers/quarters.json`. When it is empty, do nothing and exit 0.
- [ ] **Step 4: Workflow.** Cron `0 9 1 2,5,8,11 *` plus `workflow_dispatch`. `permissions: contents: read, issues: write`.
- [ ] **Step 5: Dispatch it once** with `gh workflow run hyperscalers-reminder.yml` and check the outcome matches the data on `main` at that moment.
- [ ] **Step 6: Commit, PR, CI green, merge, fast-forward `main`.**

### Task 5: Heartbeats and catch-up for the Mac jobs

**Files:**
- Create: `scripts/ops/heartbeat.mjs`
- Create: `scripts/ops/test/heartbeat.test.mjs`
- Modify: `scripts/metrics-pull.mjs`, `scripts/line/humaniser-learn.mjs` (wrap `main` with the catch-up and heartbeat)
- Modify: `ops/jobs.json` (add `metrics`: weekly, Monday, 06:30 UTC, grace 24h, variable `HEARTBEAT_METRICS`; and `humaniser-learn`: weekly, Monday, 06:45 UTC, grace 24h, variable `HEARTBEAT_HUMANISER_LEARN`)
- Modify (local): both plists gain `RunAtLoad` true and a second `StartCalendarInterval` entry for every day at 10:00; reload with `bootout` then `bootstrap`.

**Interfaces:**
- Produces: `periodStart(cadence, now: Date): Date`, the start of the slot period containing `now` (for weekly, the most recent scheduled weekday and hour at or before `now`).
- Produces: `parseHeartbeat(value: string | undefined): { status: 'ok' | 'failed', at: Date, late: boolean, reason?: string } | null`.
- Produces: `formatHeartbeat({ status, at, late, reason }): string`, giving `ok:<ISO>`, `ok:<ISO>:late` or `failed:<ISO>:<reason, max 100 chars, no newlines>`.
- Produces: `runWithHeartbeat(jobName: string, fn: () => Promise<void>, deps?: { now, readVar, writeVar, log }): Promise<'skipped' | 'ok' | 'failed'>`. It reads the job's cadence from `ops/jobs.json`. If the heartbeat is `ok` at or after `periodStart`, it returns `'skipped'`. Otherwise it runs `fn` and writes the heartbeat, with `late = now > periodStart + 6h`. `readVar` and `writeVar` default to `gh variable get` and `gh variable set` on the repo.

- [ ] **Step 1: Failing tests** in `heartbeat.test.mjs`:
  - `format and parse round-trip` for all three forms. A reason containing a newline is flattened.
  - `runs once per period after a missed slot`: cadence weekly Monday 06:30. The last ok was the previous Monday. `now` is Wednesday 10:00, so it returns `'ok'` with `late: true`. A second call with the updated var returns `'skipped'`.
  - `heartbeat failure never masks the job result`: `writeVar` throws and `fn` succeeds, so it returns `'ok'` and logs the write failure. If `fn` throws, it returns `'failed'` and rethrows after the write attempt.
  - `periodStart` on a Monday 06:29 returns the previous Monday 06:30.
- [ ] **Step 2: Run them and see them fail. Implement them, then run them and see them pass.**
- [ ] **Step 3: Wire both jobs through `runWithHeartbeat`.** Keep each script's existing behaviour inside `fn` unchanged.
- [ ] **Step 4: Update and reload both plists.** Check with `launchctl print gui/$(id -u)/co.signal-to-noise.metrics | grep -E 'state|runs'`. Expect it loaded. Run `gh variable list` and expect both `HEARTBEAT_*` variables to appear after a manual kick (`launchctl kickstart`).
- [ ] **Step 5: Commit** (repo files only; describe the plist changes in the PR body), PR, CI green, merge, fast-forward `main`.

### Task 6: Daily watchdog

**Files:**
- Create: `scripts/ops/watchdog.mjs`
- Create: `scripts/ops/test/watchdog.test.mjs`
- Create: `.github/workflows/watchdog.yml`
- Modify: `ops/jobs.json` (add `watchdog` itself: daily 05:00 UTC, grace 48h, workflow `watchdog.yml`; it's checked by the Monday line, not by itself)

**Interfaces:**
- Consumes: `periodStart` and `parseHeartbeat` from Task 5, and `ops/jobs.json` from Task 3.
- Produces: `lastDue(cadence, now: Date): Date | null`, the most recent scheduled time at or before `now`, or null if there has never been one since `firstDueAfter`.
- Produces: `assess(jobs, now: Date, evidence: Record<string, { lastOk?: Date, lastFailed?: { at: Date, reason: string } }>): Array<{ job: string, status: 'ok' | 'overdue' | 'failed' | 'never-run' | 'paused', detail: string }>`. A job is unhealthy when `lastDue + grace < now` and there is no ok at or after `lastDue`. `failed` beats `overdue` when the latest evidence is a failure.
- Produces: `syncIssues(results, gh: { listOpen(prefix): Promise<{number, title}[]>, open(title, body), comment(n, body), close(n, body) }): Promise<void>`. Issue title: `Scheduled job needs attention: <job>`.

- [ ] **Step 1: Failing tests:**
  - `ok when the last success follows the last due time`.
  - `overdue after grace with no success`: token-prices, now 2026-11-04 12:00, last ok 2026-10-01, so `overdue`.
  - `failed when the heartbeat says failed`.
  - `new job is not overdue before its first due time`: no evidence and first due is in the future, so `ok`. Once past due plus grace, it is `never-run`.
  - `paused jobs are reported as paused and never alert`.
  - `updates the open issue, never opens a second`: an open issue exists for metrics and metrics is still overdue, so exactly one `comment` and no `open`.
  - `closes the issue on recovery` with a comment that names the recovery time.
- [ ] **Step 2: Run them and see them fail. Implement them, then run them and see them pass.**
- [ ] **Step 3: Evidence gathering in the CLI.** For `workflow` jobs, use `gh run list --workflow <file> --status success --limit 1 --json createdAt`, plus the latest failed run. For `variable` jobs, read the `vars` context, passed to the script as `VARS_JSON: ${{ toJSON(vars) }}`.
- [ ] **Step 4: Workflow.** Cron `0 5 * * *` plus `workflow_dispatch`. `permissions: actions: read, issues: write, contents: read`.
- [ ] **Step 5: Verify with a forced-stale run.** Dispatch the workflow with input `pretend_now: 2026-12-04T12:00:00Z`. Expect one issue for `token-prices`. Dispatch again normally and expect it closed or untouched, according to the real state. Delete any test issue it created, with a note in the PR.
- [ ] **Step 6: Commit, PR, CI green, merge, fast-forward `main`.**

### Task 7: Monday health line and runbook

**Files:**
- Create: `scripts/ops/health-line.mjs`
- Create: `scripts/ops/test/health-line.test.mjs`
- Create: `infra/SCHEDULED-JOBS.md`
- Modify: `.claude/skills/essay-line-monday/SKILL.md` (its health line calls `node scripts/ops/health-line.mjs`)

**Interfaces:**
- Consumes: `assess` from Task 6, and the evidence gathering factored out of the watchdog CLI into an exported `gatherEvidence(jobs, gh): Promise<evidence>`.
- Produces: `healthLines(results, openIssues: {number, title}[]): string[]`, one line per job in the form `✅ token-prices: last ok 1 Dec 11:02, next due 1 Jan` or `❌ metrics: overdue since Mon 7 Dec 07:30 (issue #61)`.

- [ ] **Step 1: Failing tests** for the ok, overdue, failed and paused line formats, with British date formatting (`1 Dec`, `Mon 7 Dec`).
- [ ] **Step 2: Run them and see them fail. Implement them, then run them and see them pass.**
- [ ] **Step 3: Write `infra/SCHEDULED-JOBS.md`.** Cover the job table (from `ops/jobs.json`), how to add a job, how alerts work, how to pause a job (`"paused": true`), the retired token-prices plist, and how to reload a Mac job.
- [ ] **Step 4: Point the Monday skill's health line at the script,** and run it once locally to check the output.
- [ ] **Step 5: Commit, PR, CI green, merge, fast-forward `main`.** Update the Build Monitor roadmap row and the memory notes for the token-price tracker and the metrics pull.
