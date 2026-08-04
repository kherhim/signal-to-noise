# Claude in Chrome — where it fits (and where it doesn't)

Companion to [`AUTONOMY.md`](./AUTONOMY.md) and
[`POSTING-AUTOMATION.md`](./POSTING-AUTOMATION.md). Those cover server-side,
credential-based posting. This covers the browser-agent option — Claude in Chrome
driving the LinkedIn UI directly — because it's the *only* thing that can reach
the one surface no API touches: the LinkedIn newsletter.

Short version: **use it for the newsletter, attended, occasionally. Do not use it
as an unattended hands-off poster.** The reasons matter, so they're below.

---

## What it is, and why it's different from everything else

Claude in Chrome is an Anthropic browser extension (beta on paid Claude plans;
Chrome desktop only). It doesn't call an API — it operates your actual browser:
reads pages, clicks buttons, types into fields, navigates. That means it can drive
UI-only surfaces that have no API at all — including the **LinkedIn newsletter
composer** and **document carousels**, the two highest-leverage LinkedIn things
that `scripts/buffer-queue.mjs` and LinkedIn's own API cannot create.

This is a genuine correction to the earlier "the newsletter must be a manual
paste" claim. It doesn't have to be a raw paste — a browser agent can do the
clicking. But three constraints keep it out of the autonomous path.

---

## Why it is NOT the "without my intervention" engine

### 1. It runs on your machine, not in the cloud
Claude in Chrome lives in *your* Chrome, on *your* computer, in *your* logged-in
session. The autopilot (`scripts/autopilot.mjs`) runs server-side against stored
secrets and needs nothing switched on. Claude in Chrome needs your laptop awake,
Chrome open, and your LinkedIn session live. It cannot be triggered by a scheduled
Routine in this environment. So it can't be the "posts while you fly" mechanism —
that's what the autopilot + Buffer path is for.

### 2. It's in LinkedIn's automation gray zone
LinkedIn's User Agreement explicitly prohibits "browser plugins and add-ons" and
"automated methods to access the Services," and LinkedIn's help docs say
non-compliant browser extensions can trigger **permanent bans**. Used *attended*
and occasionally — you present, driving a real task — it reads like assisted use.
Used *unattended and recurring*, it drifts toward exactly what LinkedIn bans and
detects. The account is the entire asset; don't gamble it for a few saved minutes.
(Ignore tools/repos boasting "0 detection in N weeks" — LinkedIn enforcement is
lumpy and retroactive. "Not caught yet" ≠ "compliant.")

### 3. Prompt injection — it can be made to act as you
This is the risk unique to browser agents and the most important one. Because the
agent operates inside your logged-in session, a malicious instruction hidden in a
page it reads can hijack it into acting as you — posting, messaging, changing
settings. LinkedIn is wall-to-wall untrusted text: comments, DMs, feed posts, any
of which could carry a payload. This is not hypothetical — researchers repeatedly
demonstrated injection chains against the extension through 2026 (e.g. the
"ShadowPrompt" zero-click chain, patched Feb 2026). Anthropic ships classifiers
and high-risk action confirmations to mitigate — but "confirm this action" means
*you supervising*, which is again the opposite of hands-off.

---

## Where it genuinely wins: the newsletter, attended

For the LinkedIn newsletter — UI-only, no API, your single highest-leverage
surface — Claude in Chrome turns a manual paste into an assisted, near-one-click
job. This is the right tool for that one task.

Safe usage pattern:
1. **Be present.** Attended only. Don't leave it running unsupervised on LinkedIn.
2. **One task, then done.** Open the newsletter composer, hand it the edition text
   from `linkedin-newsletter/`, let it fill the fields, **you** click publish.
3. **Keep other tabs closed / minimise exposure.** The fewer untrusted pages in
   context, the smaller the injection surface.
4. **Approve every high-risk action** rather than auto-allowing — the friction is
   the safety feature here, not a bug.
5. **Low frequency.** Once a fortnight for the newsletter, not a daily loop.

Carousels are the same story: UI-only, so Claude in Chrome (attended) is a
reasonable way to build them from the outlines in the `ready-to-post/` packs.

---

## The full picture (which tool for which job)

| Job | Tool | Mode |
|---|---|---|
| Substack full-text posts | `scripts/autopilot.mjs` → `substack-post.mjs` | Hands-off (server-side) |
| LinkedIn feed posts | `scripts/autopilot.mjs` → Buffer | Hands-off (server-side, compliant) |
| **LinkedIn newsletter** | **Claude in Chrome** | **Attended, ~fortnightly** |
| LinkedIn carousels | Claude in Chrome (or Buffer if supported) | Attended |
| Substack Notes | Manual | Human (rewards spontaneity) |

The autonomous engine carries the volume. Claude in Chrome is a precision tool for
the one surface nothing else reaches — used with your hand on it.

---

## The honest bottom line

There is no unattended, cloud, zero-touch way to run LinkedIn safely. Not the API
(Partner-gated, no newsletter). Not the login cookie (ToS/ban). Not Claude in
Chrome (your-machine-bound, injection-exposed, supervision-dependent). The
hands-off part of this campaign lives on Substack and Buffer-fed LinkedIn feed
posts. The newsletter stays a short human-in-the-loop step — now optionally
assisted by Claude in Chrome rather than a raw paste.
