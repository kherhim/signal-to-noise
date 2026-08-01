# Posting automation — how I could post for you, safely, after your approval

You asked for a way for me to hold your Substack and LinkedIn credentials and
post on your behalf once you've approved. Here's the honest, researched answer.
It's good news for Substack, a hard "not that way" for one LinkedIn option, and
a clean legitimate path for LinkedIn that costs a little.

**The non-negotiable running through all of it:** anything that reaches your real
audience passes an approval gate first. "After my approval" is the design centre,
not a footnote — I prepare, you approve, then it posts. I won't silently change
what goes out between your approval and the post.

---

## TL;DR recommendation

| Platform | Mechanism | Can I post after approval? | Risk |
|---|---|---|---|
| **Substack** | Existing `scripts/substack-post.mjs` + your `substack.sid` cookie | **Yes** — draft → you approve → publish | Low–moderate (unofficial API, your own account) |
| **LinkedIn — feed posts** | Official partner scheduler (Buffer) API | **Yes**, via Buffer as the posting layer | Low (Buffer holds the LinkedIn partnership) |
| **LinkedIn — via login cookie** | Scripting your `li_at` session | **No — I won't build this** | **High — account ban** |
| **LinkedIn — newsletter & carousels** | — | **No — not possible by any API** | n/a (always manual) |

**My recommendation:** Substack via the existing script in draft-and-approve
mode; LinkedIn feed posts via Buffer; LinkedIn newsletter and carousels stay
manual (they're the highest-value surfaces and simply can't be automated). Details
below.

---

## Substack — feasible today

There's already working tooling: `scripts/substack-post.mjs` drives Substack's
private dashboard API with your `substack.sid` session cookie. Substack has no
official API, but this pattern is stable and well-worn (python-substack wraps the
same endpoints).

**The approval-gated loop:**

1. You drop the cookie into `.env` (gitignored): `SUBSTACK_SID=<value>`.
2. I generate the post and run `substack-post.mjs draft <hook>` → creates an
   **unpublished draft**.
3. You review it — in Substack's own editor, or I paste the rendered text here.
   *This is the approval gate.*
4. On your go, `publish <draftId> --send-email` sends it.

The gate is real: nothing emails your list until you say publish. If you later
want it hands-off, a scheduled Routine (see "Going hands-off" below) can do the
publish step on a set day — but I'd only wire that once you've watched a few go
through and trust the drafts.

**What this costs you:** nothing. **What to know:**
- The cookie is a *full session credential* — whoever holds it can act as you on
  Substack. Keep it in `.env`, never commit it, rotate it (it dies on logout).
- It's an unofficial API. If an endpoint changes, a call fails loudly; it won't
  post something wrong silently.

---

## LinkedIn — the honest picture

LinkedIn is the opposite of Substack: heavily locked down, and the naive
"give the agent my login" approach is genuinely dangerous.

### The option I will NOT build: cookie/session automation

Automating your `li_at` login cookie the way the Substack script uses the
Substack cookie is **against LinkedIn's User Agreement**, and LinkedIn enforces
it aggressively — their March 2026 transparency report cited 23.5 million
automated sessions flagged in a single quarter, with immediate account
restrictions. Detection keys on behavioural signatures a script can't fake at the
personal-profile level. The downside isn't a failed post; it's your account —
the whole audience you're trying to grow — restricted or banned.

I'm not going to build that even if asked, because it puts the asset at risk to
save a few minutes of pasting. If you ever see a tool promising "just paste your
LinkedIn cookie," that's the thing to avoid.

### The official API: real but impractical for an individual

Posting to a personal profile via LinkedIn's own API needs OAuth with the
`w_member_social` scope and the "Share on LinkedIn" product — which requires
LinkedIn **Partner Program** approval. Since 2015 that's gated: long review,
enterprise-oriented, and the Marketing Developer Platform runs ~$699+/month.
Even with it, the API only posts *immediately* (no native scheduling) and is
capped around 100 calls/day. Not worth it for one creator.

Crucially, even the official API **cannot** create LinkedIn **newsletters** or
**document carousels**. Those are UI-only, forever. Since the newsletter is your
single highest-leverage surface, a chunk of the LinkedIn plan is inherently
manual regardless of budget.

### The path that works: an approved scheduler (Buffer)

