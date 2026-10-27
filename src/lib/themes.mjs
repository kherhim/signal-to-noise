/* Homepage themes: each essay sits in one of four, derived from its tags
   unless frontmatter sets `theme`. Plain ESM so node:test can import it. */

export const THEMES = [
  { key: 'ai', label: 'AI and the finance function', short: 'AI', color: '#3F86D0', all: '/insights/tag/ai' },
  { key: 'cap', label: 'Capital, markets and Buffett', short: 'Capital and markets', color: '#C0822A', all: '/insights/tag/capital-markets' },
  { key: 'fpa', label: 'FP&A and budgets', short: 'FP&A and budgets', color: '#3FA58C', all: '/insights/tag/fp-and-a' },
  { key: 'lead', label: 'Leadership', short: 'Leadership', color: '#d8d2c4', all: '/insights/tag/leadership' },
];

const CAPITAL = ['buffett', 'capital-markets', 'ipo', 'capital-allocation'];
const FPA = ['fp-and-a', 'budgeting', 'cost-structure', 'finance'];

export function themeOf({ tags = [], series, theme } = {}) {
  if (theme) return theme;
  if (series) return 'lead';
  if (tags.some((t) => CAPITAL.includes(t))) return 'cap';
  if (tags.includes('ai')) return 'ai';
  if (tags.some((t) => FPA.includes(t))) return 'fpa';
  return 'lead';
}

// posts: newest first, series children already removed.
export function homepagePlan(posts, leadId, { latest = 5, perRail = 6 } = {}) {
  const lead = posts.find((p) => p.id === leadId) ?? posts[0];
  const used = new Set([lead.id]);
  const take = (list, n) => { const out = list.filter((p) => !used.has(p.id)).slice(0, n); out.forEach((p) => used.add(p.id)); return out; };
  const latestItems = take(posts, latest);
  const rails = THEMES.map((theme) => ({ theme, items: take(posts.filter((p) => themeOf(p.data) === theme.key), perRail) }));
  return { lead, latest: latestItems, rails };
}
