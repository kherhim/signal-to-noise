# Buffett tab — design

**Date:** 2026-09-04
**Status:** landing (line + search) shipped 2026-09-04; topic pages built, held behind BUFFETT_TOPICS=1 until the drafted ledes/notes pass the owner's edit and the string gate. Search uses a plain chunk file and own ranking rather than MiniSearch (index was 9 MB).

## Goal

A new "Buffett" section of signal-to-noise.co built on the local corpus
of 86 Buffett letters (`_sources/buffett-letters/`, 1959–2025: 28
partnership letters, 30 Berkshire annual letters, Greg Abel's first
letter, the 2025 Thanksgiving note). Three features, one tab:

1. **The Buffett line** — landing page hero: an animated figure in the
   cover fabric, one dot per letter, with one chosen sentence per letter.
2. **"Buffett on…" concordance pages** — ten CFO topics, each a
   chronological run of short excerpts showing how his view formed.
3. **Letters search** — client-side full-text search returning short
   excerpts with year, kind and a link to the source.

## Constraints

- **Copyright.** The letters are © Berkshire Hathaway Inc. (annual) and
  Warren Buffett (partnership). The site shows short attributed excerpts
  only, never full text: ≤ 50 words for curated excerpts, ≤ 60 words for
  search snippets. A standing attribution line appears on every page.
  Annual letters from 1977 link to `https://www.berkshirehathaway.com/letters/<year>.html`
  (or the PDF Berkshire publishes); partnership letters are cited by date
  without a link.
- **Static site.** No backend. Search runs in the browser against an
  index built at publish time and fetched lazily on first keystroke.
- **Verbatim.** Every curated excerpt must match the corpus text
  (normalised, ≥ 0.9 similarity for OCR letters, exact for clean ones).
  A script enforces this and the build fails on a mismatch.
- **Fabric.** Figures use the cover vocabulary (`src/covers/_lib.ts`):
  cream on near-black, ash secondary, monospace marks. Motion respects
  `prefers-reduced-motion` and the 18 s / rest-fifth loop rule.
- **British English** in all site copy; the excerpts keep Buffett's
  American spelling verbatim.

## Routes and navigation

- Header gains **Buffett** between Topics and About.
- `/buffett/` — landing: hero figure, topic chips, search box, attribution.
- `/buffett/on/<topic>/` — ten pages: buybacks, dividends, acquisitions,
  leverage, float, moats, intrinsic-value, incentives, accounting, mistakes.
- Sitemap and OG tags as for other pages; OG image is a rendered still of
  the Buffett line (`public/og/buffett.jpg`).

## Data

`src/data/buffett/`
- `letters.json` — one record per letter: id (filename stem), year, date,
  kind, entity, word count, source URL or null. Built from frontmatter.
- `line.json` — one record per letter: `{ id, year, quote, note }`; the
  quote ≤ 40 words, the note ≤ 20 words.
- `topics/<topic>.json` — `{ topic, title, lede, related: [slugs],
  entries: [{ id, year, excerpt, note, corrected }] }`; at most one entry
  per year; `corrected: true` when OCR artefacts were fixed by hand.

`scripts/buffett/`
- `build-letters.mjs` — writes `letters.json` from the corpus frontmatter.
- `build-index.mjs` — chunks each letter into paragraphs (≤ 120 words),
  builds a MiniSearch index over `{ id, year, kind, text }`, serialises to
  `public/buffett/index.json` (fetched lazily; expected 2–4 MB, gzipped by
  Cloudflare).
- `verify-excerpts.mjs` — checks every quote in `line.json` and every
  `topics/*.json` excerpt against the corpus; runs in `prebuild`.

Curation: one reader per topic drafts entries from the full letters; a
separate reader drafts `line.json`. Notes are drafts for the user's edit
pass.

## Components and pages

- `src/components/buffett/BuffettLine.astro` — the hero figure. Server-
  rendered SVG (viewBox 2400×900): a ruler of years 1959–2025, one dot per
  letter (cream annual, ash partnership, dashed for the two non-Buffett
  items), a hairline through them. Client script: draws the line on load
  (dashoffset), dots scale in as it reaches them; hover/tap on a dot shows
  a panel with year, kind, the quote, and the source link. Keyboard
  accessible (dots are buttons in an overlaid list).
- `src/components/buffett/TopicTimeline.astro` — small figure for a
  topic page: years addressed as dots on the same ruler, sized by excerpt
  count in that letter; static apart from a draw-in.
- `src/components/buffett/LettersSearch.astro` — input + results list.
  Loads MiniSearch (bundled) and the index on first focus; shows up to 20
  results, each an excerpt of ≤ 60 words centred on the first match, with
  year, kind and link. Highlights matches. Empty and loading states.
- `src/pages/buffett/index.astro`, `src/pages/buffett/on/[topic].astro`.
- Attribution partial used by both pages.

## Testing

- `node scripts/buffett/verify-excerpts.mjs` passes for all data.
- `npm run build` succeeds; `/buffett/` and ten topic pages exist;
  sitemap includes them.
- Browser: the line draws and rests; a dot shows its quote; search for
  "float", "repurchase", "mistake" returns sensible excerpts within a
  second on a cold index; reduced motion shows the still figure.
- String gate on all site copy: BrE, Layer A, Layer B (Codex), web check
  on the ledes.

## Out of scope

- Any AI chat over the letters.
- Full-text display of any letter.
- Topics beyond the ten agreed.
