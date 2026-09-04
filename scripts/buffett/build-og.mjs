#!/usr/bin/env node
/* Renders the Open Graph card for the Buffett section from the Buffett
   line figure as built into dist/buffett/index.html, letterboxed onto the
   site canvas at 1200×630 like the article cards. Run after a build; the
   next build copies public/og/buffett.jpg into dist.

   Run:  node scripts/buffett/build-og.mjs */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const HTML = new URL('../../dist/buffett/index.html', import.meta.url).pathname;
const OUT = new URL('../../public/og/buffett.jpg', import.meta.url).pathname;
if (!existsSync(HTML)) {
  console.error('build-og: dist/buffett/index.html not found; run the build first');
  process.exit(1);
}
const html = readFileSync(HTML, 'utf8');
const m = html.match(/<svg viewBox="0 0 2400 1000"[\s\S]*?<\/svg>/);
if (!m) {
  console.error('build-og: Buffett line SVG not found in the built page');
  process.exit(1);
}
const svg = m[0]
  .replace(/ tabindex="0"| role="button"| aria-label="[^"]*"| style="[^"]*"/g, '')
  // HTML boolean attributes (data-line, data-dots …) are invalid XML.
  .replace(/ (data-[\w-]+)(?=[\s>])/g, ' $1=""')
  .replace(/<svg (?![^>]*xmlns=)/, '<svg xmlns="http://www.w3.org/2000/svg" ');
mkdirSync(new URL('../../public/og/', import.meta.url).pathname, { recursive: true });
const figure = await sharp(Buffer.from(svg)).resize({ width: 1200, height: 500, fit: 'contain', background: '#111111' }).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#0a0a0a' } })
  .composite([{ input: figure, left: 0, top: 65 }])
  .jpeg({ quality: 88 })
  .toFile(OUT);
console.log(`og: ${OUT}`);
