# Hyperscaler Cash Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/trackers/hyperscaler-cash` (the approved mockup, built at compile time) and a `/trackers` index, with nav "Trackers".

**Architecture:** Data in `src/data/hyperscalers/quarters.json`. Pure calculations in `src/lib/hyperscalers.mjs` (plain ESM so `node --test` can import it; Astro imports it too). The page computes every number and SVG in frontmatter, like `src/pages/trackers/ai-token-prices.astro`; the only client script is the shared tooltip.

**Tech Stack:** Astro 5, Tailwind, node:test.

**Spec:** `docs/superpowers/specs/2026-10-26-hyperscaler-cash-tracker-design.md`

## Global Constraints

- Company order: Microsoft, Alphabet, Amazon, Meta, Oracle.
- FCF: `fcf_company_def ?? fcf ?? ocf - capex`; displayed capex = `ocf - fcf`.
- Window: each company's latest 8 quarters.
- Colours: operating cash flow `#3F86D0`, capital spending `#C0822A`; text uses text tokens only.
- Every visible string passes the gate (`LINE_NO_FILE_LOG=1 node scripts/line/gate.mjs in out --report r`), British English, no em dashes, no "rather than", no "Here is", no "ledger", no "deserves", no AI-authorship mention.
- Spending-plan lines only from the company's own release, transcript or filing; otherwise omitted.
- PRs only: branch → PR → merge commit → fast-forward main.

## Review Focus

- A company whose latest quarter is a calendar quarter later than the others (Meta, Oracle now): tiles use each company's own latest quarter; combined bars use only common quarters. Test: `commonQuarters` excludes a quarter only some companies report.
- A data refresh adding a ninth quarter: `windowed` keeps the latest eight. Test included.
- The essay still a draft at build time: no essay link rendered. Test via build: `grep -c cash-machines dist/trackers/hyperscaler-cash/index.html` → 0 while draft.
- A quarter with zero buybacks for everyone: bar chart draws a "0" label with no bar, no NaN. Test: `combined` returns 0, not NaN.
- Narrow phones (375px): small multiples stack to one column, page does not scroll sideways. Checked by a 375px screenshot.

---

### Task 1: Data file and calculations module (PR 1)

**Files:**
- Create: `src/data/hyperscalers/quarters.json` (copy of scratchpad `hyperscalers.json`)
- Create: `src/lib/hyperscalers.mjs`
- Create: `scripts/trackers/test/hyperscalers.test.mjs`, `scripts/trackers/test/fixtures/hyperscalers-2026-10-26.json` (frozen copy)
- Create: `scripts/trackers/hyperscalers/pull-quarter.mjs`

**Interfaces (Produces):**
- `ORDER: string[]`
- `quarterIndex(q: string) -> number` ("Q3 2026" → 2026*4+2)
- `qLabel(i) -> "Q3 26"`, `qFull(i) -> "Q3 2026"`
- `prepare(data) -> Row[]` where `Row = { name, qs: Quarter[] }`, each Quarter has original fields plus `i`, `fcf` (company definition), `capexShown`; ordered by `ORDER`, windowed to latest 8
- `windowed(qs, n=8)`
- `tiles(rows) -> { capexShare: number /*0..1*/, negative: string[], buyingBack: string[], debtNow: number, debtAdded: number }`
- `commonQuarters(rows) -> number[]`
- `combined(rows, key) -> {i, v}[]`
- `yMax(rows, step=20) -> number`

- [ ] **Step 1: Write failing tests** against the fixture:
  - `Math.round(tiles(rows).capexShare*100) === 85`
  - `negative` deep-equals `['Alphabet','Amazon','Meta','Oracle']`
  - `buyingBack` deep-equals `['Microsoft']`
  - `Math.round(debtAdded) === 231` and `Math.round(debtNow) === 457`
  - Meta latest `fcf` is -2.12
  - Amazon latest `fcf` is -7.69
  - `quarterIndex('Q1 2025') === 8100`
  - `windowed` of 9 quarters keeps the last 8
  - `commonQuarters` drops a quarter missing for one company
  - `combined(rows,'buybacks')` contains no NaN, and a quarter where everyone has 0 gives 0
