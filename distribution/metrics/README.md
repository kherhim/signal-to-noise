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
