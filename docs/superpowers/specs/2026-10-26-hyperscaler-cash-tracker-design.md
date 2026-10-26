# Hyperscaler cash tracker (roadmap S2): design

Status: mockup approved by the owner 26 Oct 2026. Design awaiting approval. Nothing built.

## Intent

A second living tracker beside the AI token price index. It shows how much the five largest builders of AI data centres spend on them, how much cash their businesses generate, and how the gap is paid for (buybacks cut, debt raised). It is the evidence base for the essay "The cash machines are borrowing" (publishing Wed 28 Oct) and the follow-up topic T2 "What the cash machines told us".

Readers: CFOs, CEOs and investors who want the numbers behind the argument, refreshed each earnings season.

## Goals

- A page at `/trackers/hyperscaler-cash`, titled **Hyperscaler cash tracker** (eyebrow "Tracker", H1 "Hyperscaler cash"), matching the approved mockup (`scratchpad/wireframes/hyperscaler-cash.html`, template `hyperscaler-template.html`).
- Five companies, in this order: Microsoft, Alphabet, Amazon, Meta, Oracle. CoreWeave is out.
- Eight quarters per company, from SEC filings (10-Q/10-K XBRL).
- Contents, top to bottom:
  1. Four tiles: capex as a share of operating cash flow (last four quarters, all five); companies with negative free cash flow in their latest quarter (n of 5, named); companies still buying back shares (n of 5, named); long-term debt added in a year (+$bn, to $bn).
  2. Small multiples, one per company, same y scale: operating cash flow (blue `#3F86D0`) and capital spending (amber `#C0822A`), gap shaded where spending exceeds cash flow; hover per quarter; "View the data" table.
  3. Two bar charts: combined buybacks per quarter, combined long-term debt per quarter, using only quarters all five have reported.
  4. "What they plan to spend in 2026": one line per company, hand-written.
  5. "What to watch each quarter": four bullets from the mockup.
  6. Link to the essay, shown only once it is published (not a draft).
  7. Method and sources.
- A `/trackers` index page listing both trackers (name, one-line description, one headline number each, link). The nav label changes from "Tracker" to **Trackers** and points to `/trackers`.
- Copy passes the full pre-publish gate (plagiarism, BrE, Layer A, Layer B) before merge, frontmatter and every visible string included.

## Non-goals

- No automated data refresh in this build. The owner (with me) refreshes the JSON after each earnings season through a PR. An automated EDGAR job is a later roadmap item.
- No homepage change here (that is S7). The S7 tracker strip will read this tracker's data later.
- No stock prices, valuations or forecasts of our own.

## Anti-goals

- Any figure on the page that cannot be traced to a filing or a named company release/call.
- A mock banner, "draft" marker or placeholder left on the live page.
- Mentioning AI authorship anywhere.

## Data

- File: `src/data/hyperscalers/quarters.json`, copied from the scratchpad `hyperscalers.json` (shape: `as_of`, `units`, `companies[] {name, ticker, cik, quarters[], capex_guidance, ...}`, `notes`). Each quarter carries `q` (calendar quarter label), `period_end`, `ocf`, `capex`, `buybacks`, `debt` (non-current long-term debt), `fcf`, optional `fcf_company_def`, optional `fiscal_q`, `sources[]`.
- **Free cash flow is each company's own definition** where it differs. Amazon: operating cash flow less purchases of property and equipment net of proceeds from sales and incentives (its headline free cash flow; finance-lease principal is stored but not deducted). Meta: deducts finance-lease payments. Oracle: gross (operating cash flow less capital expenditure). The method note must say exactly this; the mockup's Amazon wording was wrong. Displayed capital spending = operating cash flow minus that free cash flow, so each chart's gap matches what the company reports. Meta's latest quarter therefore shows −$2.1bn, as in the essay.
- Quarters are placed on a shared calendar-quarter axis; Microsoft (June year end) and Oracle (May year end) show their fiscal quarter in labels and tooltips.
- **Q3 timing.** Microsoft, Alphabet and Amazon report Q3 2026 on 28–29 Oct. The page can ship before then; their Q3 numbers go in PR 4 (below). *(My call.)*
- **Window:** the page shows each company's latest eight quarters; adding a quarter drops that company's oldest. Histories may end on different quarters; the combined bar charts use only quarters all five have reported. *(My call.)*
- **Tests** run against a frozen fixture copy of today's data (where the tiles are 85%, 4 of 5, 1 of 5, +$231bn to $457bn), so data refreshes never break them. *(My call.)*
- **Extraction:** the EDGAR pull scripts move from the scratchpad into `scripts/trackers/hyperscalers/` in PR 1, so each refresh is repeatable. *(My call.)*
- **Spending plans** are hand-written in the page (or a small `guidance` field per company) with a source each. The figures for Microsoft, Alphabet, Amazon and Oracle came from reports of earnings calls; they must be checked against the transcripts or releases before the page ships, and the source recorded. *(My call, open to the owner:)* a line that cannot be confirmed from the company's own release, call transcript or filing is left out until it can be; the section never cites press reports.

## How it is built (decided)

- Astro page `src/pages/trackers/hyperscaler-cash.astro`, using `BaseLayout` with `starsDim`, following `ai-token-prices.astro`: all numbers and SVG computed at build time in frontmatter, no client chart library. The only client script is the shared tooltip pattern from the token page.
- Pure calculation functions (quarter index, FCF choice, tiles, common quarters, combined series) in `src/lib/hyperscalers.ts` (or `.mjs`), unit-tested with `node --test` under `npm run test:trackers`.
- Palette reuses the token tracker's validated blue and amber; text in text tokens, never series colours.
- `/trackers/index.astro` reads both trackers' data at build time for its headline numbers.

## Delivery: four PRs

1. Data + calculation module + tests.
2. Tracker page (copy gated).
3. `/trackers` index + nav "Trackers" (copy gated). Then deploy and verify live (HTTP 200, nav, title, no draft essay in dist).
4. After 29 Oct: Q3 2026 data for Microsoft, Alphabet and Amazon (window rolls to latest eight), redeploy.

## Left to the builder

- Exact file split of the calculation module; test cases beyond the tile values matching the mockup (85%, 4 of 5, 1 of 5, +$231bn to $457bn on the current data).
- Mobile tweaks to the small-multiples grid.
- Wording of the `/trackers` index blurbs (gated like all copy).
