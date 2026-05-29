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
    tags: z.array(z.string()).optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    // Where the article originated (imported from LinkedIn). Optional.
    sourceUrl: z.string().url().optional(),
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