- [ ] **Step 2:** `npm run -s test:trackers` → new tests FAIL (module missing).
- [ ] **Step 3:** Implement `src/lib/hyperscalers.mjs` with the signatures above (port from the mockup template's script).
- [ ] **Step 4:** `npm run -s test:trackers` → all pass.
- [ ] **Step 5: `pull-quarter.mjs`.**
  - Usage: `node scripts/trackers/hyperscalers/pull-quarter.mjs <TICKER> <period_end>`.
  - Fetches `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` with header `User-Agent: signal-to-noise.co trackers himanshu@signal-to-noise.co`.
  - Prints the quarter's values in $bn for review:
    - `NetCashProvidedByUsedInOperatingActivities`
    - `PaymentsToAcquirePropertyPlantAndEquipment` (Amazon `PaymentsToAcquireProductiveAssets`)
    - `PaymentsForRepurchaseOfCommonStock`
    - `LongTermDebtNoncurrent`
    - `FinanceLeasePrincipalPayments`
  - Year-to-date cash-flow facts are differenced to a single quarter.
  - Never writes the JSON. A human pastes the values.
  - Verify: `node … META 2026-09-30` prints ocf 32.78.
- [ ] **Step 6:** Commit, push, PR "Hyperscaler tracker: data and calculations", merge.

### Task 2: Tracker page (PR 2)

**Files:** Create `src/pages/trackers/hyperscaler-cash.astro`.

**Interfaces:** Consumes everything from Task 1.

- [ ] **Step 1: Build the page.**
  - `BaseLayout`:
    - `title="Hyperscaler cash tracker — signal-to-noise.co"` (the em dash matches the existing title convention; it lives in the HTML title only, same as the token page).
    - `description`: one sentence.
    - `starsDim`.
  - Sections in spec order.
  - Tiles: four, `repeat(4)` on desktop, 2 columns under 760px.
  - Small multiples as server-rendered SVG: shared `yMax`; shaded polygons where `capexShown > ocf`, with crossing points interpolated as in the mockup; endpoint dots; per-quarter hit rects carrying `data-tip`.
  - Bars with rounded tops; first and last values labelled.
  - "View the data" `<details>` table.
  - Guide table:
    - Meta: `$135–145bn, narrowed in October from $130–145bn`, source its 8-K Ex 99.1.
    - Others only if confirmed (Task 2 Step 2).
  - Watch bullets as in the mockup.
  - Essay link: rendered only if `getCollection('insights')` has `the-cash-machines-are-borrowing` with `draft !== true`.
  - Method note with corrected Amazon wording: "Amazon's is operating cash flow less purchases of property and equipment net of proceeds from sales and incentives".
  - Tooltip script copied from `ai-token-prices.astro`.
- [ ] **Step 2: Confirm the four other spending-plan lines.**
  - Check each against the company's own investor-relations release or call transcript (Microsoft, Alphabet, Amazon, Oracle).
  - Keep only confirmed lines, each with the source URL in a code comment.
- [ ] **Step 3: Gate the copy.**
  - Extract every visible string to `/tmp`-free scratch, run the gate, apply the plain-voice result, then re-gate with `--skip-layerb` if Layer B mangles labels.
  - Expected: all checks clean.
- [ ] **Step 4: Build check.**
  - `npm run -s build` succeeds.
  - `ls dist/trackers/hyperscaler-cash/index.html` exists.
  - `grep -c "the-cash-machines-are-borrowing" dist/trackers/hyperscaler-cash/index.html` → 0.
  - `ls dist/insights | grep -c borrowing` → 0.
- [ ] **Step 5: Screenshots** at 1280 and 375 (headless Chrome against `npx astro preview`). Tiles read 85% / 4 of 5 / 1 of 5 / +$231bn; no sideways scroll.
- [ ] **Step 6:** Commit, PR "Hyperscaler cash tracker page", merge.

### Task 3: /trackers index and nav (PR 3)

**Files:**
- Create: `src/pages/trackers/index.astro`
- Modify: `src/components/Header.astro` (link `{ href: '/trackers', label: 'Trackers' }`)

- [ ] **Step 1: Index page.**
  - H1 "Trackers", then two cards.
  - Token card: name "AI token price index", a one-line blurb, headline "flagship median $X" from the latest snapshot (same median as the token page).
  - Hyperscaler card: name "Hyperscaler cash tracker", a one-line blurb, headline "capex at N% of cash flow" from `tiles()`.
  - Each card links to its page.
- [ ] **Step 2:** Change the nav entry. `isActive('/trackers')` already covers child pages via `startsWith`.
- [ ] **Step 3:** Gate the blurbs (same procedure as Task 2 Step 3).
- [ ] **Step 4: Build check.**
  - `npm run -s build` passes.
  - `dist/trackers/index.html` contains both card links.
  - Every page's nav shows "Trackers".
- [ ] **Step 5:** Commit, PR "Trackers index; nav Trackers", merge.
- [ ] **Step 6:** `./deploy.sh`, then verify live:
  - `curl -s -o /dev/null -w '%{http_code}'` on `/trackers` and `/trackers/hyperscaler-cash` → 200.
  - Title correct.
  - No draft essay.

### Task 4: Q3 2026 data (PR 4, after 29 Oct)

- [ ] For MSFT, GOOGL, AMZN, period end 2026-09-30:
  - Run `pull-quarter.mjs`.
  - Add the rows (Amazon: also proceeds, `capex_net_of_proceeds`, `fcf_company_def`).
  - Record the sources.
- [ ] `npm run -s test:trackers` (the fixture is unchanged, so tests still pass); build; check the tiles in a screenshot.
- [ ] PR "Hyperscaler tracker: Q3 2026 results", merge, deploy.
