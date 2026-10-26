# Homepage redesign: essay map hybrid (roadmap S7): design

Status: wireframes reviewed, option C chosen with A underneath; full mockup approved by the owner 26 Oct 2026 ("this is awesome"). Design awaiting approval. Nothing built.

Mockup: `scratchpad/home-mockup/homepage-hybrid.html` (template `template.html`, data `essays.json`), private link https://claude.ai/artifact/R69nUqtFqRjAYwy2Zh1Lsk.

## Intent

The homepage should show at a glance that the site now has a body of work (65 published essays, two trackers), while keeping one obvious next click for a first-time visitor arriving from LinkedIn: the latest essay.

## Goals

1. **Hero, two columns.**
   - Left: eyebrow "Signal, not noise.", the existing H1 "I find the signal where most people see noise.", a one-line promise ("Pragmatic essays on finance, AI and capital strategy, for CFOs, finance leaders and operators. A new essay every Wednesday."), then the latest essay block (date, title, excerpt, "Read the essay →", "Subscribe on LinkedIn").
   - Right: the **essay map**, a rotating 3D point cloud on a canvas. **Owner requirement: it stays entirely in the right column and never draws behind or over the text.**
2. **Essay map behaviour.**
   - One point per published essay; colour by theme; size by recency (newer bigger); a ring on the latest essay.
   - Slow automatic rotation; drag to turn; hover shows title, theme and date; click opens the essay.
   - Legend with counts; clicking a theme toggles it.
   - Faint background dust for depth.
   - Under `prefers-reduced-motion`: no auto-rotation (still draggable).
   - Plain canvas, no 3D library.
   - Re-initialises on every `astro:page-load` (the site uses ClientRouter view transitions), and cleans up its animation frame and listeners on `astro:before-swap`.
3. **Phone (below 900px).** Single column. The map sits as a band under the hero text (aspect about 16:11), never beside it.
4. **Tracker strip.** Four numbers: flagship and budget AI model median prices (token tracker), AI capex as a share of cash flow and negative free cash flow count (hyperscaler tracker, S2). Each is computed at build time from the tracker data files, never typed in.
5. **Theme rails.**
   - "Latest" (next five essays after the lead), then one horizontally scrolling row per theme, with cover images.
   - Up to six essays per row, newest first. *(My call.)* An essay without a cover image gets a text card (title, date) at the same size, so nothing is skipped for lacking a cover. *(My call.)*
   - No essay appears twice on the page.
   - Each row has "All →" linking to the matching listing.
6. **Below the rails.** "Reading the noise" and "Get in touch" (Contact and Subscribe) both stay, then the footer. *(My call: keeps the homepage's only Contact link.)*
7. **Series parts.** As today, the ten parts of "Leadership lessons I wish I knew earlier" do not appear separately; the series parent appears once (map point, rails). The map therefore shows about 55 points, not 65; legend counts follow. *(My call, matching the current homepage rule.)*

## Themes

Four themes, derived at build time from tags, in this precedence:

1. Series parent → **Leadership**.
2. Tag `buffett`, `capital-markets`, `ipo` or `capital-allocation` → **Capital, markets and Buffett**.
3. Tag `ai` → **AI and the finance function**.
4. Tag `fp-and-a`, `budgeting`, `cost-structure` or `finance` → **FP&A and budgets**.
5. Otherwise → **Leadership**.

Current split: AI 26, Capital 8, FP&A 7, Leadership 24. An optional frontmatter field `theme` overrides the rule for any essay. Theme colours (dark surface): AI `#3F86D0`, Capital `#C0822A`, FP&A `#3FA58C`, Leadership `#d8d2c4`. Identity is never colour alone: the legend, the tooltip and the rail headings name the theme.

## Non-goals

- No change to essay pages, the insights listing, search or the newsletter flow.
- No new section pages per theme in this build; "All →" links go to the closest existing listing (`/topics/<tag>` or `/insights`).
- The keynote is not part of the site and never appears here.

## Anti-goals

- The map covering or sitting behind text at any width.
- A homepage whose only route to the essays is the canvas. Every essay in the rails is a normal link; the canvas has an aria-label that says the list follows.
- A heavier page: no 3D or chart library; cover images lazy-load; the canvas script stays small.
- Losing the "fresh essay goes to the top" behaviour: the lead essay keeps the existing `pickFeatured` logic (fresh within 7 days, then `featured: true`, then weekly rotation). The mockup shows the newest essay.

## What it replaces

- The solar-system orbital in `Hero.astro` and its script are removed from the homepage (the component can be deleted if nothing else uses it).
- The "Featured" and "Recent insights" sections become the hero's latest-essay block and the rails.
- `BaseLayout` props `stars`/`heroClear` for the homepage: keep the star background only if it does not compete with the map; builder decides after a side-by-side look, owner confirms on the preview.

## Dependencies

- The tracker strip's two hyperscaler numbers need S2's data file. **S2 ships first** (owner go, 26 Oct); S7 PR 2 waits for S2's data PR, so there is no temporary strip.

## How it is built (decided)

- Astro components: `HomeHero.astro` (text + map container), `EssayMap.astro` (canvas + client script; essay data passed as a small JSON island of slug, title, date, theme), `TrackerStrip.astro`, `ThemeRail.astro`.
- Theme assignment as a pure, unit-tested function in `src/lib/themes.ts`.
- Deterministic layout of the cloud (seeded), so the map looks the same on every visit.
- Copy gated (plagiarism, BrE, Layer A, Layer B) before merge.

## Delivery: four PRs

1. Theme function + tests + optional `theme` frontmatter field.
2. Tracker strip + rails (homepage below the hero).
3. Hero with essay map (removes the orbital).
4. Polish after the owner's phone check, then deploy and verify live.

## Left to the builder

- Cloud geometry (cluster centres, spread, point sizes) within the mockup's look.
- Exact breakpoints beyond the 900px switch.
- Whether background stars stay (see above).
