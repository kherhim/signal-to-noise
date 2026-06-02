# Article formatting

> **Living document — work in progress.** These rules reflect the conventions in place as of 2026-06-02. As new articles surface patterns the existing rules don't cover (a new acronym to allowlist, a new structural element like a callout block, a new label style), update this file and the relevant enforcement script. Don't treat this as final.

The conventions every article on signal-to-noise.co follows. These are enforced by the build-time linter (`scripts/lint-titles.mjs`) for titles and were applied retroactively across the corpus by the body/heading/label scripts. Future articles should ship in this shape from the start.

---

## 1. Sentence case — the universal rule

Every visible label or heading uses **sentence case**, not title case:

- ✅ `Pricing the future: How CFOs should read the SpaceX, Anthropic and OpenAI IPOs`
- ❌ `Pricing The Future: How CFOs Should Read The SpaceX, Anthropic And OpenAI IPOs`

**What counts as a label or heading:**

| Surface | Examples | Rule |
|---|---|---|
| **Article title** (frontmatter `title:`) | `Output vs. outcome` | First letter of the title is capital. After every colon, em-dash, en-dash, period, `?`, `!`, or `;`, the next first letter is also capital (it's the start of a new clause). Everything else lowercase **unless** allowlisted. |
| **Subheadings** (`##`, `###`, `####`) | `## Effective cash & strategic funding` | Same rule. |
| **Bullet / numbered list labels** (the part before the colon when the item is `label: body`) | `- **The id and financial impulsivity:** body…` | Same rule. **Plus** the label is bolded inline with `**…:**` (closing bold sits inside the colon's right boundary). |

**Allowlist of proper nouns / acronyms that stay capitalised** (single token unless noted multi-word):

```
CFO, CFOs, CFO's        CEO, CEOs        CTO, CTOs        COO, COOs
FP&A, M&A, P&L          IPO, IPOs        EBITDA           KPI, KPIs
CX, ROI

AI, AIs                 GPT              LLM, LLMs        ChatGPT
GenAI                   ML               API, APIs

OpenAI, Anthropic, SpaceX, Microsoft, Google, Apple, Meta,
Amazon, Netflix, Tesla, NVIDIA, Salesforce, LinkedIn

I, I'm, I've, I'd, I'll       (English pronouns)
wAI                            (deliberate wordplay)
Fintech, Fintechs              (style choice)

Stockdale, Porat, Ruth, Freud, Freudian       (named individuals)
Multi-word: Father Time, Ruth Porat

TLDR
Days: Monday…Sunday
Months: January…December
Codes: US, USA, UK, EU, NYC, SF, APAC, EMEA
Quarters: Q1, Q2, Q3, Q4
```

To add a new proper noun, edit `scripts/lint-titles.mjs` — the `ALLOWLIST` (single tokens) or `MULTI_WORD_ALLOWLIST` (sequences) constants near the top of the file.

---

## 2. Headings

- Use exactly **one space** after the `#` characters: `## Foo`, never `##  Foo`.
- Heading hierarchy: `##` for major sections; `###` for sub-sections; `####` for sub-sub. Don't skip levels.
- Don't include trailing punctuation in headings (no period at the end).
- Avoid headings that look like list items — if you find yourself writing `1. Foo: body…` as a heading, you probably want a numbered list with a bold label instead. See §3.

---

## 3. Bullet & numbered lists

Two patterns supported:

### A. Bare list (no label)

Use when items don't need a sub-label:

```markdown
- Short point one.
- Short point two.
- Short point three.
```

Or numbered:

```markdown
1. First step.
2. Second step.
3. Third step.
```

### B. Labelled list (`label: body`)

Use when each item has a discrete concept name followed by an explanation. **Bold the label and sentence-case it.**

```markdown
- **The id and financial impulsivity:** The id, driven by the pleasure principle…
- **The ego and risk management:** The ego, governed by the reality principle…
- **The superego and ethical decision making:** The superego holds moral standards…
```

Or numbered:

```markdown
1. **Capital allocation:** Balancing launch, Starlink expansion, and long-dated projects…
2. **Governance and control:** Elon Musk's influence, dual-class structures…
3. **Risk profile:** Regulatory, launch failure, and geopolitical risk…
```

**Never** promote a labelled list item to a heading. The list shape stays a list; the label gets bold + sentence case treatment.

---

## 4. Frontmatter shape

Every article's frontmatter contains:

```yaml
---
title: "<sentence-cased title>"
date: <YYYY-MM-DD>
excerpt: "<one or two sentences, ~140-220 chars, ends with an ellipsis if mid-thought>"
tags: ["<tag1>", "<tag2>", "..."]
draft: false
sourceUrl: "<original publication URL, optional>"
coverImage: /img/<slug>.webp
coverImageAlt: "<descriptive alt text, ~200-400 chars, written from the visual>"
---
```

**Tags** are one of the canonical 10: `teams`, `cfo`, `leadership`, `strategy`, `risk`, `fp-and-a`, `ai`, `reflections`, `ipo`, `capital-markets`. Pick the 3–6 most relevant. New tags are allowed but should describe a real new topic.

**Slug** = the article markdown filename without `.md`. It also becomes the URL: `/insights/<slug>/`.

---

## 5. Cover images

- Hero image goes in `public/img/<slug>.webp`.
- Source PNG/JPG → WebP via `cwebp -q 82 -resize 1200 0 input.png -o <slug>.webp`. Target file size: 50–150 KB.
- Delete the source PNG after conversion.
- Permissions must be `644` (`-rw-r--r--`). The build can't serve files mode-600'd to the user.
- `coverImageAlt` describes the visual content for screen readers and OG previews. ~200–400 chars. Mention text overlays, scene composition, colours, key icons.

---

## 6. Body conventions

- Em-dash `—` (U+2014) for asides, parenthetical interjections. Don't use ` -- ` or ` - `.
- En-dash `–` (U+2013) for ranges like `2010–2015`.
- Curly quotes `' ' " "` allowed; straight quotes also fine — be consistent within an article.
- Code blocks: triple-backtick fences. Skip indentation-based code blocks.
- Internal links to other articles: `/insights/<slug>` (no domain, no trailing slash optional but preferred without).
- Inline emphasis: `*italic*` for stress, `**bold**` for terminology / labels. Don't combine `***triple***`.
- Tables: GitHub-flavored markdown with leading and trailing pipes. Render via Prose.astro's table CSS.
- Blockquotes (`>`) for verbatim quotations, third-party text, or set-aside framing. Use sparingly.

---

## 7. Series (multi-part articles)

If an article is part of a series, add a `series:` block to frontmatter:

```yaml
series:
  id: leadership-lessons       # shared across parent + children
  name: Leadership lessons     # human label shown in UI
  part: 3                       # children only; parent omits this field
```

Parents are the umbrella post; children are individual parts. Both stay in the same `tag` chips. See `src/lib/topics.ts` and the rendering in `src/components/PostList.astro` for series-grouping behaviour on tag pages and the insights index.

---

## 8. Where the rules are enforced

| Rule | Where | When |
|---|---|---|
| Title sentence case + allowlist | `scripts/lint-titles.mjs` | Prebuild gate (build fails if a title violates) |
| Heading sentence case + heading-space collapse | One-shot script `/tmp/reformat-rollout.py` | Run manually when adding a batch of articles imported from elsewhere |
| Bullet/numbered label bold + sentence case | Same one-shot script | Same |
| Frontmatter shape | Content collection schema in `src/content.config.ts` | Build fails if required fields missing or wrong type |
| Cover image mode 644 | Manual check before commit | `ls -la public/img/<slug>.webp` |

If you write a new article by hand in this shape from the start, the linter passes and you don't need to run any reformat script.

---

## 9. Quick checklist before publishing

- [ ] Title is sentence-cased, ~6–14 words, no trailing punctuation
- [ ] First paragraph reads as a hook — not a "Hi, today I'll talk about…"
- [ ] Subheadings are sentence-cased and don't skip levels
- [ ] Labelled lists use `- **Foo bar:** body…` not `- Foo Bar: body…`
- [ ] 2–6 tags from the canonical set
- [ ] Cover image present (`/img/<slug>.webp`), 50–150 KB, mode 644
- [ ] `coverImageAlt` written from the visual (not a placeholder)
- [ ] `npm run build` passes locally — title linter is happy
- [ ] Internal cross-links use `/insights/<slug>` form, not LinkedIn URLs
