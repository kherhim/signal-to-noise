import { getCollection, type CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'insights'>;

/* Acronyms and special cases that don't follow simple title-casing.
   Tags are kebab-case in frontmatter; the URL slug matches that. */
const ACRONYMS: Record<string, string> = {
  cfo: 'CFO',
  ai: 'AI',
  ipo: 'IPO',
  'fp-and-a': 'FP&A',
  'capital-markets': 'Capital Markets',
};

/** Human label for a kebab-case tag. "fp-and-a" → "FP&A", "leadership" → "Leadership". */
export function formatTag(tag: string): string {
  if (ACRONYMS[tag]) return ACRONYMS[tag];
  return tag
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Fetch all non-draft insights in prod; include drafts in dev. */
export async function getPublishedInsights(): Promise<Post[]> {
  return getCollection('insights', ({ data }) => import.meta.env.DEV || !data.draft);
}

/** Tag → article count, sorted by count desc then alphabetical. */
export async function getTagCounts(): Promise<{ tag: string; count: number }[]> {
  const posts = await getPublishedInsights();
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.tags ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));
}

/** Posts that share at least one tag with the given post, scored by overlap
    then by recency. Returns top N (default 3), excluding the post itself.
    Falls back to most-recent posts when the given post has no tags or no
    tag-overlap candidates exist. */
export async function getRelatedPosts(post: Post, n = 3): Promise<Post[]> {
  const all = await getPublishedInsights();
  const others = all.filter((p) => p.id !== post.id);
  const postTags = new Set(post.data.tags ?? []);

  if (postTags.size === 0) {
    return others
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .slice(0, n);
  }

  const scored = others
    .map((p) => ({
      post: p,
      overlap: (p.data.tags ?? []).filter((t) => postTags.has(t)).length,
    }))
    .filter((x) => x.overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        b.post.data.date.getTime() - a.post.data.date.getTime(),
    );

  if (scored.length >= n) return scored.slice(0, n).map((x) => x.post);

  // Top-up with most-recent non-overlap posts if overlap pool is thin.
  const chosen = new Set(scored.map((x) => x.post.id));
  const fillers = others
    .filter((p) => !chosen.has(p.id))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .slice(0, n - scored.length);

  return [...scored.map((x) => x.post), ...fillers];
}
