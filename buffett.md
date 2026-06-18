# Buffett series — article ideas and rollout state

> **Living document.** Append, edit, prune. Started 2026-06-10 after surveying the 86-letter corpus in `_sources/buffett-letters/`. Every entry should be defensible at the "no stupid ideas" filter.

The series uses the letters as **source material for original CFO-perspective writing**, never as the content itself. No chatbot. No quote-of-the-day. No mirror of the letters. Excerpt + cite + your own argument.

Plan that anchors all of this: `/Users/himanshu.kher/.claude/plans/i-have-all-of-piped-puddle.md`. Conventions: `article-formatting.md`.

---

## Current state

| Track | Piece | Status |
|---|---|---|
| Track 2 | M&A article enriched with 1981 toads/princesses quote | **Shipped** 2026-06-10 (commit `ed24e8d`) |
| Track 1 | Buffett on capital allocation | **SHIPPED (site) 2026-06-18** — published ~7h early at 05:53 UTC by triggering the staged `s2n-swap@jun18.service` manually (user asked to publish now). Live at `/insights/buffett-on-capital-allocation/`. Substack/LinkedIn still on user's native scheduler. |
| Track 1 | Buffett on the fortress balance sheet | **DRAFTED — staged 2026-06-18, unscheduled** (2008/2010/2014; quotes verbatim-checked) |
| Track 3 | Ask Warren: Should we buy back stock at this multiple? | **SCHEDULED — auto-launch Thu 2026-06-25 14:00 BST** |

Track 1 is now live on the site (early manual trigger of the pre-staged jun18 build — same content the timer would have applied; the jun18 timer re-firing at 12:50 UTC is idempotent and harmless). Track 3 still deploys itself via the VM systemd one-shot timer (12:50 UTC Jun 25) — see memory `project-buffett-scheduled-launch`. Substack drafts (201528936, 201528938) + LinkedIn blurbs are scheduled by the user in those platforms' native schedulers. ⚠️ Do not deploy other content to prod before Jun 25 or the staged Jun 25 swap will clobber it.

**Series-block reminder:** Once Track 1 has a second piece, wire `series: { id: "buffett-on", name: "Buffett on…" }` into both parent and child. Same for `series: { id: "ask-warren", name: "Ask Warren" }` once Track 3 has its second column. The renderer says "A 0-part series" if a parent has no children, which is why this was deliberately deferred.

---

## Track 1 — "Buffett on…" essays

Long-form (~1,300–1,800 words). Three letter excerpts anchor each piece. Original CFO-lens synthesis.

