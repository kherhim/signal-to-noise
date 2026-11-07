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

## AI crawlers — not blocked here; check the dashboard

`public/robots.txt` explicitly allows GPTBot, ClaudeBot, PerplexityBot,
Google-Extended and Applebot-Extended (Nov 2026). The site wants to be read
and cited by AI assistants. None of the custom rules above match crawler
user agents, but robots.txt has no effect if Cloudflare blocks these bots at
the edge. Confirm, in the dashboard:

- **AI Crawl Control** (formerly AI Audit): each crawler above is *Allow*,
  not *Block*.
- **Security → Bots**: "Block AI bots" / "Block AI Scrapers and Crawlers" is
  off, and Bot Fight Mode stays off (see above).
- **Managed robots.txt** is off, or it will prepend Disallow rules for AI
  crawlers to the file the origin serves.

Quick check: `curl -A "GPTBot/1.1" -I https://signal-to-noise.co/` should
return 200, not 403, and `curl https://signal-to-noise.co/robots.txt` should
match `public/robots.txt`.
