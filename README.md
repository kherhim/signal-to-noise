# signal-to-noise.co

Personal site + insights blog. Astro · Tailwind · MDX. Live on a GCE VM
behind Cloudflare; mirrored to [hkher.substack.com](https://hkher.substack.com).

- Original project brief & design intent: [`signal2noise.md`](./signal2noise.md)
- Article conventions (linter-enforced): [`article-formatting.md`](./article-formatting.md)
- SEO phases: [`SEO-Plan.md`](./SEO-Plan.md) · Buffett series plan: [`buffett.md`](./buffett.md)

## Develop

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static output → ./dist (prebuild runs the title linter)
npm run preview      # serve the production build locally
```

Articles live in `src/content/insights/*.md`; frontmatter schema in
`src/content.config.ts`. Cover images in `public/img/` (WebP, mode 644).

## Release routine

The canonical order for shipping an article. The site is the canonical home;
Substack and LinkedIn are mirrors that point back to it — which is why the
site always publishes first.

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
`setdate <postId> <ISO date>` backdates a post after publishing.

### 3. LinkedIn — last

Announcement blurb opening with the publish signal ("I've just published…"),
linking the canonical site URL. Posted manually.

### Why this order

Both mirrors deep-link the canonical page, so it must be live before they go
out. Substack before LinkedIn so the LinkedIn audience landing on the site
finds the subscribe form backed by an already-populated archive.

## Lessons

Things that were genuinely non-obvious or worth remembering the next time the
site gets touched. Document the gotchas, not the obvious — if something is in
the code or git log, it doesn't need to be here.

### Deploy

- **The nginx webroot is `/var/www/signal-to-noise/dist/`, not the parent directory.** Rsyncing to the parent with `--delete` will silently wipe the `dist/` subdirectory and take the site down — every URL returns 404. The canonical deploy pair:
  ```
  ssh: rm -rf /tmp/s2n-dist && mkdir /tmp/s2n-dist
  scp: dist/* → /tmp/s2n-dist/
  ssh: sudo rsync -a --delete /tmp/s2n-dist/ /var/www/signal-to-noise/dist/
  ```
- **scp does not delete files at the target.** Stale assets in `/tmp/s2n-dist/` survive across deploys and re-propagate via rsync. Always wipe the staging dir first.
- **Image files must be mode 644 before commit, not mode 600.** Nginx runs as `www-data` and can't read owner-only files. Returns 403 (not 404, which masks the cause). Check `ls -la public/img/` after dropping in a new image — should be `-rw-r--r--`. If it's `-rw-------`, `chmod 644 file.png` first.

### Image pipeline

- **PNG → WebP at quality 82 typically halves file size or better with no visible quality loss.** Real numbers from this site:
  | Source PNG | WebP @ q82 | Saving |
  |---|---|---|
  | 2.1 MB (IPO cover) | 122 KB | 94% |
  | 425 KB (600-year curve) | 68 KB | 84% |
  | 178 KB (portrait JPG) | 21 KB | 88% |
  | 24 KB (curiosity matrix) | 9 KB | 62% |
- Command: `cwebp -q 82 input.png -o output.webp`. To downsize at the same time: `-resize 600 0` for 600px wide, height auto.
- **600px wide is enough for most article hero images** at the current 720px max content column. Don't ship 1200px when 600 looks the same.
- After conversion, **delete the source PNG/JPG** to avoid both files in the bundle. Update the frontmatter `coverImage:` path to the `.webp`.

### Cloudflare

- **Don't orange-cloud MX, TXT, or DKIM CNAME records.** Cloudflare's HTTP proxy doesn't handle email. Email records (Fastmail) must stay on grey cloud (DNS only). Only the `A` records for `signal-to-noise.co` and `www` should be proxied.
- **SSL mode must be Full (strict)** in the CF dashboard. The default "Flexible" sends HTTP edge-to-origin and breaks HTTPS. Full (strict) validates the LE cert on the GCE VM and keeps end-to-end encryption.
- **The origin's Let's Encrypt cert (Certbot) is still load-bearing** even with CF in front. Don't retire it. CF Full (strict) validates against it.
- **Cloudflare Web Analytics in proxied mode is server-side** — no JS beacon needed in BaseLayout. Ad-blockers can't strip it. Less accurate beacon mode is only needed when DNS isn't on CF.
- **HTML isn't cached by CF by default** (`cf-cache-status: DYNAMIC`). Static assets (`.webp`, `.js`, `.css`, fonts) are cached at the edge, sometimes for hours. After a deploy that changes assets, edge cache may serve stale content. Open follow-up: add a CF cache-purge API call to the deploy chain.

### Substack mirror

- **No official API.** `scripts/substack-post.mjs` drives the private dashboard endpoints (`/api/v1/drafts`) with the `substack.sid` session cookie. Stable for years (python-substack wraps the same), but unofficial — if a call 404s, cross-check https://github.com/ma2za/python-substack.
- **Substack rewrites slugs from titles** (`leadership-lessons-i-wish-knew-earlier` → `/p/leadership-lessons-i-wish-i-knew`) and curls straight quotes in titles — don't exact-match titles against hook files when verifying.
- **The archive list API caches aggressively.** Verify a post via `/api/v1/posts/<slug>`, not the archive listing.
- **Rate limit: ~35 rapid calls → 429.** Space batch operations ≥6s apart.

### Sandbox / workflow gotchas

- The harness can't read files from `~/Downloads/`. To get an image into the project, drop it manually into `public/img/` via Finder, or `! cp` it from the terminal.
- Terminals wrap pasted commands with long paths and can break them silently. Paste as one line; avoid line-breaks in path arguments.
- Astro's ClientRouter view transitions don't re-run inline `<script>` blocks. Any DOM-binding script must listen on `astro:page-load` and idempotently bind (`if (el.dataset.bound) return`).

### SEO setup

- **Phase ordering matters.** Get GSC + analytics live BEFORE doing topic structure or content polishing. Without measurement, every later change is guesswork.
- **GSC verification has multiple tabs** (HTML file, HTML tag, Google Analytics, DNS). The error "verification file was not found" comes from the HTML file tab. If you've shipped a meta tag, you must verify under the HTML tag tab, not HTML file.
- **GSC sitemap submission**: just type `sitemap-index.xml` in the box — the domain prefix is already filled in.
- **Buying the domain through Cloudflare Registrar pre-stages the proxy upgrade.** DNS is already on Cloudflare nameservers; flipping the orange cloud is one click.
- **GSC and Cloudflare Web Analytics measure different things and pair, not overlap:**
  - GSC: pre-arrival (search impressions, queries, CTR, average position, indexing status)
  - CF Web Analytics: post-arrival (pageviews, top pages, referrers, country)
- **Bing Webmaster Tools imports from GSC in one click** — skip the verification dance. Bing powers DuckDuckGo, Copilot, ChatGPT search.

### Content style

- **Sentence case is the modern blogging convention.** First word capitalized, first word after a clause boundary (colon, em-dash, sentence-end) capitalized, everything else lowercase unless on the proper-noun/acronym allowlist.
- **Proper nouns and acronyms allowlisted** in `scripts/lint-titles.mjs`: CFO, AI, FP&A, M&A, IPO, KPIs, GPT, ChatGPT, GenAI, OpenAI, Anthropic, SpaceX, Father Time, Fintech, I/I'm/I've/I'd/I'll, days, months, region codes.
- **The lint runs on every build** as `prebuild`. New title that violates the rule fails the build before it deploys.
- **Single-article tag pages are fine.** Don't gate tag pages behind a minimum article count — a newly seeded topic with one article still signals to readers and Google that the topic exists in the corpus.
- **Series should stay grouped across all tag pages.** Flat-listing 10 series children as 10 separate cards breaks the relationship. Show the parent as the visual header; indent only the children that match the current filter; surface a count when the filter covers a subset.

### OG and sharing

- **Per-article OG image is the highest-leverage SEO + social fix.** Adds maybe an hour of one-time engineering (which we shipped); doubles LinkedIn/X share preview quality forever. The `coverImage` frontmatter field flows to `<meta property="og:image">` automatically.
- **Default OG image (`og-default.png`) is the cheapest next graphic to commission.** Covers homepage, /about, /contact, and any article without a cover.
- **Skip third-party share widgets** (ShareThis, AddThis, Shareaholic). They're heavy JS, track readers, and hurt page speed. Plain intent links are 30 lines of HTML and do the same job:
  - LinkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=…`
  - X: `https://twitter.com/intent/tweet?url=…&text=…`
  - Email: `mailto:?subject=…&body=…`
  - Copy link: `navigator.clipboard.writeText(…)` with a textarea fallback
- **For sharing, position matters less than presence.** Bottom of article is the safe default — natural "finished reading, now share" moment.

### Engineering patterns

- **Shared utilities beat inlined logic** when the same operation runs from multiple pages. The `src/lib/tags.ts` module backs `/insights`, every `/insights/tag/[tag]/`, and the related-insights footer with one source of truth.
- **A small Astro component** (`PostList.astro`) beats duplicating ~80 lines of JSX across two pages. When you find yourself copy-pasting a section, extract.
- **Build-time lint as a gate** is cheap insurance. The title linter caught regressions during the sentence-case migration and now blocks any future titled-case title from shipping.
- **Frontmatter is the right place for per-article metadata** (cover image, alt, series id, source URL). Don't hardcode in the article body; the rendering layer reads the frontmatter.

### Process / philosophy

- **Voice and judgment are the moat, not keyword density.** SEO hygiene matters (titles, metadata, structure) but the real lift for a personal essay site comes from clear audience positioning and authority signals (named author, real bio, corpus depth).
- **Pair every SEO change with measurement.** Without GSC, "did Phase 2 move impressions?" is unanswerable. With GSC, you have a feedback loop.
- **Strip ceremony.** When the original LinkedIn imports had `[cite:N]` markers, the right call was "strip them, ship it" — perfect is the enemy of shipped.
- **RSS subscribers aren't yours; emails are.** The Substack mirror exists to build the email list as a portable asset — full content stays canonical on the domain; Substack gets condensed summaries linking back.
