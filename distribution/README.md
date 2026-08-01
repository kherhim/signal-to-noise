# distribution/

Everything needed to execute the Substack + LinkedIn distribution strategy in
[`../DISTRIBUTION-Plan.md`](../DISTRIBUTION-Plan.md). The plan is the *why*;
this directory is the *what to paste*.

By default nothing here posts automatically — publishing is yours to control.
There's also an optional **autopilot** (`AUTONOMY.md`) that can run it hands-off
once you connect credentials. Everything is finished or semi-finished assets that
remove the blank page.

**Start with [`WHEN-YOU-LAND.md`](./WHEN-YOU-LAND.md)** — the single sequenced
execution list (one-time setup, then a day-by-day first month).

## What's here

| Path | What it is |
|---|---|
| `WHEN-YOU-LAND.md` | The execution checklist. Open this first. |
| `ready-to-post/` | Hand-crafted, in-voice posts for **~38 articles** (incl. the full Leadership Lessons series) — native LinkedIn posts (no body link), Substack Notes, carousel outlines, news-peg triggers. The heart of the campaign. ~4+ months of material. |
| `AUTONOMY.md` | Hands-off posting: the queue + `scripts/autopilot.mjs` + a scheduled Routine, with guardrails. Built and dry-run tested; goes live when you connect creds. |
| `autopilot/` | The queue the autopilot posts from + its README. |
| `POSTING-AUTOMATION.md` | The researched options for posting after your approval — what's safe, and what I won't build (LinkedIn cookie automation = ban risk). |
| `linkedin-newsletter/` | Launch checklist + editions 1–3 (full) and 4–8 (frames). The newsletter is the highest-leverage lever and the only LinkedIn surface that links to the site without a reach penalty. |
| `back-catalog-queue.md` | All 57 articles ranked by breakout / evergreen / news-peg value, with a first-month schedule that needs zero new writing. |
| `packs/` | Output of `scripts/repurpose.mjs` — auto-scaffolded packs for the remaining long-tail articles. |

Scripts in `../scripts/`: `repurpose.mjs` (scaffold a pack), `normalize-tags.mjs`
(dry-run tag cleanup — not applied; editorial call), `autopilot.mjs` (hands-off
poster), `buffer-queue.mjs` (LinkedIn-via-Buffer layer), `substack-post.mjs`
(Substack, with `canonical` support).

## The daily loop (once set up)

1. **Site** publishes (day 0, existing `publish.sh` flow).
2. **Substack** full-text repost 48h later (`scripts/substack-post.mjs`, with the
   `canonical:` field — see README §2). Restack it same day.
3. **LinkedIn newsletter** edition ~day 7 (links the canonical freely).
4. **LinkedIn feed** native posts across the fortnight (no body link).
5. **Substack Notes** most days — pull-quotes, reactions, restacks of peers.

## To repurpose a new article

```bash
node scripts/repurpose.mjs <slug>              # → _sources/social/<slug>.md (local)
node scripts/repurpose.mjs <slug> --out distribution/packs   # committed
```

Then edit hard. The scaffold pulls real sentences from the article so you're
cutting and sharpening, not starting cold — but the voice is the moat, so never
ship the scaffold as-is.

## The one rule

The brand is *"signal, not noise."* Everything here is built to increase reach
*without* becoming noise — no ragebait, no 5-recycled-quotes-a-day, no
engagement-farming that would make the work travel while hollowing out the
reason it's worth reading. Reach in service of the writing, not the reverse.
