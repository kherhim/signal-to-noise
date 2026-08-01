# Distribution Plan — signal-to-noise.co

*Drafted 2026-08-01. Companion to [`SEO-Plan.md`](./SEO-Plan.md). That doc covers how people find the site through search; this one covers how they find it through Substack and LinkedIn. Phases are independent — pick à la carte.*

---

## The question this answers

> "How do I get my articles to go viral on Substack and LinkedIn, and exponentially increase visitors to the canonical site?"

Two honest corrections up front, because they change the plan:

**1. Virality and exponential growth are different mechanisms.** A viral post is a lottery ticket — it escapes its niche, brings a spike of visitors who mostly don't come back, and can't be repeated on demand. Exponential growth is a machine: subscribers → every new piece launches to a guaranteed audience → early engagement velocity → algorithmic amplification → more subscribers. That's a compounding loop, and it's what "exponential" actually looks like in a niche as narrow as CFO/finance leadership. §4 below still covers the breakout craft, because it's real and worth having — but it's Phase 4, not Phase 1.

**2. LinkedIn is no longer a traffic channel.** As of 2026 the feed applies roughly a 60% reach penalty to posts containing outbound links, and the old link-in-first-comment workaround has been largely patched — the algorithm now detects "bridge" posts designed to funnel readers into a comment. Fighting this costs more than it returns. LinkedIn's job in this funnel is **audience acquisition**; the LinkedIn *newsletter* and Substack are what actually deliver clicks to the canonical site.

So the funnel this plan builds:

```
LinkedIn feed posts  ──► followers
                             │
                             ▼
LinkedIn newsletter ──┐
Substack (email+app) ─┼──► clicks to signal-to-noise.co
Google / GSC ─────────┘
```

---

## Diagnosis — what the current setup is doing

The release routine in [`README.md`](./README.md) ("Release routine") is SEO-correct and distribution-hostile at almost every step. Specifics:

