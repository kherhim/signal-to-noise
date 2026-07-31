#!/usr/bin/env node
/* Generates JPEG Open Graph cards from the WebP cover images.

   Why this exists: covers are WebP (publish.sh converts and deletes the
   source), and LinkedIn's link-preview crawler does not reliably render
   WebP og:image — the post ends up a bare link with no card. Since
   LinkedIn is the main distribution channel, every article needs a JPEG
   twin purely for crawlers. The on-page <img> still uses the WebP.

   Cover aspect ratios run 0.67–1.78 against OG's 1.91 target, so the
   image is letterboxed (fit: contain) on the site canvas colour rather
   than cropped — a crop would cut the figure out of the diagram covers.

   Also emits og/default.jpg for pages with no cover of their own
   (home, /about, /topics/*), which otherwise share as a blank card.

   Run after adding a cover:  node scripts/make-og-images.mjs
   Idempotent — skips JPEGs already newer than their source. */

import { readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const IMG_DIR = new URL('../public/img/', import.meta.url).pathname;
const OG_DIR = new URL('../public/og/', import.meta.url).pathname;

// 1200x630 is the size LinkedIn, Facebook and X all agree on.
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// --color-canvas from src/styles/global.css. Letterbox bars have to match
// the site background or the card reads as a mistake.
const CANVAS = '#0a0a0a';

const force = process.argv.includes('--force');

mkdirSync(OG_DIR, { recursive: true });

/* --- Per-article cards ---------------------------------------------- */

const covers = readdirSync(IMG_DIR).filter((f) => f.endsWith('.webp'));
let written = 0;
let skipped = 0;

for (const cover of covers) {
  const slug = cover.replace(/\.webp$/, '');
  const src = join(IMG_DIR, cover);
  const out = join(OG_DIR, `${slug}.jpg`);

  if (!force && existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) {
    skipped += 1;
    continue;
  }

  await sharp(src)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'contain', background: CANVAS })
    .jpeg({ quality: 82, progressive: true })
    .toFile(out);

  written += 1;
}

/* --- Default card ---------------------------------------------------- */

// Rendered from SVG rather than checked in as a binary so the wording can
// be edited in the diff. Font stack stays generic: this rasterizes through
// librsvg with system fonts, so Fraunces is not available here.
const defaultCard = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${CANVAS}"/>
  <text x="100" y="290" font-family="Georgia, 'Times New Roman', serif"
        font-size="76" fill="#fafafa">signal-to-noise.co</text>
  <text x="100" y="360" font-family="Georgia, 'Times New Roman', serif"
        font-size="34" fill="#94a3b8">Finance, AI, and capital strategy</text>
  <text x="100" y="410" font-family="Georgia, 'Times New Roman', serif"
        font-size="34" fill="#94a3b8">Himanshu Kher — CFO, 25+ years</text>
  <rect x="100" y="452" width="120" height="3" fill="#ffffff"/>
</svg>`);

await sharp(defaultCard).jpeg({ quality: 88, progressive: true }).toFile(join(OG_DIR, 'default.jpg'));

console.log(`og: ${written} written, ${skipped} up to date, + default.jpg`);
