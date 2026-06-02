import { getCollection, type CollectionEntry } from 'astro:content';

type Post = CollectionEntry<'insights'>;

export interface Topic {
  slug: string;
  /** Human-readable name, used in the H1 and nav. */
  title: string;
  /** Short SEO description for <meta name="description"> on the topic page. */
  description: string;
  /** Editorial intro shown beneath the H1. 2-3 sentences in the site's voice. */
  framing: string;
  /** Ordered list of 2-5 article slugs that anchor this pillar.
      Rendered as large cards with cover images at the top of the page. */
  cornerstoneSlugs: string[];
  /** Ordered list of additional article slugs surfaced beneath cornerstones. */
  furtherSlugs: string[];
}

/* Hand-curated pillars. New pillar = new entry here + the
   /topics/[topic].astro dynamic route picks it up automatically. */
export const TOPICS: Topic[] = [
  {
    slug: 'cfo-and-ai',
    title: 'CFO & AI',
    description:
      "How the CFO function changes — and doesn't — under AI. Essays on the long arc, the practical workflows, and the leadership challenges.",
    framing:
      "AI is the most consequential shift in the CFO's operating environment in a generation. The interesting question isn't whether finance gets automated — it's what the senior finance role becomes when reporting is a free good. The essays below work through the implications, from the long history that explains why this isn't unprecedented to the practical question of which LLM-driven workflows actually save a CFO's time.",
    cornerstoneSlugs: [
      '600-year-curve-why-your-ai-anxiety-actually-history-repeating',
      'using-llms-cheat-sheet-cfos',
      'leadership-era-genai',
    ],
    furtherSlugs: [
      'future-gpt',
      'from-bean-counting-bots',
      'evolving-financial-analytics-navigating-beyond-traditional',
      'where-wai',
      'crowdsourcing-financial-decisions-when-more-cooks-may',
    ],
  },
  {
    slug: 'capital-strategy',
    title: 'Capital strategy',
    description:
      'How CFOs read public markets, IPOs, M&A, and capital structure. Essays on signal versus hype, deal-making, and treasury craft.',
    framing:
      "Public markets, M&A, treasury, capital structure: this is where CFOs earn their pay. The job isn't to predict the cycle but to read it — what's signal, what's hype, and how to price what you can't predict. The essays below run from a landmark cohort of upcoming IPOs to the often-unglamorous work of treasury and how to think about flexibility in a plan.",
    cornerstoneSlugs: [
      'pricing-the-future-spacex-anthropic-openai-ipos',
      'how-cfos-should-think-ma-balancing-risk-opportunity',
      'importance-treasurers-finance',
    ],
    furtherSlugs: [
      'high-wire-acts-high-finance-cfos-circus-growth-vs-cash',
      'should-cfos-build-strategic-flexibility-opposed-plans',
      'what-keeps-fintech-cfo-up-night-hint-its-just-burn-rate',
      'every-cfo-greedy-just-what-theyre-real-question',
    ],
  },
];

/** Resolve an ordered list of post slugs against the insights
    collection, preserving the order specified in the input. Slugs
    that don't resolve to a published article are silently dropped
    so a typo or a deleted post can't crash the build. */
export async function resolveTopicPosts(slugs: string[]): Promise<Post[]> {
  const all = await getCollection(
    'insights',
    ({ data }) => import.meta.env.DEV || !data.draft,
  );
  const byId = new Map(all.map((p) => [p.id, p]));
  return slugs.map((s) => byId.get(s)).filter((p): p is Post => p !== undefined);
}
