#!/usr/bin/env node
/* Rasterises the still frame of an animated cover to public/img/<slug>.webp
   (2400×1350), so topic-page thumbnails and the OG pipeline
   (make-og-images.mjs) show the same composition the essay page animates.

   Usage:
     node scripts/render-cover.mjs <slug> [<slug> ...]   one or more covers
     node scripts/render-cover.mjs all                     every module in src/covers
     add --png <dir>  to also write a 1200-wide PNG preview into <dir>
     add --sheet <file.png> with several slugs to write a contact sheet

   Node 25 loads the .ts modules directly (type stripping), which is why
   the cover modules keep to plain TypeScript and explicit .ts imports. */
import { readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import sharp from 'sharp';

const COVERS = new URL('../src/covers/', import.meta.url);
const IMG = new URL('../public/img/', import.meta.url).pathname;

const args = process.argv.slice(2);
const pngIdx = args.indexOf('--png');
const pngDir = pngIdx >= 0 ? args.splice(pngIdx, 2)[1] : null;
const sheetIdx = args.indexOf('--sheet');
const sheetFile = sheetIdx >= 0 ? args.splice(sheetIdx, 2)[1] : null;
const noWebp = args.includes('--no-webp');

let slugs = args.filter((a) => !a.startsWith('--'));
if (slugs.includes('all')) {
  slugs = readdirSync(COVERS).filter((f) => f.endsWith('.ts') && !f.startsWith('_')).map((f) => basename(f, '.ts'));
}
if (!slugs.length) {
  console.error('usage: render-cover.mjs <slug>|all [--png dir] [--sheet file.png] [--no-webp]');
  process.exit(1);
}
if (pngDir) mkdirSync(pngDir, { recursive: true });

const tiles = [];
for (const slug of slugs) {
  const mod = await import(new URL(`${slug}.ts`, COVERS));
  const cover = mod.default;
  const markup = cover.still('');
  const buf = Buffer.from(markup);
  if (!noWebp) {
    const out = join(IMG, `${slug}.webp`);
    await sharp(buf, { density: 72 }).webp({ quality: 82 }).toFile(out);
    console.log(`webp  ${out}`);
  }
  if (pngDir) {
    const out = join(pngDir, `${slug}.png`);
    await sharp(buf).resize({ width: 1200 }).png().toFile(out);
    console.log(`png   ${out}`);
  }
  if (sheetFile) tiles.push(await sharp(buf).resize({ width: 800 }).png().toBuffer());
}

if (sheetFile && tiles.length) {
  const cols = 2, tw = 800, th = 450, gap = 16;
  const rows = Math.ceil(tiles.length / cols);
  const composite = tiles.map((input, i) => ({ input, left: (i % cols) * (tw + gap), top: Math.floor(i / cols) * (th + gap) }));
  await sharp({ create: { width: cols * tw + (cols - 1) * gap, height: rows * th + (rows - 1) * gap, channels: 3, background: '#2a2a28' } })
    .composite(composite).png().toFile(sheetFile);
  console.log(`sheet ${sheetFile} (${tiles.length} covers)`);
}
