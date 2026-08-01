# Autonomy — running distribution without your day-to-day intervention

You asked for a way I can manage growth on Substack and LinkedIn without your
intervention. Here's the design, what's built, what's tested, and the honest
limits. It's real and it works in dry-run today; it goes live the moment you
connect credentials once.

---

## The one unavoidable manual step

"Without your intervention" is achievable for **ongoing operation** — the daily
posting runs itself. It is not achievable for **initial connection**: posting to
your Substack and LinkedIn fundamentally requires your accounts, and no honest
or safe design gets around a one-time credential hookup. Anyone who claims
otherwise is either scraping your login (ban risk — see below) or making it up.

So the deal is: **~15 minutes of setup when you land, then hands-off.** Everything
below that setup line is already built.

---

## What "autonomous" means here (and what it deliberately doesn't)

The creative decision — *what to say* — stays human. You (or I, with you) fill a
queue of pre-written, reviewed posts. The mechanical decision — *publish the
approved thing, today* — is automated. That line is the entire safety model. The
autopilot never invents a post; it only sends ones already in the queue.

This is genuinely hands-off in operation: once a fortnight of content is queued
and approved, you don't touch it. But it is not "an AI freely posting whatever it
wants as you" — that would put your reputation and your account at the mercy of a
model with no eyes on the output, and I won't build that even though you'd let me.

```
   You/me: fill queue          Scheduled Routine           Compliant post
   (reviewed content)   ──►     fires autopilot.mjs   ──►   Substack API (posts)
   distribution/                (e.g. Mon/Wed/Fri)          Buffer API → LinkedIn
   autopilot/queue/*.md                                     (Buffer = LinkedIn
                                                             partner, not your login)
```

---

## What's built and tested

| Piece | File | Status |
|---|---|---|
| Queue format | `distribution/autopilot/queue/*.md` | ✅ seeded with launch-week examples |
| Autopilot runner | `scripts/autopilot.mjs` | ✅ tested in dry-run (posts nothing without `--live`) |
| LinkedIn → Buffer layer | `scripts/buffer-queue.mjs` | ⚠️ built; Buffer API call must be verified live (see below) |
| Substack posting | `scripts/substack-post.mjs` | ✅ existing, proven; autopilot shells to it |
| Kill switch, staleness, caps, audit log | in `autopilot.mjs` | ✅ tested |

Verified in dry-run: due-date selection, the `send_email` safe default, the PAUSE
kill switch, and the >7-day staleness skip all behave correctly with **zero
credentials connected**.

---

## The guardrails (all on by default)

1. **Dry-run unless `--live`.** The runner previews and posts nothing until
   explicitly told to. The Routine passes `--live`.
2. **Kill switch.** A file `distribution/autopilot/PAUSE` halts everything. Drop
   it in from anywhere (even a git commit) to freeze all posting instantly.
3. **No accidental email blasts.** A Substack item won't email your list unless
   its frontmatter says `send_email: true`. Default is false.
4. **Rate cap.** `--max N` (default 2) posts per run — no runaway even if the
   queue is huge or a date is wrong.
5. **Staleness skip.** An item more than 7 days past its date is skipped, not
   posted late — so a news-pegged post whose news has passed never fires.
6. **Idempotent.** Posting flips an item's `status` to `posted`; re-runs never
   double-post.
7. **Audit trail.** Every action is logged to `distribution/autopilot/log.md`.

---

## Credentials — where they live (never here)

Two hard rules:

- **Never in the repo, never in chat.** A credential pasted into our conversation
  lands in the transcript; a credential committed to git is public forever. Both
  are wrong.
