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

## AI crawlers: robots.txt plus edge UA blocks for training-only bots

Owner decision, 13 Nov 2026: AI search and answer assistants are allowed
(OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot,
Perplexity-User), because they quote and link back. AI training crawlers are
disallowed in `public/robots.txt` (GPTBot, ClaudeBot, anthropic-ai,
Google-Extended, Applebot-Extended, CCBot, Meta-ExternalAgent,
cohere-training-data-crawler, Bytespider). Google-Extended and
Applebot-Extended are opt-out tokens, not separate crawlers, so they can only
be handled in robots.txt; never block Googlebot, Bingbot or Applebot at the
edge.

On 13 Nov 2026, Training was set to Block in Security → Settings → AI Crawler
and Agent access policies. From mid-September 2026 Cloudflare treats Googlebot,
Bingbot and Applebot as mixed-purpose Search+Training crawlers, so Block also
returns 403 to verified search crawlers. That showed up in Search Console
from 17 Nov (“Blocked due to access forbidden (403)”), including `/` and
several essays. Spoofed Googlebot UAs still returned 200, which is why the
13 Nov curl check missed it.

Fix, 19 Nov 2026 (owner approved):

- **AI Crawler and Agent access policies:** Search remains Allow (API:
  `ai_search: disabled`), Training is **Disallow** (`ai_training: disallow`),
  Agents remain Allow, every personal agent Allow. Bot Preference Sync stays
  **off** so Cloudflare never rewrites robots.txt. Managed robots.txt stays
  **off**. Bot Fight Mode stays **off**.
- Training **Disallow** without Bot Preference Sync does not edge-block
  training crawlers; edge blocking for those UAs is the custom WAF rule in
  section 2.

Verified 19 Nov 2026 after the change: Googlebot, OAI-SearchBot, ChatGPT-User
and a normal Safari UA → 200 on `/` and an essay; GPTBot and ClaudeBot → 403;
`/.env` → 403. A spoofed Googlebot UA is not a valid check that real Googlebot
is allowed; confirm with a Search Console live test, then Validate fix.

Quick check: `curl -A "OAI-SearchBot/1.0" -I https://signal-to-noise.co/` should
return 200, not 403, and `curl https://signal-to-noise.co/robots.txt` should
match `public/robots.txt`.

## 2. Block non-compliant scrapers and training-only crawlers — deployed 13 Nov 2026, training UAs added 19 Nov 2026, action Block, Active

Rule id `4ab9ebc7df994d03a163b85fc9067ec3`. Action Block. Original rule covered
scrapers known to ignore robots.txt and send no readers. On 19 Nov 2026 the
expression was extended with training-only user agents so they stay blocked at
the edge after Training was changed from Block to Disallow. Google-Extended
and Applebot-Extended are not user agents and are not in this rule. Search and
user-fetch bots (Googlebot, Bingbot, Applebot, OAI-SearchBot, ChatGPT-User,
Claude-User, PerplexityBot, etc.) are not in this rule.

```
(http.user_agent contains "Bytespider") or
(http.user_agent contains "ImagesiftBot") or
(http.user_agent contains "PetalBot") or
(http.user_agent contains "Scrapy") or
(lower(http.user_agent) contains "gptbot") or
(lower(http.user_agent) contains "claudebot") or
(lower(http.user_agent) contains "anthropic-ai") or
(lower(http.user_agent) contains "ccbot") or
(lower(http.user_agent) contains "meta-externalagent") or
(lower(http.user_agent) contains "cohere-training-data-crawler") or
(lower(http.user_agent) contains "diffbot") or
(lower(http.user_agent) contains "omgilibot") or
(lower(http.user_agent) contains "ai2bot") or
(lower(http.user_agent) contains "img2dataset")
```

Verified 19 Nov 2026: GPTBot and ClaudeBot → 403; Googlebot, OAI-SearchBot,
ChatGPT-User and a normal Safari UA → 200.
