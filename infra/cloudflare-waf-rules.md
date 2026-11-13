# Cloudflare WAF custom rules (signal-to-noise.co)

Free plan: 5 custom rules, 1 rate-limiting rule. Managed rules are paid.
Dashboard: Security → Security rules → Custom rules.

## 1. Block vulnerability-scanner paths — deployed 9 Sep 2026, action Block, Active

```
(lower(http.request.uri.path) contains ".env") or
(lower(http.request.uri.path) contains "wp-") or
(lower(http.request.uri.path) contains ".php") or
(lower(http.request.uri.path) contains "/actuator") or
(lower(http.request.uri.path) contains ".bak") or
(lower(http.request.uri.path) contains "/.git")
```

Why: 404s were 30–40% of all requests on a normal day and 18.5k in the week to
9 Sep, almost all scanners probing for exposed app-server files (12k `curl/8.7.1`
requests from 185.177.72.0/24 on 8 Sep alone). The site is static; none of its
URLs match these patterns (checked against `dist/` before deploying). Blocking at
the edge keeps the probes off the e2-micro origin.

Verified after deploy: `/`, sitemap, robots, essays and `_astro` assets → 200;
`/.env`, `/admin/static/db%2eenv`, `/wp-login.php`, `/actuator/health`,
`/backup.bak`, `/.git/config` → 403.

If a legitimate URL ever needs one of these substrings, edit the rule rather than
disabling it. Bot Fight Mode deliberately NOT enabled: it cannot be scoped on the
free plan and would challenge deploy.sh's curl checks.

## AI crawlers: policy lives in robots.txt; check the dashboard

Owner decision, 13 Nov 2026: AI search and answer assistants are allowed
(OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot,
Perplexity-User), because they quote and link back. AI training crawlers are
disallowed in `public/robots.txt` (GPTBot, ClaudeBot, anthropic-ai,
Google-Extended, Applebot-Extended, CCBot, Meta-ExternalAgent,
cohere-training-data-crawler, Bytespider). Google-Extended and
Applebot-Extended are opt-out tokens, not separate crawlers, so they can only
be handled in robots.txt; never block Googlebot or Applebot at the edge.

robots.txt has no effect if Cloudflare blocks the allowed bots at the edge.
Confirm, in the dashboard:

- **AI Crawl Control** (formerly AI Audit): the search and answer assistants
  above are *Allow*, not *Block*.
- **Security → Settings → AI Crawler and Agent access policies**: Search,
  Training and Agents all "Allow (do not block)" as of 13 Nov 2026 (training
  crawlers are refused by robots.txt, not at the edge).
- **Bot Fight Mode was found ON on 13 Nov 2026**, contrary to the note above.
  Allowed bots and normal browsers still got 200 that day; left as is pending
  the owner's decision.
- **Managed robots.txt** is off, or it will prepend Disallow rules for AI
  crawlers to the file the origin serves.

Quick check: `curl -A "OAI-SearchBot/1.0" -I https://signal-to-noise.co/` should
return 200, not 403, and `curl https://signal-to-noise.co/robots.txt` should
match `public/robots.txt`.

## 2. Block non-compliant scrapers — deployed 13 Nov 2026, action Block, Active

Action Block. For scrapers known to ignore robots.txt and send no readers:

```
(http.user_agent contains "Bytespider") or
(http.user_agent contains "ImagesiftBot") or
(http.user_agent contains "PetalBot") or
(http.user_agent contains "Scrapy")
```

Added in the dashboard (the tokens in `.env` can only purge cache and read
analytics). The dashboard preview showed 1.99k matching requests (3.2% of all
traffic) in the 30 days before deploy.

Verified after deploy: Bytespider, PetalBot, Scrapy and ImagesiftBot user
agents → 403; OAI-SearchBot, Claude-User, Googlebot and a normal Safari UA → 200.
