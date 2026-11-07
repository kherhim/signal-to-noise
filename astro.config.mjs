// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';

/* Sitemap lastmod for essays: `updated` if set, else `date`. getCollection
   is not available here, so read the two fields straight from each file's
   frontmatter (both are plain YYYY-MM-DD lines). */
function essayDates() {
  const dir = new URL('./src/content/insights/', import.meta.url);
  const dates = new Map();
  for (const file of fs.readdirSync(dir)) {
    if (!/\.mdx?$/.test(file)) continue;
    const fm = fs.readFileSync(new URL(file, dir), 'utf8').split(/^---\s*$/m)[1] ?? '';
    const field = (k) => fm.match(new RegExp(`^${k}:\\s*["']?([0-9]{4}-[0-9]{2}-[0-9]{2}[^"'\\s]*)`, 'm'))?.[1];
    const when = field('updated') ?? field('date');
    if (when) dates.set(file.replace(/\.mdx?$/, ''), new Date(when).toISOString());
  }
  return dates;
}
const lastmod = essayDates();

// https://astro.build/config
export default defineConfig({
  site: 'https://signal-to-noise.co',
  integrations: [
    mdx(),
    sitemap({
      serialize(item) {
        const slug = item.url.match(/\/insights\/([^/]+)\/?$/)?.[1];
        if (slug && lastmod.has(slug)) item.lastmod = lastmod.get(slug);
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
