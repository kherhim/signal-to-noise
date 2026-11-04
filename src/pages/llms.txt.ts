/* /llms.txt (https://llmstxt.org): a plain-text map of the site for AI
   assistants and their crawlers. Built from the insights collection, so a
   new essay appears here on the next build. */
import { getCollection } from 'astro:content';
import { SITE_URL } from '../lib/schema';

export async function GET() {
  const posts = (await getCollection('insights', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );

  const line = (p: (typeof posts)[number], indent = '') =>
    `${indent}- [${p.data.title}](${SITE_URL}/insights/${p.id}/): ${p.data.seoDescription ?? p.data.excerpt}`;

  /* Series children hang, in part order, under their parent. A child whose
     parent is unpublished is listed at the top level instead. */
  const isChild = (p: (typeof posts)[number]) => p.data.series?.part !== undefined;
  const parentIds = new Set(posts.filter((p) => p.data.series && !isChild(p)).map((p) => p.data.series!.id));
  const essays: string[] = [];
  for (const p of posts) {
    if (isChild(p) && parentIds.has(p.data.series!.id)) continue;
    essays.push(line(p));
    if (p.data.series && !isChild(p)) {
      posts
        .filter((c) => isChild(c) && c.data.series!.id === p.data.series!.id)
        .sort((a, b) => a.data.series!.part! - b.data.series!.part!)
        .forEach((c) => essays.push(line(c, '  ')));
    }
  }

  const body = `# Signal to Noise

> Essays on finance, AI and capital strategy by Himanshu Kher, a CFO with 25+ years across trading, fintech and digital assets.

## Essays
${essays.join('\n')}

## Trackers
- [AI token prices](${SITE_URL}/trackers/ai-token-prices/): what nine AI labs charge per million tokens for their budget, flagship and premium models, tracked monthly.
- [Hyperscaler cash](${SITE_URL}/trackers/hyperscaler-cash/): what the five largest builders of AI data centres spend, the cash their businesses generate and how they fund the gap, updated after every earnings season.

## Series
- [Buffett](${SITE_URL}/buffett/): sixty-six years of Warren Buffett's letters read through a CFO's lens, with one line from every letter and a search across them all.

## About
- [Himanshu Kher](${SITE_URL}/about/)
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
