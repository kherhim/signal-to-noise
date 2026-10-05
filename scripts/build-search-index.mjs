/* Site search index, run after `astro build` (npm postbuild).
   Pagefind indexes two things into dist/pagefind/:
     1. The essay pages in dist/insights/. Only the region PostLayout marks
        with data-pagefind-body is read, so listings, tag pages and the
        share/subscribe furniture stay out of the index.
     2. The Buffett letters, from public/buffett/chunks.json, as custom
        records (the letters are not pages on this site). One record per
        paragraph chunk, so a hit shows the passage that matched.
   Every record carries a `type` filter, which /search uses to show essays
   and letters as separate groups. */
import { readFile } from 'node:fs/promises';
import * as pagefind from 'pagefind';

const chunks = JSON.parse(await readFile('public/buffett/chunks.json', 'utf8'));
const letters = JSON.parse(await readFile('src/data/buffett/letters.json', 'utf8'));
const byId = Object.fromEntries(letters.map((l) => [l.id, l]));

/* Kept in step with kindLabel / dateLabel in src/lib/buffett.ts. */
const KIND = {
  partnership: 'Buffett Partnership letter',
  annual: 'Berkshire Hathaway letter',
  abel: 'Greg Abel, first letter',
  thanksgiving: 'Thanksgiving note',
};
const dateLabel = (l) => {
  const d = l.date ? new Date(l.date) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : String(l.year);
};

const { index, errors } = await pagefind.createIndex({ forceLanguage: 'en' });
if (!index) throw new Error(`pagefind: ${errors.join('; ')}`);

const essays = await index.addDirectory({ path: 'dist', glob: 'insights/**/*.html' });
if (essays.errors.length) throw new Error(`pagefind essays: ${essays.errors.join('; ')}`);

let added = 0;
for (const [i, c] of chunks.entries()) {
  const l = byId[c.l];
  if (!l) throw new Error(`pagefind: chunk ${i} names unknown letter ${c.l}`);
  /* Records need distinct URLs; the fragment keeps them apart and the
     results page links to meta.link, which has none. */
  const link = l.source ?? '/buffett/';
  const r = await index.addCustomRecord({
    url: `${link}#chunk-${i}`,
    content: c.t,
    language: 'en',
    meta: { title: KIND[l.kind] ?? 'Letter', date: dateLabel(l), link },
    filters: { type: ['letter'] },
    sort: { year: String(l.year) },
  });
  if (r.errors.length) throw new Error(`pagefind letter chunk ${i}: ${r.errors.join('; ')}`);
  added++;
}

const out = await index.writeFiles({ outputPath: 'dist/pagefind' });
if (out.errors.length) throw new Error(`pagefind write: ${out.errors.join('; ')}`);
await pagefind.close();

console.log(`pagefind: ${essays.page_count} essays + ${added} letter passages → dist/pagefind`);
