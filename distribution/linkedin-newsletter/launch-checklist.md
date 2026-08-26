# LinkedIn newsletter — launch checklist

The single highest-leverage move in the whole distribution plan. A LinkedIn
newsletter is the *only* surface on the platform that bypasses feed ranking:
each edition fires three notifications to every subscriber (email, mobile push,
in-app), links inside it are **not** downranked the way feed-post links are, and
editions get indexed by Google. It's the one LinkedIn mechanism that will
actually send readers to signal-to-noise.co — and it keeps working for months.

You already have the two things that make a launch land: a long Pulse history
(every article's `sourceUrl` is a `/pulse/` URL) and a 57-piece back catalogue
to draw editions from.

---

## One-time setup (~15 minutes)

- [ ] From your LinkedIn profile: **Create** → **Write article** → toggle **Create newsletter** (or Profile → Resources → Create a newsletter).
- [ ] **Name:** *Signal to Noise* — brand continuity with the site and Substack. (Not "Himanshu's Newsletter" — the brand is the asset.)
- [ ] **Cadence label:** choose "Weekly" or "Bi-weekly". Match whatever you'll actually sustain (the plan recommends fortnightly). LinkedIn shows this to prospective subscribers; missing your stated cadence hurts you.
- [ ] **Logo/cover:** reuse the site's default OG graphic or the orbital/hero motif so it's visually the same brand.
- [ ] **Description (≤ 2 lines):** "Pragmatic essays on finance, AI, and capital strategy from a CFO with 25+ years in the field. Signal, not noise." (Same audience signal as the site title tag.)

**Important — the launch fires once.** When you publish the *first* edition,
every one of your existing followers gets a one-time notification inviting them
to subscribe. You get exactly one of these. Don't waste it on a thin post —
launch with a strong edition (draft below), on a day you can be online to reply
to comments for the first 60–90 minutes.

---

## Per-edition routine (fits the existing release order)

The newsletter slots into the release sequence *after* the canonical + Substack,
so Google indexes the site first:

```
Day 0   Site (canonical) goes live      — existing publish.sh flow
Day 2   Substack (full text + email)    — 48h later, canonical indexed first
Day 7   LinkedIn newsletter edition     — links freely to the canonical
```

Per edition:
- [ ] Adapt the essay lightly for LinkedIn (their editor, native formatting).
- [ ] **Link the canonical** near the top and again at the end — with UTM:
      `?utm_source=linkedin&utm_medium=newsletter&utm_campaign=<slug>`
      (Links here are safe — the newsletter is exempt from the feed link penalty.)
- [ ] Title in sentence case, matching site convention.
- [ ] Publish on a consistent day/time. Consistency compounds; bursts don't.
- [ ] Be online for the first 60–90 minutes to reply to comments.

---

## What to publish, first 8 editions (no new writing required)

You have a back catalogue. The first two months of the newsletter can run
entirely on existing essays, which also seeds the archive so later organic
subscribers find depth:

1. **The 600-year curve** — strongest breakout, universal topic. Launch edition.
2. **When cognition becomes metered** — the £0.40 NDA hook.
3. **Pricing the future: SpaceX, Anthropic, OpenAI IPOs** — high search intent.
4. **The 2nd most expensive decision: "let's wait"** — short, contrarian.
5. **When KPIs become the strategy, the strategy dies** — the four-line list.
6. **Buffett on the fortress balance sheet** — the Buffett series has authority pull.
7. **From bean-counting to bots** — the CFO/AI transition thesis.
8. **10 commandments of an experienced CFO** — list format, high save/share rate.

After that, each new essay becomes an edition ~a week after it goes live, and
you keep dipping into the back catalogue to fill the gaps.

---

## Measurement

Track weekly (add to the six-number dashboard in docs/plans/DISTRIBUTION-Plan.md §5):
- Newsletter subscriber count (grows with every edition's re-invite).
- Per-edition views + the UTM-tagged clicks landing on the site.

The newsletter subscriber number is a *guaranteed-reach* asset, like the email
list — it's the number that compounds. Watch it more than edition views.
