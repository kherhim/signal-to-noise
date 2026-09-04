import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* Astro 6 content collections use the glob loader.
   Files in src/content/<collection>/ are loaded as entries; their
   id is the filename slug. */

const insights = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/insights' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string(),
    // Optional search-intent meta description. When present it replaces the
    // excerpt in <meta name="description"> / og:description only — the
    // visible excerpt on cards and indexes is untouched. Write it the way a
    // CFO would type the query, not the way the essay speaks.
    seoDescription: z.string().optional(),
    tags: z.array(z.string()).optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    // Where the article originated (imported from LinkedIn). Optional.
    sourceUrl: z.string().url().optional(),
    // Optional cover image rendered above the article title.
    coverImage: z.string().optional(),
    coverImageAlt: z.string().optional(),
    // Optional animated cover. When set, the essay page renders the matching
    // inline-SVG component from src/components/covers/ instead of the
    // coverImage; coverImage still serves OG previews and listings.
    // The value names a module in src/covers/<value>.ts (normally the slug).
    coverAnimation: z.string().optional(),
    // Series metadata. Set on the parent and every child of a multi-part
    // series. The parent omits `part`; children include their part number.
    series: z
      .object({
        id: z.string(),    // shared across parent + children, e.g. "leadership-lessons"
        name: z.string(),  // human label shown in UI
        part: z.number().int().positive().optional(), // present on children only
      })
      .optional(),
  }),
});

export const collections = { insights };