Buffer is an **official LinkedIn API partner** — it holds the partnership so you
don't have to, it can post to your personal profile compliantly, and it has its
own developer API. This is the legitimate "post after approval" route for
LinkedIn feed posts. Two ways to use it:

- **Zero-integration (recommended to start):** I hand you finished posts (already
  done — `ready-to-post/`); you paste them into Buffer's queue with dates. Buffer
  posts them on schedule. No API, no tokens, ~2 minutes per week. The approval is
  you queuing them.
- **Programmatic:** connect a Buffer API token and I write a small
  `scripts/buffer-queue.mjs` that pushes the prepared posts into Buffer as
  **scheduled drafts** for you to approve in Buffer's UI. You approve the queue;
  Buffer publishes. I never touch your LinkedIn login.

Buffer's free tier covers basic scheduling; programmatic access needs a paid
plan. Typefully and RobinReach are similar approved options if you prefer one of
them — the architecture is identical (they hold the partnership, I feed them
content).

---

## Where credentials should live (not in this session)

Important environmental fact: this session runs in an **ephemeral container** that
gets reclaimed after inactivity, and `.env` is gitignored and does not persist.
So "you have my creds and post without me" can't just mean pasting a cookie here —
it would vanish.

For anything recurring, credentials belong in the **environment's secret / env-var
configuration** (set once on the Claude-Code-on-the-web environment, per
https://code.claude.com/docs/en/claude-code-on-the-web), not in the repo and not
in a chat message. Then:

- A **scheduled Routine** can fire a fresh session on your cadence (e.g. "every
  Monday 08:00") that runs the posting step against those stored secrets.
- Secrets stay out of git, out of the transcript, and are revocable at the source
  (log out of Substack / revoke the Buffer token) at any time.

**Never** paste a long-lived credential into the chat itself — it lands in the
conversation transcript. Environment secrets or `.env` only.

---

## Going hands-off (only once you trust it)

Two levels, and I'd move through them in order, not skip to the end:

1. **Draft-and-approve (start here).** I prepare; you approve each batch; the post
   goes out. Every send has your eyes on it.
2. **Batch-approve + scheduled auto-send.** You approve a *week* of content at
   once; a Monday Routine publishes the Substack post and pushes the LinkedIn
   queue to Buffer automatically. Approval moves from per-post to per-batch — still
   your decision, just less often.

I would not set up level 2 for the *email send* to your Substack list without you
having watched several level-1 sends first. Emailing your subscriber list is
outward-facing and irreversible; that's exactly the kind of action that keeps a
human gate even when the mechanics are automated.

---

## What I need from you (on landing) to switch each on

- **Substack (5 min):** paste a fresh `substack.sid` into `.env`, run
  `node scripts/substack-post.mjs probe` to confirm. Then I can draft-and-publish
  on your approval immediately.
- **LinkedIn (15 min):** decide Buffer vs. paste-manually. If Buffer: create the
  account, connect your LinkedIn profile, and (only if you want programmatic
  queuing) generate an API token and store it as an environment secret. Then I
  build `scripts/buffer-queue.mjs`.
- **Recurring/hands-off:** tell me the cadence and I set up the Routine against
  the stored secrets.

Tell me which of these you want and I'll build the missing pieces. The one thing
I won't do, on any instruction, is script your raw LinkedIn login — that trades
your account for convenience, and it's a bad trade.

---

## Sources (2026 platform mechanics)

- [LinkedIn API approval process (2026)](https://socialmeai.com/blog/linkedin-api-approval-process)
- [LinkedIn API 2026: access, endpoints, limits](https://connectsafely.ai/articles/linkedin-api-complete-guide-2026)
- [LinkedIn API access 2026: partner program, approval, cost](https://www.getphyllo.com/post/linkedin-api-access-in-2026-partner-program-approval-timeline-alternatives)
- [Is LinkedIn automation safe in 2026 — ToS & bans](https://connectsafely.ai/articles/is-linkedin-automation-safe-tos-scraping-guide-2026)
- [LinkedIn automation safety guide 2026](https://getsales.io/blog/linkedin-automation-safety-guide-2026/)
- [Buffer — official social API partner (incl. LinkedIn)](https://buffer.com/made-for/developers)
- [Buffer API docs](https://buffer.com/api)
- [Typefully API](https://support.typefully.com/en/articles/8718287-typefully-api)
