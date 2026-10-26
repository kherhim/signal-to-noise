# Homepage Essay Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage hero and featured/recent sections with the approved hybrid. That means latest essay left, rotating essay map right, a tracker strip, and theme rails.

**Architecture:** Theme assignment and homepage selection are pure functions in `src/lib/themes.mjs` (node:test). `index.astro` keeps `pickFeatured`, computes rails and the strip at build time, and renders four new components. The map is one client script bound to `astro:page-load` and torn down on `astro:before-swap`.

**Tech Stack:** Astro 5 (ClientRouter), Tailwind, canvas 2D, node:test.

**Spec:** `docs/superpowers/specs/2026-10-26-homepage-essay-map-design.md`

**Depends on:** hyperscaler plan Task 1 merged (its `tiles()` and data file).

## Global Constraints

- Theme colours: AI `#3F86D0`, Capital `#C0822A`, FP&A `#3FA58C`, Leadership `#d8d2c4`.
- Theme labels:
  - Rail headings: "AI and the finance function", "Capital, markets and Buffett", "FP&A and budgets", "Leadership".
  - Legend: "AI", "Capital and markets", "FP&A and budgets", "Leadership".
- Map stays inside the right column at ≥900px. Below 900px it sits under the text at aspect 16/11.
- Series children never appear; the series parent appears once.
- No essay appears twice on the page. Rails hold up to 6 items, newest first. Essays without covers get a text card.
- `prefers-reduced-motion`: no auto-rotation.
- No 3D or chart library.
- Keep "Reading the noise" and "Get in touch".
- Copy gated; British English; no em dashes in new copy.

## Review Focus

- Navigating away and back via ClientRouter: the map must not run two animation loops or leak listeners. Check that `window.__essayMapRunning` is a single loop after 3 navigations.
- An essay with an unknown/new tag set: falls to Leadership. Test included.
- Optional `theme` frontmatter with an invalid value: the build fails via the zod enum.
- Window resize from desktop to phone width: the canvas re-sizes without blurring and the map moves under the text. Checked by screenshot at 375 and 1280.
- Keyboard users: the canvas is focusable with an aria-label; every essay is reachable by normal links in the rails or "All →".

---

### Task 1: Theme function, frontmatter field, homepage selection (PR 1)

**Files:**
- Create: `src/lib/themes.mjs`
- Create: `scripts/site/test/themes.test.mjs`
- Modify: `package.json` (`"test:site": "node --test scripts/site/test/*.mjs"`)
- Modify: `src/content.config.ts` (optional `theme: z.enum(['ai','cap','fpa','lead']).optional()`)

**Interfaces (Produces):**
- `THEMES: {key, label, short, color}[]`, in the order ai, cap, fpa, lead
- `themeOf({tags, series, theme}) -> 'ai'|'cap'|'fpa'|'lead'`, following the spec precedence: explicit theme, series parent, capital tags, ai, fpa tags, else lead
- `homepagePlan(posts /* newest first, already filtered to non-children */, leadId) -> { lead, latest: post[] /* ≤5 */, rails: {theme, items}[] /* ≤6 each, no repeats */ }`

Posts are plain objects `{id, data:{tags, series, theme, date, coverImage}}`.

- [ ] **Step 1: Write the failing tests.**
  - Series parent → `lead`.
  - `['buffett','ai']` → `cap`.
  - `['ai','fp-and-a']` → `ai`.
  - `['budgeting']` → `fpa`.
  - `['teams']` → `lead`.
  - `theme:'fpa'` overrides `['ai']`.
  - `homepagePlan` on 30 synthetic posts:
    - no id appears twice across lead, latest and rails;
    - every rail has 6 or fewer items;
    - the lead is excluded everywhere else.
  - On the real essays (`scripts/site/test/fixtures/essays.json`, generated from frontmatter: id, tags, series, date), the counts are AI 26, Capital 8, FP&A 7 and Leadership 14 (24 minus 10 series children).
