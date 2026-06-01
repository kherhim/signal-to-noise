import { getCollection, type CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'insights'>;

/* Unified listing item — either a standalone post or a grouped series.
   Used by /insights and /insights/tag/[tag] via the PostList component. */
export type ListItem =
  | { type: 'post'; post: Post; sortDate: number }
  | {
      type: 'series';
      parent: Post;
      // Children that satisfy the current filter (e.g. carry the tag
      // being browsed). On /insights this is the full child set.
      children: Post[];
      // Total children in the series globally — lets the UI distinguish
      // "all parts on this topic" from "3 of 10 parts on this topic".
      totalChildren: number;
      sortDate: number;
    };

/* Group a set of posts for list rendering, surfacing series structure.
   - `posts` is the filtered working set to display.
   - `allPosts` is the full corpus, needed so we can resolve a series's
     parent even when only its children are in the working set.
   A series is surfaced if any of its members (parent or child) is in
   `posts`. The parent is always used as the visual header for context.
   Only children in the working set are indented underneath. Posts not
   part of any rendered series block fall through to flat entries. */
export function groupPostsForListing(posts: Post[], allPosts: Post[]): ListItem[] {
  const inSet = new Set(posts.map((p) => p.id));

  // Collect every series id that has at least one member in the set.
  const seriesIds = new Set<string>();
  for (const p of posts) {
    if (p.data.series?.id) seriesIds.add(p.data.series.id);
  }

  const items: ListItem[] = [];
  const handled = new Set<string>();

  for (const sid of seriesIds) {
    const members = allPosts.filter((p) => p.data.series?.id === sid);
    const parent = members.find((p) => p.data.series?.part === undefined);
    const allChildren = members
      .filter((p) => p.data.series?.part !== undefined)
      .sort((a, b) => (a.data.series!.part ?? 0) - (b.data.series!.part ?? 0));

    // Orphan series (no parent visible globally) — fall through to flat.
    if (!parent) continue;

    const matchingChildren = allChildren.filter((c) => inSet.has(c.id));

    const dates = [
      parent.data.date.getTime(),
      ...allChildren.map((c) => c.data.date.getTime()),
    ];
    items.push({
      type: 'series',
      parent,
      children: matchingChildren,
      totalChildren: allChildren.length,
      sortDate: Math.max(...dates),
    });

    handled.add(parent.id);
    matchingChildren.forEach((c) => handled.add(c.id));
  }

  // Flat posts — every post in the set that wasn't absorbed into a series block.
  for (const p of posts) {
    if (handled.has(p.id)) continue;
    items.push({ type: 'post', post: p, sortDate: p.data.date.getTime() });
  }

  items.sort((a, b) => b.sortDate - a.sortDate);
  return items;
}

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
