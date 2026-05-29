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
  }),
});

const caseStudies = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/case-studies' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string(),
    client: z.string().optional(),
    tags: z.array(z.string()).optional(),
    externalLink: z.string().url().optional(),
  }),
});

export const collections = { insights, 'case-studies': caseStudies };
