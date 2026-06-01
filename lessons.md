# Lessons

Captured from the 2026-06-01 build session. Things that were genuinely non-obvious or that I'd want to remember the next time I touch the site.

---

## Deploy

- **The nginx webroot is `/var/www/signal-to-noise/dist/`, not the parent directory.** Rsyncing to the parent with `--delete` will silently wipe the `dist/` subdirectory and take the site down — every URL returns 404. The canonical deploy pair:
  ```
  ssh: rm -rf /tmp/s2n-dist && mkdir /tmp/s2n-dist
  scp: dist/* → /tmp/s2n-dist/
  ssh: sudo rsync -a --delete /tmp/s2n-dist/ /var/www/signal-to-noise/dist/
  ```
- **scp does not delete files at the target.** Stale assets in `/tmp/s2n-dist/` survive across deploys and re-propagate via rsync. Always wipe the staging dir first.
- **Image files must be mode 644 before commit, not mode 600.** Nginx runs as `www-data` and can't read owner-only files. Returns 403 (not 404, which masks the cause). Check `ls -la public/img/` after dropping in a new image — should be `-rw-r--r--`. If it's `-rw-------`, `chmod 644 file.png` first.

## Image pipeline

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

## Cloudflare (in front of origin since today)

- **Don't orange-cloud MX, TXT, or DKIM CNAME records.** Cloudflare's HTTP proxy doesn't handle email. Email records (Fastmail) must stay on grey cloud (DNS only). Only the `A` records for `signal-to-noise.co` and `www` should be proxied.
- **SSL mode must be Full (strict)** in the CF dashboard. The default "Flexible" sends HTTP edge-to-origin and breaks HTTPS. Full (strict) validates the LE cert on the GCE VM and keeps end-to-end encryption.
- **The origin's Let's Encrypt cert (Certbot) is still load-bearing** even with CF in front. Don't retire it. CF Full (strict) validates against it.
- **Cloudflare Web Analytics in proxied mode is server-side** — no JS beacon needed in BaseLayout. Ad-blockers can't strip it. Less accurate beacon mode is only needed when DNS isn't on CF.
- **HTML isn't cached by CF by default** (`cf-cache-status: DYNAMIC`). Static assets (`.webp`, `.js`, `.css`, fonts) are cached at the edge, sometimes for hours. After a deploy that changes assets, edge cache may serve stale content. Open follow-up: add a CF cache-purge API call to the deploy chain.

## Sandbox / workflow gotchas

- The harness can't read files from `~/Downloads/`. To get an image into the project, drop it manually into `public/img/` via Finder, or `! cp` it from the terminal.
- Terminals wrap pasted commands with long paths and can break them silently. Paste as one line; avoid line-breaks in path arguments.
- Astro's ClientRouter view transitions don't re-run inline `<script>` blocks. Any DOM-binding script must listen on `astro:page-load` and idempotently bind (`if (el.dataset.bound) return`).

## SEO setup

- **Phase ordering matters.** Get GSC + analytics live BEFORE doing topic structure or content polishing. Without measurement, every later change is guesswork.
- **GSC verification has multiple tabs** (HTML file, HTML tag, Google Analytics, DNS). The error "verification file was not found" comes from the HTML file tab. If you've shipped a meta tag, you must verify under the HTML tag tab, not HTML file.
- **GSC sitemap submission**: just type `sitemap-index.xml` in the box — the domain prefix is already filled in.
- **Buying the domain through Cloudflare Registrar pre-stages the proxy upgrade.** DNS is already on Cloudflare nameservers; flipping the orange cloud is one click.
- **GSC and Cloudflare Web Analytics measure different things and pair, not overlap:**
  - GSC: pre-arrival (search impressions, queries, CTR, average position, indexing status)
  - CF Web Analytics: post-arrival (pageviews, top pages, referrers, country)
- **Bing Webmaster Tools imports from GSC in one click** — skip the verification dance. Bing powers DuckDuckGo, Copilot, ChatGPT search.

## Content style

- **Sentence case is the modern blogging convention.** First word capitalized, first word after a clause boundary (colon, em-dash, sentence-end) capitalized, everything else lowercase unless on the proper-noun/acronym allowlist.
- **Proper nouns and acronyms allowlisted** in `scripts/lint-titles.mjs`: CFO, AI, FP&A, M&A, IPO, KPIs, GPT, ChatGPT, GenAI, OpenAI, Anthropic, SpaceX, Father Time, Fintech, I/I'm/I've/I'd/I'll, days, months, region codes.
- **The lint runs on every build** as `prebuild`. New title that violates the rule fails the build before it deploys.
- **Single-article tag pages are fine.** Don't gate tag pages behind a minimum article count — a newly seeded topic with one article still signals to readers and Google that the topic exists in the corpus.
- **Series should stay grouped across all tag pages.** Flat-listing 10 series children as 10 separate cards breaks the relationship. Show the parent as the visual header; indent only the children that match the current filter; surface a count when the filter covers a subset.

## OG and sharing

- **Per-article OG image is the highest-leverage SEO + social fix.** Adds maybe an hour of one-time engineering (which we shipped); doubles LinkedIn/X share preview quality forever. The `coverImage` frontmatter field flows to `<meta property="og:image">` automatically.
- **Default OG image (`og-default.png`) is the cheapest next graphic to commission.** Covers homepage, /about, /contact, and any article without a cover.
- **Skip third-party share widgets** (ShareThis, AddThis, Shareaholic). They're heavy JS, track readers, and hurt page speed. Plain intent links are 30 lines of HTML and do the same job:
  - LinkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=…`
  - X: `https://twitter.com/intent/tweet?url=…&text=…`
  - Email: `mailto:?subject=…&body=…`
  - Copy link: `navigator.clipboard.writeText(…)` with a textarea fallback
- **For sharing, position matters less than presence.** Bottom of article is the safe default — natural "finished reading, now share" moment.

## Engineering patterns

- **Shared utilities beat inlined logic** when the same operation runs from multiple pages. The `src/lib/tags.ts` module now backs `/insights`, every `/insights/tag/[tag]/`, and the related-insights footer with one source of truth.
- **A small Astro component** (`PostList.astro`) beats duplicating ~80 lines of JSX across two pages. When you find yourself copy-pasting a section, extract.
- **Build-time lint as a gate** is cheap insurance. The title linter caught regressions during the sentence-case migration and now blocks any future titled-case title from shipping.
- **Frontmatter is the right place for per-article metadata** (cover image, alt, series id, source URL). Don't hardcode in the article body; the rendering layer reads the frontmatter.

## Process / Philosophy

- **Voice and judgment are the moat, not keyword density.** SEO hygiene matters (titles, metadata, structure) but the real lift for a personal essay site comes from clear audience positioning and authority signals (named author, real bio, corpus depth).
- **Pair every SEO change with measurement.** Without GSC, "did Phase 2 move impressions?" is unanswerable. With GSC, you have a feedback loop.
- **Strip ceremony.** When the original LinkedIn imports had `[cite:N]` markers, the right call was "strip them, ship it" — perfect is the enemy of shipped. Same logic for cover images: 47 articles still don't have them, and the site is fine.
- **Document the gotchas, not the obvious.** This file should be ~50 entries someday, not 500. If something is in the code or git log, it doesn't need to be here.
