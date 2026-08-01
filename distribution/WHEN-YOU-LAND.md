# When you land — execute in this order

Everything below is banked and ready in this repo. Nothing has been posted (that
needs your accounts, and publishing to your real audience unsupervised isn't
something to automate). This is a paste-and-schedule list, not a writing task.

Total setup time: ~45 minutes. Then ~20 min/day to run the first month.

---

## Step 0 — Pull the branch (2 min)

```bash
git fetch origin claude/article-virality-strategy-mryigw
git checkout claude/article-virality-strategy-mryigw
```

Everything referenced below is under `distribution/`.

---

## Step 1 — One-time setup (~45 min, do once)

- [ ] **Create the LinkedIn newsletter.** Follow
      `distribution/linkedin-newsletter/launch-checklist.md`. Name it
      *Signal to Noise*. Don't publish the first edition yet — just create it.
- [ ] **Google Search Console** — verify the domain (DNS TXT method) and submit
      `sitemap-index.xml`. See `SEO-Plan.md` §4.1. ~10 min.
- [ ] **Analytics** — confirm Cloudflare Web Analytics is live (it's server-side,
      already on per the README) or add Plausible. See `SEO-Plan.md` §4.2.
- [ ] **Refresh the Substack cookie** — this container didn't have your `.env`.
      Grab a fresh `SUBSTACK_SID` (DevTools → Application → Cookies →
      substack.com → `substack.sid`) into `.env` before the first Substack post.
      Test: `node scripts/substack-post.mjs probe`.

---

## Step 2 — Launch week (the newsletter fires once — make it count)

The launch edition sends a one-time subscribe invite to every existing follower.
Do it on a day you can be online for 90 minutes afterward.

- [ ] **Mon** — Publish LinkedIn newsletter Edition 1.
      Paste `distribution/linkedin-newsletter/edition-01-600-year-curve.md`.
      Reply to every comment for the first 90 minutes.
- [ ] **Mon (later)** — Post LinkedIn native Post 1 from
      `distribution/ready-to-post/600-year-curve.md`. No link in the body.
- [ ] **Tue** — Post one Substack Note from the 600-year-curve pack. Restack it.
- [ ] **Wed** — LinkedIn native Post 2 (600-year curve). Reply to comments.
- [ ] **Thu** — Substack Note (600-year curve, the question-form one).
- [ ] **Fri** — LinkedIn native Post 3 (600-year curve) OR the carousel.

That's one essay producing a full week of presence.

---

## Step 3 — The repeatable weekly rhythm (weeks 2–4)

Each week, pick one pack from `distribution/ready-to-post/` and one newsletter
edition. The rhythm per week:

| Day | Action | Source |
|---|---|---|
| Mon | LinkedIn native post (idea 1 of the week's pack) | `ready-to-post/<slug>.md` |
| Tue | Substack Note + restack | same pack |
| Wed | LinkedIn native post (idea 2) | same pack |
| Thu | Substack Note (question-form) | same pack |
| Fri | LinkedIn newsletter edition (once every 2 weeks) OR carousel | `linkedin-newsletter/` |
| Daily-ish | 1 Substack Note — a peer restack or a standalone line | your judgement |

### Suggested 4-week running order (zero new writing)

| Week | Pack | Newsletter edition |
|---|---|---|
| 1 | `600-year-curve` | **Edition 1** (launch) |
| 2 | `when-cognition-becomes-metered` | — |
| 3 | `pricing-the-future-ipos` | **Edition 2** (metered cognition) |
| 4 | `10-commandments-experienced-cfo` + `leadership-lessons-shorts` | — |

Then keep going: `bayesian-thinking-for-cfos`, `future-finance-talent-stack`,
`leadership-era-genai`, `using-llms-cheat-sheet-cfos`, `future-gpt`,
`from-bean-counting-bots`, `buffett-on-the-fortress-balance-sheet`, and Edition 3
(Pricing the future). Then work down `back-catalog-queue.md`. There's roughly two
months of material already drafted, and 45 more articles behind it.

---

## Step 4 — For every NEW essay from now on

The release routine in the README is already updated. In short:

1. Site publishes (day 0, `./publish.sh`).
2. **48h later:** Substack full text with a `canonical:` field
   (`scripts/substack-post.mjs` — README §2). Restack same day.
3. **~day 7:** LinkedIn newsletter edition (links the canonical freely).
4. Native LinkedIn posts across the fortnight — generate the pack with
   `node scripts/repurpose.mjs <slug>`, then edit.

---

## Step 5 — Measure (5 min every Monday)

Track six numbers (`DISTRIBUTION-Plan.md` §5): Substack subscribers · LinkedIn
followers · newsletter subscribers · site sessions · sessions by referrer · GSC
impressions/clicks. The one that matters is **net new subscribers per piece** —
that's the number that compounds. Site traffic lags subscriber growth by a month
or two; don't judge week one on it.

---

## The one guardrail

The brand is *"signal, not noise."* Every asset here is built to increase reach
without becoming noise. If a post ever feels like engagement-bait, cut it — a
smaller true audience compounds; a larger hollow one doesn't.

---

## If you want me to do more while you're away

Reply and I can, without your accounts: draft the remaining ready-to-post packs
for the whole back catalogue, write newsletter editions 4–8, or prep the
tag-taxonomy changes for your review (the script's ready — `node
scripts/normalize-tags.mjs` — but re-tagging is your editorial call, so I left it
un-applied). What I can't do is post, publish, or create accounts — those wait
for you.
