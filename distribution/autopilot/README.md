# autopilot/

The hands-off posting engine. Full design in
[`../AUTONOMY.md`](../AUTONOMY.md); this is the quick reference.

## How it works

`scripts/autopilot.mjs` reads the pre-approved items in `queue/`, and on each run
posts the ones due today — LinkedIn feed posts via Buffer, full-text Substack
posts via `scripts/substack-post.mjs`. A scheduled Routine fires it on a cadence.
It only publishes what's already in the queue; it never writes content.

## queue/ item format

One markdown file per scheduled post. Frontmatter + the exact body to publish:

```
---
date: 2026-08-11          # publish on/after this date (UTC)
channel: linkedin         # linkedin | substack
type: post                # linkedin: post · substack: post|newsletter
title: ...                # substack only
subtitle: ...             # substack only (optional)
canonical: https://...    # substack only (optional SEO safeguard)
send_email: false         # substack only — true actually emails the list
status: pending           # autopilot flips this to posted|skipped
---
<the exact text to publish>
```

Filename convention: `YYYY-MM-DD-channel-slug.md` (date is for humans; the
`date:` field is what the runner reads).

## Commands

```bash
node scripts/autopilot.mjs                    # dry-run: preview today's due items
node scripts/autopilot.mjs --date 2026-08-14  # simulate a specific day
node scripts/autopilot.mjs --live --max 2     # actually post (what the Routine runs)
```

## Kill switch

Create a file named `PAUSE` in this directory and autopilot halts immediately,
posting nothing, until you remove it. (Gitignored, but you can also commit an
empty `PAUSE` to freeze a Routine running elsewhere.)

## Runtime files (gitignored)

- `PAUSE` — kill switch marker
- `log.md` — audit trail of every action

The `queue/` items themselves ARE committed — they're your approved content.