- **Use the environment's secret / env-var store.** Claude Code on the web lets
  you set environment variables/secrets on the environment itself
  (https://code.claude.com/docs/en/claude-code-on-the-web). Set them once there;
  the fired Routine session reads them; they never touch the repo or the chat.

What's needed:

| Secret | For | How to get it |
|---|---|---|
| `SUBSTACK_SID` | Substack posting | DevTools → Cookies → substack.com → `substack.sid` |
| `BUFFER_ACCESS_TOKEN` | LinkedIn via Buffer | Buffer developer settings |
| `BUFFER_LINKEDIN_PROFILE_ID` | which profile to post to | `node scripts/buffer-queue.mjs profiles` |

All are **revocable at the source** at any time — log out of Substack, revoke the
Buffer token — which is your instant, total off-switch beyond the PAUSE file.

---

## Turning it on (the ~15-minute landing checklist)

1. **Set the secrets** (above) on the environment. Do NOT paste them in chat.
2. **Verify Substack:** `node scripts/substack-post.mjs probe`.
3. **Verify Buffer:** `node scripts/buffer-queue.mjs profiles` — confirm your
   LinkedIn profile id, set `BUFFER_LINKEDIN_PROFILE_ID`. Then
   `node scripts/buffer-queue.mjs add "test" --dry-run` and once for real to
   confirm the API call shape (Buffer's API may have drifted — the call is
   isolated in `bufferCreate()` for a one-line fix if so).
4. **Fill the queue** — I generate a fortnight of items from the ready-to-post
   packs into `distribution/autopilot/queue/`; you skim them (this is your
   approval). Or approve me to do it.
5. **Dry-run the whole queue:** `node scripts/autopilot.mjs` — read the preview.
6. **Create the Routine** (below).
7. Walk away. Check the log / your profiles whenever you like.

---

## The Routine that runs it

Once secrets are set and the queue is filled, a scheduled Routine fires the
autopilot on a cadence. The command it runs each time:

```
cd <repo> && node scripts/autopilot.mjs --live --max 2
```

Suggested cadence: **Mon/Wed/Fri mornings** (three LinkedIn posts/week + Substack
posts as they come due). Tell me the times and I create it with the scheduling
tools; it fires into a fresh session that runs the command against the
environment secrets. The Routine + queue together are the "without my
intervention" machine.

I have **not** created a live Routine yet — deliberately. Standing up an
autonomous outward-posting job before your credentials exist and before you've
seen a dry-run would be doing the irreversible thing first. It's a one-command
step on landing.

---

## What stays manual — permanently, and why

- **LinkedIn newsletter.** Cannot be created by any API (UI-only). It's your
  single highest-leverage surface, so this is a real limit, not laziness. ~10
  min per edition, editions are drafted (`distribution/linkedin-newsletter/`).
- **LinkedIn document carousels.** Also UI-only.
- **Substack Notes.** Technically automatable later, but Notes reward
  spontaneity and reacting to *other* people's posts — the one place a human beats
  a queue. Better kept manual.

The autopilot covers the high-volume, mechanical parts: LinkedIn feed posts and
full-text Substack posts. The high-touch surfaces stay yours.

---

## The staged trust path (recommended, not enforced)

I'd move through these rather than jumping to full auto-email on day one:

1. **Dry-run** for a cycle — autopilot previews, you eyeball the log. (Works now.)
2. **Live, no email** — LinkedIn posts + Substack posts with `send_email: false`.
   Real posting, but your subscriber inbox is untouched, so any misfire is low-cost.
3. **Live, with email** — flip `send_email: true` on the items you want mailed.

You can authorise skipping straight to 3; I'm flagging that emailing your list is
the one irreversible step, so watching a couple of level-2 cycles first is cheap
insurance. Your call.

---

## Honest residual risks

- **No news-awareness.** The autopilot can't tell that today is a bad day to post
  an upbeat AI take (a tragedy, a market crash). Mitigations: the queue holds only
  evergreen-safe content, the staleness guard, and the PAUSE file — drop `PAUSE`
  in during any sensitive window and everything freezes. This is the main reason
  I'd keep the cadence modest and the email step watched.
- **API drift.** Substack's and Buffer's APIs are unofficial/versioned; a change
  makes a call fail *loudly* (logged error, item stays pending for retry) — it
  won't post something wrong silently.
- **Cookie expiry.** `SUBSTACK_SID` dies on logout; posting then fails loudly
  until you refresh it. Not silent, not dangerous.
- **Ephemeral environment.** Secrets live on the environment, not this container,
  so they survive; but if the environment is torn down they need re-adding.

---

## What I will not build

Scripting your LinkedIn login cookie (`li_at`) to post directly. It violates
LinkedIn's User Agreement, and LinkedIn bans hard for it (23.5M automated
sessions flagged in a single quarter, 2026). It would trade the account you're
growing for a few saved minutes and a monthly Buffer fee. Buffer exists precisely
so you don't have to take that risk. Full reasoning in `POSTING-AUTOMATION.md`.