| # | What's happening now | Cost |
|---|---|---|
| D1 | **Substack gets a condensed summary**, body preserved as one paragraph per H2, ending in "Read the full piece at signal-to-noise.co →" (`_sources/substack-hooks/<slug>.md`) | Substack's entire discovery engine — Notes, restacks, Recommendations — keys on on-platform read-through and restacks. A teaser that sends people away scores near-zero on all of them. You're paying Substack's costs and collecting none of the network benefit. |
| D2 | **LinkedIn gets exactly one link post per article**, posted manually, opening with "I've just published…" | Two penalties stacked: the ~60% outbound-link tax, and a publish-announcement framing that gives a reader no reason to stop scrolling. One post per article also caps you at ~4 posts/month. |
| D3 | **No LinkedIn newsletter**, despite a long Pulse history (every article's `sourceUrl` is a `/pulse/` URL) | The only push channel LinkedIn gives you is unused. See §3.1 — this is the single biggest unexploited lever you have. |
| D4 | **57 articles, 49,240 words, each published exactly once** | The corpus is being used at roughly 5–10% of capacity. See §2 for the arithmetic. |
| D5 | **Tags don't differentiate.** `cfo` is on 43 of 57 articles (75%), `strategy` 40, `leadership` 39, `teams` 38, `risk` 32 — then a cliff to `capital-markets` 4, `buffett` 3, and five tags with one article each | A tag on three-quarters of the corpus is a label, not a topic. This weakens `SEO-Plan.md` §2.4 pillar pages and makes the related-insights footer close to random. |
| D6 | **Lumpy cadence** — 2026 runs May 2, Jun 3, Jul 4; earlier years have multi-month gaps | Both platforms reward regularity. Substack open rates decay with irregular sends; the LinkedIn feed rewards consistent presence over bursts. |
| D7 | **No UTM tagging** on outbound links | Cloudflare Web Analytics shows *referrer*, not *which post*. You can't tell a good LinkedIn post from a bad one, so you can't iterate. |

**Not a problem:** article length. The corpus averages 864 words — comfortably under the point where Substack emails get truncated, and close to ideal for on-platform read-through. The writing quality and voice aren't the bottleneck either. The bottleneck is that each piece is published once, into a teaser-shaped Substack and a reach-taxed LinkedIn post.

---

## Phase 1 — Stop the leak

*Changes to the existing release routine. No new work per article; different work.*

| # | What | Where | Effort |
|---|---|---|---|
| 1.1 | **Publish full text to Substack, not a summary.** Keep an italic first line — `*Originally published at [signal-to-noise.co](canonical URL)*` — then the whole essay. Retire the condensation step for new posts | `_sources/substack-hooks/` convention; `README.md` §2 | S (per post: less work than today) |
| 1.2 | **Delay the Substack send by 24–48h** after the site version goes live, so Google indexes the canonical first | `README.md` release order | S |
| 1.3 | **Probe the Substack draft API for a canonical field.** `scripts/substack-post.mjs:227` posts `draft_title` / `draft_subtitle` / `type: 'newsletter'`. The same endpoint is known to accept `search_engine_title` and `search_engine_description`; whether it takes a canonical URL is worth one probe call. If it does, wire it in and 1.2 becomes optional | `scripts/substack-post.mjs` | S |
| 1.4 | **Rewrite the LinkedIn post format.** Drop "I've just published…". Post the argument *natively* — 150–250 words that stand alone and are worth reading with no click. No link in the body. End with a plain-language pointer ("The full version, with the chart, is on my site — link on my profile") | Manual, per post | S |
| 1.5 | **Reply to every LinkedIn comment inside 90 minutes.** Comment velocity in the first hour is the strongest single reach input | Manual | S, recurring |
| 1.6 | **UTM-tag every off-site link**: `?utm_source=linkedin&utm_medium=newsletter&utm_campaign=<slug>`. Astro serves static HTML so query strings pass through untouched | All channels | S |
| 1.7 | **Restack your own Substack post** the day it goes out, then again 2–3 days later as a Note with a pulled quote | Manual | S |

**Prediction**: 1.1 + 1.4 alone should move Substack read-through and LinkedIn per-post reach within two or three posts. Neither costs extra writing time — 1.1 is strictly *less* work than writing a condensed version.

**The SEO risk in 1.1, stated plainly**: `substack.com` carries far more domain authority than `signal-to-noise.co`, so a full-text duplicate *can* outrank the canonical. 1.2 and 1.3 are the mitigations, and they're most of the way to sufficient — Google strongly prefers the version it indexed first. The site version also keeps what Substack's copy won't have: cover images, tables, series navigation, and the related-insights footer. Judgement call, and the reach gain is worth the residual risk.

---

## Phase 2 — Multiply surface area

*This is where the compounding actually comes from. No new writing required.*

One article currently produces one site post, one Substack teaser, one LinkedIn post. It can produce ten to twelve assets:

| Asset | Channel | Timing |
|---|---|---|
| Canonical post | Site | Day 0 |
| Full-text post + email | Substack | Day 2 |
| Native post — the core thesis | LinkedIn | Day 0 |
| Native post — the counter-intuitive middle section | LinkedIn | Day +5 |
| Native post — the practical checklist / takeaway | LinkedIn | Day +12 |
| Document carousel (PDF, 6–10 slides) | LinkedIn | Day +8 |
| 4–6 Notes (pull-quotes, one reaction, one question) | Substack | Days 0–14 |
| Newsletter edition | LinkedIn | Day +7 |
| Back-catalog resurface | Both | +6 months |

**The arithmetic that matters:** 57 existing articles × ~10 assets ≈ 570 posts. At five posts a week that's over two years of daily presence *without writing a single new essay*. You are not short of content. You are short of distribution surface.

| # | What | Where | Effort |
|---|---|---|---|
| 2.1 | **`scripts/repurpose.mjs <slug>`** — reads the article, emits `_sources/social/<slug>.md` scaffolded with: extracted H2 sections, three candidate pull-quotes, pre-built UTM links, and empty slots for the three LinkedIn posts and the Notes. Turns repurposing from a blank page into an editing task | `scripts/` (new) | M |
| 2.2 | **Back-catalog queue** — rank the 57 existing articles by evergreen value, work through them at 2–3/week alongside new pieces | `_sources/social/queue.md` (new) | M once, then S |
| 2.3 | **Fix the tag taxonomy** (D5). Demote `cfo`/`strategy`/`leadership`/`teams` from tags to what they are — the site's subject matter — and tag on what actually distinguishes pieces: `capital-allocation`, `ai-adoption`, `forecasting`, `board-dynamics`, `storytelling`, `incentives`. This is `SEO-Plan.md` §2.5, and it's now load-bearing for the pillar pages | `scripts/normalize-tags.mjs` (new) + manual pass | M |
| 2.4 | **Fixed cadence** — pick one and hold it. Recommended: one essay every two weeks, LinkedIn 5×/week, Notes daily-ish, newsletter fortnightly | Calendar | S to decide, L to sustain |

---

## Phase 3 — Build the compounding surfaces

*The highest-leverage items in this document. 3.1 first.*

### 3.1 LinkedIn newsletter — do this one first

A LinkedIn newsletter is the only mechanism on the platform that bypasses feed ranking. Each edition fires **three notifications** to every subscriber — email, mobile push, and in-app alert. Reported open rates run 40–50%, against 8–12% of followers for a typical feed post. Critically for your goal: **links inside a newsletter edition are not downranked the way links in feed posts are**, and editions are indexed by Google. It is simultaneously the one LinkedIn surface that will send readers to your site and the one that keeps working months later.

Setup: Create it from your profile (Create → Newsletter). Name it *Signal to Noise* for brand continuity. Every existing follower gets a one-time subscribe prompt at launch — which is why launching it with a real backlog behind you matters. Publish each essay as an edition roughly a week after the site version, with a clear canonical link.

Note the ordering interaction: site (day 0) → Substack (day 2) → LinkedIn newsletter (day 7). Canonical indexes first, then the two duplicate-ish surfaces, spaced out.

### 3.2 Substack Notes — the actual growth engine

Since Substack's late-2025 change, the Notes feed shows readers mostly creators they *don't* follow, which is exactly why a small publication can break out there. Restacks are now the primary distribution signal. Reporting through 2026 puts Notes at the majority of new-subscriber acquisition for publications under ~10k subscribers.

The habit, concretely: one note a day. Mix — a pull-quote from your own work (~2/week), a reaction to another finance/AI writer's post (~2/week), a standalone observation that doesn't link anywhere (~3/week). Restack others in your niche deliberately: when you restack someone with an overlapping audience, the algorithm starts showing your work to their subscribers.

### 3.3 Substack Recommendations

The reciprocal-recommendation network is the second engine. Recommend 8–10 adjacent publications — finance leadership, AI-for-business, operator newsletters. Reciprocity follows genuine participation, not cold asks, so 3.2 is a prerequisite. Expect a 2–3 month lag before this shows up in the numbers.

### 3.4 Cross-posts and guest swaps

One adjacent writer per quarter. A guest post or a swap is worth more than any amount of feed optimisation, and it's the same item as `SEO-Plan.md` §4.5 — one link from a high-authority source.

---

## Phase 4 — The breakout craft

*What actually makes an individual piece travel. Real, but unreliable — treat as upside on top of Phases 1–3, not a substitute for them.*

**The first line does most of the work.** Your best openers already do this. From the 600-year curve piece: *"I want you to look at the graph for a second. Really look at it. Look hard."* That's a hook — an instruction, a promise, and a reason to stay. Compare it against the openers of the LinkedIn-imported pieces, which are hit-and-miss; `SEO-Plan.md` §3.4 already flags this.

**Four formats that break out in this niche:**

1. **Contrarian take on received wisdom.** You already have these — *"The 2nd most expensive decision: let's wait"*, *"When KPIs become strategy dies"*. These travel because a reader disagrees loudly in the comments, and disagreement is engagement.
2. **A number nobody has computed.** Original arithmetic on a question people argue about qualitatively.
3. **A named framework.** This is the highest-leverage single change to how you write. A piece that *names* a thing gets cited and re-shared; a piece that merely describes it doesn't. "The 600-year curve" is a name. "Bayesian thinking for CFOs" is a topic. The first can be quoted by someone else; the second can't.
4. **An insider admission.** "Here's what I got wrong" outperforms "here's what I know" in every B2B feed, because it's the thing your peers can't say.

**News-pegging the back catalogue.** *"Pricing the future: SpaceX, Anthropic and OpenAI IPOs"* and the AI pieces are re-postable every time the news cycle hands you a peg. A 2026 essay re-surfaced against a live event gets a multiple of its original reach. This is the highest-return item in Phase 2's back-catalog queue.

**Breakout candidates already in the corpus** — the pieces with reach beyond finance: *The 600-year curve* (AI anxiety is a universal topic), *When cognition becomes metered*, *The 2nd most expensive decision*, *Pricing the future* (news-pegged, high search intent), *When KPIs become strategy dies*.

---

## Phase 5 — Measurement

You can't run any of the above as a loop without this. `SEO-Plan.md` §4.1–4.3 covers GSC and analytics setup; this adds the distribution layer.

**Weekly, five minutes:** Substack subscribers · LinkedIn followers · LinkedIn newsletter subscribers · site sessions · sessions by referrer · GSC impressions and clicks.

**The only number that matters: net new subscribers per published piece.** Reach, impressions and likes are vanity — they don't compound. Subscribers do, because they're the guaranteed audience the next piece launches into, and that launch velocity is what the algorithms read.

**Honest expectations.** Consistent LinkedIn posting plus an active newsletter typically compounds follower growth in the mid-to-high single digits per month for a niche B2B voice. Substack Notes and Recommendations, once genuinely running, tend to become the majority of new subscribers. Site traffic follows subscriber growth with a lag of a month or two — it will not move first, and if you judge Phase 1 on week-one site sessions you'll conclude wrongly that it failed.

---

## Suggested order

1. **Phase 3.1** — LinkedIn newsletter. Highest leverage, one-time setup, and it's the only LinkedIn surface that will send traffic to the site.
2. **Phase 1 — 1.1, 1.2, 1.4, 1.6** — full-text Substack, 48h delay, native LinkedIn posts, UTM tags. No new writing; strictly different writing.
3. **Phase 5** — the weekly six numbers. Before Phase 2, so Phase 2 has a feedback loop.
4. **Phase 3.2** — the daily Notes habit. This is the one that needs sustaining, and the one that pays the most on Substack.
5. **Phase 2 — 2.1, 2.2** — the repurposing engine and the back-catalog queue.
6. **Phase 2.3** — tag taxonomy, which unblocks `SEO-Plan.md` §2.4 pillar pages.
7. **Phase 4** — apply to new writing as you go. Not a project.

---

## Honest read

The writing isn't the problem. 57 pieces, a distinct voice, and a real point of view are the hard part, and that part is done. The problem is that each piece is published once, into a Substack that only sees a teaser and a LinkedIn post that pays a 60% link tax.

**If you only do three things:** LinkedIn newsletter (3.1), full-text Substack (1.1), native LinkedIn posts with no body link (1.4).

**Time cost, stated honestly.** Phases 1–3 sustained is roughly 30–45 minutes a day, most of it Notes and comment replies. That's the real constraint — not ideas, not tooling. If 45 minutes a day isn't available, do 3.1 and 1.1 and skip the rest; they're the two that work without a daily habit attached.

**On the word "exponential."** Compounding at 8% a month is a doubling every nine months and a 2.5× in a year. That's unglamorous next to a viral spike and it's worth vastly more, because it doesn't decay on Monday.

---

## Sources

Platform mechanics in this document were checked against current (2026) reporting rather than recalled from general knowledge. Confidence varies by source — LinkedIn's own help pages are authoritative; the marketing-blog figures (the "60%" reach penalty, specific open-rate ranges) are directional and worth treating as such.

- [The LinkedIn link penalty cutting your reach by 60% — Forbes, July 2026](https://www.forbes.com/sites/jodiecook/2026/07/30/the-linkedin-link-penalty-cutting-your-reach-by-60/)
- [5 LinkedIn content moves LinkedIn started punishing in 2026 — Forbes](https://www.forbes.com/sites/jodiecook/2026/07/23/5-linkedin-content-moves-linkedin-started-punishing-in-2026/)
- [Newsletters on LinkedIn FAQ — LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a517914)
- [Which LinkedIn format bypasses the feed algorithm? — SocialNexis](https://socialnexis.com/guides/linkedin-newsletter-vs-article-algorithm)
- [LinkedIn newsletter growth: how to get more subscribers in 2026](https://linkedinpreview.com/blog/linkedin-newsletter-growth-2026)
- [The complete guide to Substack Notes in 2026 — Sarah Fay](https://www.substackwritersatwork.com/p/the-complete-guide-to-substack-notes-2026)
- [The Notes algorithm explained (by its actual creator) — Pubstack Success](https://pubstacksuccess.substack.com/p/the-notes-algorithm-explained-by)
- [I finally figured out how Substack's algorithm actually works (it's all about restacks)](https://escapethecubicle.substack.com/p/i-finally-figured-out-how-substacks)
- [Substack in 2026: what's changed, what's working, and what's not — Niusleters](https://niusleters.com/en/blog/substack-2026-whats-changed-whats-working-and-whats-not)
- [The Substack phenomenon: a creator's guide (2017–2026) — Pettauer](https://pettauer.net/en/substack-phenomenon-creators-guide-2026/)

---

## When ready

Tell me one of:

- **"Set up the LinkedIn newsletter"** — I write the launch checklist and draft the first edition from an existing essay; you click through it.
- **"Switch Substack to full text"** — I probe the draft API for a canonical field, update `scripts/substack-post.mjs` and the README release routine, and convert the next post.
- **"Build the repurpose script"** — I ship `scripts/repurpose.mjs` (item 2.1).
- **"Do the tag taxonomy"** — I ship `scripts/normalize-tags.mjs` and a proposed mapping for review (item 2.3).
- **"Draft the back-catalog queue"** — I rank all 57 articles by evergreen and news-peggable value (item 2.2).
