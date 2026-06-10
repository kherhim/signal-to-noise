# Release routine

> **Living document.** The canonical order for shipping an article. The site is
> the canonical home; Substack and LinkedIn are mirrors that point back to it —
> which is why the site always publishes first.

## Order of operations

### 1. Site (canonical) — first, always

1. Drop the article `.md` into `src/content/insights/` and a matching cover
   image (same slug) into `public/img/`.
2. Run `./publish.sh` — converts images to WebP, validates frontmatter, builds
   (title linter runs via prebuild), prompts before `deploy.sh`.
3. Commit (selective add — publish.sh deliberately doesn't touch git).

### 2. Substack mirror — second

1. Write a condensed summary in `_sources/substack-hooks/<slug>.md`:
   frontmatter `title:` (exact article title) + `subtitle:` (≤140 chars), body
   preserving the article's H2 skeleton (one short paragraph per section;
   2–3 paragraphs with no headings for short essays), ending with:

   `This is a condensed version. [Read the full piece at signal-to-noise.co →](https://signal-to-noise.co/insights/<slug>/)`

   Series posts: children open with
   `*Part N of X in the series* [Series name](parent canonical URL)`;
   the parent lists all parts as links to their canonical pages.
2. `node scripts/substack-post.mjs draft _sources/substack-hooks/<slug>.md`
3. Optionally review the draft in the Substack editor, then
   `node scripts/substack-post.mjs publish <draftId>` — email delivery is OFF
   by default; add `--send-email` only when the list should be notified.
4. Append `<slug> <draftId>` to `_sources/substack-hooks/draft-ids.txt`.

Auth is the `SUBSTACK_SID` cookie in `.env` (template: `.env.example`). It dies
when that browser session logs out — if calls start failing 401, re-grab it.
Substack rate-limits bursts (~35 rapid calls → 429): space batch calls ≥6s.

### 3. LinkedIn — last

Announcement blurb opening with the publish signal ("I've just published…"),
linking the canonical site URL. Posted manually.

## Why this order

Both mirrors deep-link the canonical page, so it must be live (and cache-warm)
before they go out. Substack before LinkedIn so the LinkedIn audience landing
on the site finds the subscribe form backed by an already-populated archive.
