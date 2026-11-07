# Next steps

The running to-do list for signal-to-noise.co. Say "what's next" in the repo
and Claude reads this file and walks you through the open items in order.
Tick an item (`- [x]`) when it is done; add new ones under a dated heading.

## Email signup on Beehiiv (PR #45, Nov 2026)

PR #45 is merged but not live. The form posts to `/api/subscribe`, which
needs the `signal-to-noise-subscribe` Worker. Until the Worker is up, that
path returns 404, so do these before the next site deploy. Details in the
README, "Newsletter signup (Beehiiv)".

- [ ] Beehiiv: create (or confirm) the publication, decide double opt-in and the welcome email.
- [ ] Beehiiv: add a text custom field named exactly `signup_location`.
- [ ] Beehiiv → Settings → API: create an API key; note it and the `pub_…` id.
- [ ] `npx wrangler login` (the current wrangler token has expired).
- [ ] `npx wrangler deploy`, then `npx wrangler secret put BEEHIIV_API_KEY` and `npx wrangler secret put BEEHIIV_PUBLICATION_ID`.
- [ ] Test: POST to `https://signal-to-noise.co/api/subscribe` with an address you control; it shows up in Beehiiv.

## SEO and AI visibility (PR #46, Nov 2026)

### Before merging
- [ ] Review the 38 drafted `seoDescription`s in the PR #46 table. Edit any that miss; the six flagged as weakest are listed under the table. (Merged 7 Nov before this review; still worth doing before the deploy.)
- [x] Run the full `npm run build` locally (the Buffett excerpt check needs the corpus, which only your machine has), then `npm run test:site`. (7 Nov: build complete, 23/23 tests pass.)
- [x] Merge PR #46. (7 Nov)

### Deploy
- [ ] Deploy (`./deploy.sh`), after the Beehiiv Worker is live (above).
- [ ] Copy the `location = /llms.txt` block from `infra/nginx-signal-to-noise.conf` to the VM (s2n-web), then `sudo nginx -t && sudo systemctl reload nginx`.
- [ ] Check `curl -I https://signal-to-noise.co/llms.txt` shows `text/plain; charset=utf-8`.

### Cloudflare (dashboard, signal-to-noise.co)
- [ ] AI Crawl Control: GPTBot, ClaudeBot, PerplexityBot, Google-Extended and Applebot-Extended are all set to Allow.
- [ ] Security → Bots: "Block AI bots" is off; Bot Fight Mode stays off.
- [ ] Managed robots.txt is off: `curl https://signal-to-noise.co/robots.txt` matches `public/robots.txt`.
- [ ] `curl -A "GPTBot/1.1" -I https://signal-to-noise.co/` returns 200, not 403.

### Validate and index
- [ ] Google Rich Results Test on three live essays: one recent, one series part (e.g. `/insights/7-crisis-reveals-people-clearly/`), one from 2023. Expect BlogPosting and Breadcrumb with no errors.
- [ ] Search Console: resubmit `/sitemap-index.xml`.
- [ ] Search Console: request indexing for the 10 most recent essays.

### Habits from now on
- [ ] Publish on signal-to-noise.co first; post to LinkedIn about a day later, linking to the canonical URL. (Follow-up idea: make the LinkedIn posting flow check the essay URL returns 200 first.)
- [ ] When an essay gets a substantive revision, add `updated: YYYY-MM-DD` to its frontmatter.

### Later
- [ ] Around mid-December 2026 (4–6 weeks after deploy): search "Himanshu Kher" and "Signal to Noise Himanshu Kher" and note where the site ranks.