### Drafted / shipped
- **Buffett on capital allocation** (1984 one-dollar test, 1987 accidental allocator, 2014 five paths) — **shipped to site 2026-06-18**
- **Buffett on the fortress balance sheet** (2008 Gibraltar position / "kindness of strangers" pledge, 2010 leverage "evaporates when multiplied by a single zero", 2014 cash-as-oxygen / $15.6B deployed in the crisis) — **drafted & staged 2026-06-18** in `_sources/staging-articles/buffett-on-the-fortress-balance-sheet.md` (~1,430 words; all blockquotes verified verbatim against the local letters). Open before release: cover image (`/img/buffett-on-the-fortress-balance-sheet.webp`), real publish date (frontmatter placeholder `2026-07-02`), **series wiring** (this is Track 1's 2nd essay → add `series: { id: "buffett-on", name: "Buffett on…" }` to BOTH this and capital-allocation), schedule across site/Substack/LinkedIn.

### Queued ideas
- **Buffett on M&A discipline** — 1981 (toads/princesses), 1995 (deal-junkie warning), 2014 (price defeats the business)
- **Buffett on owner earnings vs. GAAP** — 1986 (original owner-earnings definition), 2000 (when GAAP started routinely overstating). *2026 hook:* AI-era "adjusted" metrics are the new pretend earnings.
- **Buffett on the float** — 1967 (first articulation), 1982 (underwriting cycle), 2009 (full cost-of-capital frame). *2026 hook:* every CFO running working capital or deferred revenue is operating a tiny insurance company without realising it.
- **Buffett on stock-based comp** — 1998, 2003. *2026 hook:* SBC is structurally under-disclosed again in tech/AI; Buffett's original argument lands word-for-word.
- **Buffett on succession** — 2005 (governance era), 2014 ("after me" passage), 2025 Abel letter, 2025 Thanksgiving handoff. *2026 hook:* most CFO succession is reactive; Buffett's published the only multi-decade case study of doing it deliberately.
- **Buffett on inflation and pricing power** — 1979 (the inflation letter), 2022 (revisit). *2026 hook:* post-2022 inflation playbook for the FP&A function.
- **Buffett on competitive moats** — 1989, 1992, 1999. *2026 hook:* the AI moat panic driving 2026 capex decisions needs a more honest test than "we think we have one."

#### Added 2026-06-18 — anchors from memory, verify verbatim against `_sources/buffett-letters/` before drafting
- **Buffett on the institutional imperative** — 1989 (the original passage: companies mindlessly imitate peers, resist changing direction, and let mediocre projects get rationalised by staff and advisers). *2026 hook:* AI-capex FOMO is the institutional imperative in modern dress — boards greenlighting spend because competitors are, not because the maths clears. Possibly the single most relevant Buffett idea for the 2026 capital cycle.
- **Buffett on economic vs. accounting goodwill** — 1983 (the "Goodwill and its Amortization" appendix, See's Candies). *2026 hook:* in an IP- and AI-heavy, asset-light economy, book value badly understates economic goodwill; how a CFO should talk about intangible earning power vs. balance-sheet carrying value.
- **Buffett on the mark-to-market world ("our bottom line will be wild")** — 2017/2018 (the new GAAP rule forcing unrealised equity gains/losses through net income; the warning that reported earnings would turn "capricious"). *2026 hook:* fair-value swings on strategic/AI equity stakes now whipsaw reported net income — teaching a board to read operating earnings past the GAAP headline. Distinct from owner-earnings-vs-GAAP: this is specifically the *volatility-of-net-income* problem.
- **Buffett on the payout decision (dividends vs. retention)** — 2012 (the detailed "Dividends" section: the sell-off argument and when to pay out), 1984 (the $1 test). *2026 hook:* capital-return policy under AI-capex pressure — returning only the cash you can't redeploy above a dollar-for-dollar return. Sharpens the capital-allocation essay onto the payout end specifically.
- **Buffett on look-through earnings** — 1990/1991 (the "look-through earnings" concept). *2026 hook:* minority and equity-method stakes in AI/fintech startups mean consolidated GAAP hides real earning power a CFO is accruing; a discipline for valuing what you don't consolidate.

---

## Track 3 — "Ask Warren" column

Shorter (~600–1,000 words). Single H2 question opener. 1–3 cited excerpts. Closing "What this means for a 2026 CFO."

### Drafted / shipped
- **Ask Warren: Should we buy back stock at this multiple?** (2011 framework, 2016 math) — staged

### Queued questions
- **How do we tell prudent cash from lazy cash?** — 1996 owner's manual, 2010 letter. For every CFO on a fortress balance sheet getting asked the question every quarter.
- **When does our hurdle rate become the wrong test?** — 1984, 1992. Direct counter to the standard FP&A "it clears WACC" answer.
- **What's the right "no" to a deal that looks accretive?** — 1981, 1995. The hardest version of the M&A discipline question.
- **Is our comp system rewarding the right things?** — 1991, 2005. Buffett's critique of ratchet-up comp design is still ahead of where most boards are.
- **How do we know if our moat is real?** — 1989, 1992, 1999.
- **Should we keep buying AI capacity that can't pay back inside the planning horizon?** — 1979 (capital intensity), 1985 (textile mill cautionary tale), 1999 (tech bubble). Most timely Ask Warren question on the board.
- **How do we read this earnings season's "adjustments"?** — 1986 (owner earnings), 2000 (GAAP gaming).

#### Added 2026-06-18 — anchors from memory, verify verbatim before drafting
- **Should we use our own stock as the acquisition currency?** — 1982 (the share-issuance principle: don't issue shares unless you receive as much intrinsic value as you give), 1993/1996 owner's manual. *2026 hook:* stock-for-stock AI M&A at rich multiples — when your shares are a cheap currency, and when handing them over means "giving away part of a wonderful business."
- **Competitors are all-in on this — should we follow?** — 1989 (institutional imperative). *2026 hook:* the AI-capex herd; the short Ask Warren companion to the institutional-imperative essay.
- **How candid should our next bad-quarter update be?** — 1983/1979 (owner-related business principles; the candor commitment — "we tell you the negatives"). *2026 hook:* IR honesty when results miss, and the long-term trust maths behind leading with the bad news.
- **How do we value a target that has no earnings yet?** — 1999 (the Sun Valley / dot-com caution), 2000. *2026 hook:* pre-revenue AI acquisitions — discounting the narrative back to a defensible owner-earnings number.

---

## Track 2 — quiet enrichment of existing articles

One short blockquote + 1–2 sentences of framing at a natural pivot. Never a "Bonus Buffett corner" — integrated into the existing argument.

### Shipped
- **`how-cfos-should-think-ma-balancing-risk-opportunity.md`** — 1981 toads/princesses, in the Risk management section (commit `ed24e8d`)

### Queue (priority order — best Buffett-idea fit first)
1. **`winning-chaos.md`** — 2008 letter ("be fearful when others are greedy" + how Berkshire actually deployed through 08).
2. **`pricing-the-future-spacex-anthropic-openai-ipos.md`** — 1999 letter (written months before the dot-com unwind, holds up uncomfortably well).
3. **`should-cfos-build-strategic-flexibility-opposed-plans.md`** — 1994 letter on forecasting humility.
4. **`high-wire-acts-high-finance-cfos-circus-growth-vs-cash.md`** — 1985 letter on operating cash flow priorities.
5. **`mastering-matrix-how-curiosity-grit-shape-winning-teams.md`** — multiple letters on what makes great managers (1996 owner's manual is a good starting point).

---

## Format experiments to consider

- **"Buffett wrote this in 19XX" micro-series** — 300–500 words, one quote, punchy CFO takeaway. Weekly cadence, low lift, fastest way to populate the `buffett` tag index. **Risk:** dilutes signal if the quotes aren't carefully picked. Worth one pilot before committing.
- **Companion "what mattered in this letter" series** — one letter per piece (e.g. "what to take from the 1985 letter in 2026"). Higher lift than the micros, lower than the Track 1 essays. Useful if the queue thins and you want a structured way to keep producing.
- **"Buffett vs. Munger"** — where the two diverge in the letters (tech, patient capital, valuation philosophy) and how a CFO should read those tensions. Rich material; probably one strong piece, not a series.
- **A "capital allocation" pillar page** — add to `src/lib/topics.ts` once Track 1 has 3–4 essays. Premature until then.

---

## Stupid ideas to keep filtered out

These have come up and should stay out unless reframed:

- Chatbot / RAG widget over the letters. Don't dilute the editorial voice.
- Quote-of-the-day surface. Gimmicky, low signal.
- A mirror of all 86 letters on the site. Excerpt + cite, always.
- LLM-generated "what would Buffett say" with no editorial layer. Cringe by default.
- A "Buffett tag" without earned articles behind it. The tag index has to be worth landing on.

---

## Useful corpus notes

- **Coverage:** 1959–1969 partnership letters (multiple per year), 1970–2024 Berkshire annuals, 2025 Abel + Thanksgiving Buffett.
- **File naming:** `YYYY_berkshire.md` for annuals; `YYYY-MM-DD_partnership.md` for partnership era; `2025_abel.md` and `2025_thanksgiving_buffett.md` for the recent succession material.
- **Canonical URL pattern for citations:**
  - 1977–1997: `https://www.berkshirehathaway.com/letters/YYYY.html`
  - 1998+: `https://www.berkshirehathaway.com/letters/YYYYltr.pdf`
- **Citation format used in the series:**
  ```markdown
  > [excerpt]
  >
  > — Buffett, [YYYY letter](URL)
  ```
- **Tag everything `buffett`** so the auto-generated `/insights/tag/buffett/` index becomes the natural home for the work.
