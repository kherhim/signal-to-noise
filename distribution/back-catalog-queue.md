# Back-catalogue repurposing queue

57 articles, each published exactly once. At ~10 social assets per article that's
~570 posts — over two years of daily presence without writing anything new. This
ranks the corpus so you work the high-value pieces first instead of chronologically.

**How to use:** work 2–3 pieces a week. **20 articles already have finished,
hand-crafted packs** in `distribution/ready-to-post/` (listed below with ✓) —
start there. For the rest, run `node scripts/repurpose.mjs <slug>` to scaffold,
then edit.

**Packs already written (✓):** 600-year-curve, when-cognition-becomes-metered,
pricing-the-future-ipos, leadership-lessons-shorts (lessons 2 & 5),
leadership-lessons-series (lessons 1,3,4,6–10), future-gpt,
using-llms-cheat-sheet-cfos, from-bean-counting-bots, leadership-era-genai,
10-commandments-experienced-cfo, 10-commandments-newbie-cfo,
10-commandments-fpa-storytelling (both parts), bayesian-thinking-for-cfos,
future-finance-talent-stack, buffett-on-the-fortress-balance-sheet,
buffett-on-capital-allocation, every-cfo-greedy, when-culture-eats-your-strategy,
how-cfos-should-think-ma, what-keeps-fintech-cfo-up-night. That's roughly three
months of material. The remaining ~35 articles (Tier 4 below) use `repurpose.mjs`
as you get to them.

Ranking axes: **B** = breakout potential (travels beyond finance), **E** =
evergreen (no expiry), **N** = news-peggable (re-postable on a news hook),
**L** = list/framework format (high save + share rate).

---

## Tier 1 — do first (breakout + news-peggable)

These have the widest reach and the most re-post occasions. The starred ones
have finished packs already.

| Slug | Title | Why | Axes |
|---|---|---|---|
| ★ `600-year-curve-...` | The 600-year curve | Universal AI-anxiety topic, genuine named idea | B E N |
| ★ `when-cognition-becomes-metered` | When cognition becomes metered | The £0.40 NDA hook; balance-sheet reframe | B E N |
| ★ `pricing-the-future-...ipos` | Pricing the future: SpaceX/Anthropic/OpenAI IPOs | Highest search intent; re-post on every IPO move | N E |
| ★ `5-when-kpis-become-strategy-dies` | When KPIs become the strategy | Four-line list, built to provoke comments | B L E |
| ★ `2-most-expensive-decision-lets-wait` | The most expensive decision? "let's wait" | Short, contrarian, high comment velocity | B E |
| `future-gpt` | Future of GPT | AI topic, news-peggable on model releases | B N |
| `using-llms-cheat-sheet-cfos` | Using LLMs: a cheat sheet for CFOs | Practical + AI; save-and-share format | B L N |
| `from-bean-counting-bots` | From bean counting to bots | Tight CFO/AI transition thesis | B E |
| `leadership-era-genai` | Leadership in an era of GenAI | AI + leadership; broad appeal | B N |

## Tier 2 — strong evergreen + list formats

High save/share rates; no expiry; reliable engagement.

| Slug | Title | Axes |
|---|---|---|
| `10-commandments-experienced-cfo` | 10 commandments for the experienced CFO | L E |
| `10-commandments-newbie-cfo` | The 10 commandments for a newbie CFO | L E |
| `10-commandments-fpa-storytelling` | The 10 commandments of FP&A storytelling | L E |
| `10-commandments-fpa-storytelling-part-2` | …part 2 | L E |
| `buffett-on-capital-allocation` | Buffett on capital allocation | E (Buffett = authority pull) |
| `buffett-on-the-fortress-balance-sheet` | Buffett on the fortress balance sheet | E |
| `ask-warren-buyback-multiple` | Ask Warren: buy back at this multiple? | E N |
| `bayesian-thinking-for-cfos` | Bayesian thinking for CFOs | B E |
| `future-finance-talent-stack` | The future finance talent stack | B E |
| `every-cfo-greedy-...` | Every CFO is greedy… | B E (provocative title) |
| `output-vs-outcome` | Output vs. outcome | E L (short, clean) |
| `having-view-vs-way` | Having a view vs having a way | E (aphoristic, quotable) |

## Tier 3 — the Leadership Lessons series (run as a unit)

Ten short, punchy children + a parent. Each is almost post-shaped already.
Perfect as a recurring LinkedIn newsletter run — one lesson per edition — and a
steady stream of Notes. Don't flat-list them; keep the series framing.

| Slug | Lesson |
|---|---|
| `1-leadership-sum-your-trade-offs` | Leadership is the sum of your trade-offs |
| ★ `2-most-expensive-decision-lets-wait` | The most expensive decision? "let's wait" (in Tier 1) |
| `3-culture-incentives-posters` | Culture is incentives, not posters |
| `4-cross-functional-trust-superpower` | Cross-functional trust is a superpower |
| ★ `5-when-kpis-become-strategy-dies` | When KPIs become the strategy (in Tier 1) |
| `6-great-leaders-explain-constraints-just` | Great leaders explain constraints |
| `7-crisis-reveals-people-clearly` | Crisis reveals people clearly |
| `8-biases-sitting-every-boardroom` | The biases sitting in every boardroom |
| `9-resilience-optionality-toughness` | Resilience is optionality, not toughness |
| `10-scaling-stopping-adding` | Scaling is about stopping, not adding |

## Tier 4 — evergreen essays (steady rotation)

Reliable, on-brand, longer-form. Rotate through as filler between new pieces and
Tier 1–2 resurfaces. Grouped loosely by theme so you can batch a themed run.

**Strategy & decision-making:** `should-cfos-build-strategic-flexibility-...`,
`how-plan-best-prep-rest-...`, `winning-chaos`, `checkmate-boardroom-ballet-...`,
`high-wire-acts-high-finance-...`, `how-cfos-should-think-ma-...`,
`crowdsourcing-financial-decisions-...`

**Storytelling & FP&A:** `once-upon-balance-sheet-...`,
`enhancing-financial-data-storytelling-...`, `evolving-financial-analytics-...`,
`power-precision-focus-success`

**Teams, trust & leadership:** `trust-bridging-gap`, `symphony-success-...`,
`mastering-matrix-...`, `oh-captainmy-captain`, `output-outcome-systems-approach-...`

**Reflective / human:** `shadows-light-dance-self-doubt-self-confidence`,
`you-dont-sacrifice-what-want-becomes`, `time-ticks-...father`,
`freud-finance-folly-...`, `reflecting-year-insights-final-thoughts-2024`

**Niche/finance-craft:** `what-keeps-fintech-cfo-up-night-...`,
`importance-treasurers-finance`, `cashing-cheers-...sports-sponsorships-...`,
`bottomline-customer-happiness-...`, `when-culture-eats-your-strategy`

---

## Suggested first month (no new writing)

| Week | LinkedIn native posts | Newsletter edition | Notes theme |
|---|---|---|---|
| 1 | 600-year curve (×3 posts, spaced) | **Launch: 600-year curve** | AI / printing-press |
| 2 | When cognition becomes metered (×3) | — | The £0.40 NDA |
| 3 | KPIs (×2) + "let's wait" (×2) | When cognition becomes metered | Leadership contrarian |
| 4 | Pricing the future (×2) + news pegs | Pricing the future | IPO framing |

That's a full month of near-daily presence, a launched newsletter with three
editions banked, and ~15 Notes — drawn entirely from four existing essays.
