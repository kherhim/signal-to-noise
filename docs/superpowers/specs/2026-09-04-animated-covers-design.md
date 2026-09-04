# Animated essay covers — design

**Date:** 2026-09-04
**Status:** approved by user (prototype reviewed side by side)

## Goal

Replace the static cover image on two essays with an abstract, animated
version that keeps the cream-on-near-black fabric of the current
minimalist covers:

- `when-cognition-becomes-metered` (FIG. 01, "Cognition, metered")
- `the-cognitive-supply-chain` (FIG. 02, "Thinking, single-sourced")

The webp files stay in place for everything that is not the essay page
itself: Open Graph / social previews, topic-page thumbnails, RSS.

## Motion concepts (as prototyped and approved)

Both loops share an 18 s period. The last fifth of every loop (14.4 s
onward) holds the still cover, so the composition always returns to the
published artwork before repeating.

**Cognition, metered.** Squares in the scatter region (columns beyond the
dense block) depart the semicircle's flat edge one at a time on a
staggered schedule, drift right to their resting position, and the ones
that rest as outlines thin from solid to outline mid-flight. A thin
cream cursor on the ruler steps forward with every departure and fades
before the rest beat. The semicircle and the dense columns do not move.

**Thinking, single-sourced.** A small cream pulse runs from the supplier
circle's right edge along each hairline to its square, at slightly
different speeds, and the square brightens for a beat on arrival. At
about 60 % of the loop the supplier dims, every hairline fades, and every
square it feeds flickers to outline together; all recover by 78 %. The
dashed empty circle never changes.

## Architecture

- **Schema.** `coverAnimation: z.enum(['metered', 'supply-chain']).optional()`
  added to the insights collection. Set on the two essays. `coverImage`
  and `coverImageAlt` stay as they are.
- **Components.** `src/components/covers/CoverMetered.astro` and
  `src/components/covers/CoverSupplyChain.astro`. Each renders the full
  still cover as inline SVG *at build time* (viewBox 2400×1350, the same
  coordinate space as the webp) so the page paints the cover with no
  JavaScript and no image request. Geometry for the metered grid is
  traced from the shipped webp, not generated, so the still frame matches
  the published cover.
- **Motion.** A `<script>` in each component attaches Web Animations API
  animations to the SVG elements it finds by data attribute. It bails out
  entirely when `prefers-reduced-motion: reduce` matches, leaving the
  still SVG. The existing global reduced-motion CSS does not touch WAAPI
  animations, hence the explicit check.
- **Layout.** `PostLayout.astro` gains a `coverAnimation` prop. When set,
  it renders the matching component inside the existing `<figure>` (same
  border and radius) instead of the `<img>`, keeps `coverImageAlt` as the
  SVG's accessible label, and does not emit the cover `<link rel="preload">`
  since no image is fetched.
- **Everything else** (`ogImage`, topic listings, RSS) continues to read
  `coverImage`.

## Out of scope

- Other covers. The older editorial illustrations do not suit this
  treatment; further geometric covers can adopt the same pattern later.
- Any change to the webp files or the OG pipeline.

## Testing

- `npm run build` succeeds and both essay pages contain an inline `<svg>`
  and no cover `<img>` or preload link.
- Other essay pages are byte-for-byte unchanged apart from build noise.
- Visual check in Chrome: both covers animate, rest frame matches the
  webp, reduced-motion shows the still cover.