- [ ] **Step 2:** `npm run -s test:site` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm run -s test:site` → PASS. `npm run -s build` passes with the schema change.
- [ ] **Step 5:** Commit, PR "Homepage: essay themes", merge.

### Task 2: Tracker strip and theme rails (PR 2)

**Files:**
- Create: `src/components/home/TrackerStrip.astro`
- Create: `src/components/home/ThemeRail.astro`
- Modify: `src/pages/index.astro` (replace "Featured" and "Recent insights" with the rails; keep the existing hero for now)

**Interfaces:**
- Consumes `homepagePlan`, `THEMES`, hyperscaler `prepare`/`tiles`, and the token snapshot median (same calculation as the token page; extract `median()` into `src/lib/stats.mjs` if it is needed twice).
- Produces `ThemeRail` props `{title, color?, items: {href, title, date, cover?}[], allHref}` and `TrackerStrip` with no props (reads the data itself).

- [ ] **Step 1: TrackerStrip.**
  - Four cells:
    - "Flagship AI model" median $X.XX
    - "Budget AI model" median $X.XX
    - "AI capex vs cash flow" N%
    - "Free cash flow negative" n of 5
  - Sub-lines as in the mockup, linking to `/trackers/ai-token-prices` and `/trackers/hyperscaler-cash`.
  - 4 columns, 2 below 760px.
- [ ] **Step 2: ThemeRail.**
  - Horizontal scroll-snap track of cards: a 16:9 cover (`coverImage`) or a text card of the same size.
  - "All →" links: Latest → `/insights`; AI → `/insights/tag/ai`; Capital → `/insights/tag/capital-markets`; FP&A → `/insights/tag/fp-and-a`; Leadership → `/insights/tag/leadership`. Check that each route exists in dist.
- [ ] **Step 3:** Wire both into `index.astro` below the hero, in the order: strip, Latest rail, four theme rails, Reading the noise, Get in touch.
- [ ] **Step 4: Gate** the new strings (strip labels, rail headings).
- [ ] **Step 5: Build check.**
  - `npm run -s build` passes.
  - Screenshots at 1280 and 375.
  - In `dist/index.html`, no slug appears twice as a card href.
- [ ] **Step 6:** Commit, PR "Homepage: tracker strip and theme rails", merge.

### Task 3: Hero with essay map (PR 3)

**Files:**
- Create: `src/components/home/HomeHero.astro`
- Create: `src/components/home/EssayMap.astro`
- Modify: `src/pages/index.astro` (use `HomeHero`; drop `Hero` import)
- Delete: `src/components/Hero.astro`, if no other importer (`grep -rn "components/Hero" src`)

**Interfaces:**
- `HomeHero` props: `{lead: {href, title, excerpt, date}, points: {s, t, d, c}[]}`.
- `EssayMap` emits `<script type="application/json" id="essay-map-data">` plus a canvas with an aria-label stating the count and that the list follows.

- [ ] **Step 1: HomeHero.**
  - Two columns ≥900px (`minmax(0,1fr) minmax(0,1fr)`), text left and map right. One column below.
  - Copy:
    - eyebrow "Signal, not noise."
    - H1 unchanged
    - promise line from the spec
    - "Latest essay · {date}"
    - buttons "Read the essay →" and "Subscribe on LinkedIn" (href `/subscribe`)
- [ ] **Step 2: EssayMap script.** Port from the mockup template, with these changes:
  - Seeded layout.
  - Points sized by recency; ring on the lead.
  - Legend toggles.
  - Drag to rotate; hover tooltip; click navigates with `navigate()` from `astro:transitions/client`.
  - Device-pixel-ratio resize.
  - Bound on `astro:page-load`. Cancel `requestAnimationFrame` and remove listeners on `astro:before-swap`.
  - No auto-rotation under reduced motion.
- [ ] **Step 3: Stars decision.** Screenshot with and without `stars`/`heroClear` on the homepage. Keep the stars only if no star renders inside the map's bounding box at 1280px; otherwise drop them for the homepage.
- [ ] **Step 4: Gate** the hero copy.
- [ ] **Step 5: Build and checks.**
  - `npm run -s build` passes.
  - Screenshots at 1280 (map wholly right of the text column) and 375.
  - Run `astro preview`, navigate Home → Insights → Home three times in headless Chrome, then check the console for errors and confirm a single rAF loop.
- [ ] **Step 6:** Commit, PR "Homepage: essay map hero", merge.

### Task 4: Deploy and verify (PR 4, polish only if needed)

- [ ] **Step 1:** `./deploy.sh`.
- [ ] **Step 2: Verify live.**
  - `curl` `/` → 200.
  - The HTML contains `essay-map-data` and the four strip labels.
  - `ls dist/insights | grep -c borrowing` → 0 before deploy.
- [ ] **Step 3:** Owner's phone check. Any fixes go in PR 4, "Homepage: polish after phone check".
