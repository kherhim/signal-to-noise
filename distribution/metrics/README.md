# Metrics pulls

`node scripts/metrics-pull.mjs [--linkedin] [--json]`

Writes `distribution/metrics/YYYY-MM-DD.json` and prints a paste-ready table in the
LEARNING-LOG row format. Substack and Cloudflare are fully scripted; LinkedIn is a
browser routine (see below).

| Source | How | Credential (in `.env`) | Failure mode |
|---|---|---|---|
| Substack | aggregate stats endpoints, no subscriber rows | `SUBSTACK_SID` (session cookie) | 401/403 ⇒ cookie rotated; re-grab per script hint |
| Cloudflare | GraphQL `httpRequests1dGroups`, daily + 30d, bot-burst days flagged (>5× median) | `CLOUDFLARE_ANALYTICS_TOKEN` (Zone · Analytics · Read, scoped to signal-to-noise.co) | missing ⇒ script prints the one-time token recipe |
| LinkedIn | Chrome extension in the user's own session, straight to each post's `/analytics/post-summary/urn:li:activity:<id>/` | none (logged-in browser) | needs an interactive Claude Code session with the Chrome extension |

LinkedIn has no API for personal post analytics. Cookie-based scraping of the
internal API breaks the User Agreement and risks the account, so it is not built.
`linkedin-posts.json` is the registry of activity URNs: add each new post on posting
day (activity page → "View analytics" href) so the pull is a straight navigation, not a hunt.

Free-plan limits: Cloudflare Cache Analytics is paid-only; percent cached comes
from HTTP Traffic cached/total, which bot bursts distort — read the per-day column.

## Weekly schedule (installed 9 Sep 2026)

launchd agent `co.signal-to-noise.metrics` runs the script every **Monday 07:30 local**
with `--linkedin`, logging to `~/Library/Logs/signal2noise-metrics.log`. A missed run
(machine asleep) fires at next wake; a powered-off Monday is skipped. Snapshot JSONs
land in this folder untracked — commit them with the Monday readout.

```
# copy in repo: infra/co.signal-to-noise.metrics.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/co.signal-to-noise.metrics.plist   # install
launchctl kickstart gui/$(id -u)/co.signal-to-noise.metrics                                 # run now
launchctl bootout gui/$(id -u)/co.signal-to-noise.metrics                                   # remove
```

## Substack mirror (daily, hands-off)

launchd agent `co.signal-to-noise.substack-mirror` runs `scripts/substack-mirror.mjs --live --max 1`
every day at 09:15 local. It mirrors any essay that is live on the site for ≥48h and not
yet on Substack, emailing subscribers. Dry run: `node scripts/substack-mirror.mjs`.
Stop it: `touch distribution/autopilot/PAUSE`. Logs: `~/Library/Logs/signal2noise-substack-mirror*.log`.
Fails loudly (exit 1, logged) if `SUBSTACK_SID` has rotated — re-grab per `substack-post.mjs` header.
