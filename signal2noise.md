# signal-to-noise.co — Project Brief

> Handoff document for Claude Code. Read this first before making changes.

---

## 1. Project Summary

A personal website + blog for **Himanshu** — a senior strategist and finance operator working across **finance, technology, digital assets, and trading**. A pragmatist: more interested in what actually works than in what the textbook says, more drawn to figuring something out than to defending what already exists. The site serves as a **portfolio, thought leadership hub, and future monetization platform**.

**Domain**: `signal-to-noise.co` (registered via Cloudflare)
**Status**: Greenfield — nothing built yet.

### Dual deliverable

This project has **two outcomes**:

1. **The artifact** — a live, polished site at signal-to-noise.co.
2. **Infrastructure literacy** — a working *mental model* of how a real cloud platform (Google Cloud) fits together: what a project is, why IAM and least-privilege matter, what you're actually paying for, why migration and lock-in are non-trivial.

**Important framing**: Himanshu is a CFO, **not** training for a DevOps role. The goal is *literacy, not mastery* — understanding the model well enough to be sharper in vendor negotiations, BI/infra decisions, and board-level technology-risk conversations. This is a **one-afternoon, do-it-once-with-understanding** exercise, not a skill to be maintained or executed from memory.

**What this means for how Claude Code should help**: act as a **co-pilot, not an examiner**. Carry the syntax and the fiddly bits; the human carries the *understanding*. For each meaningful step, briefly explain **what** it does and **why** it matters (one or two sentences) — then run it. Don't withhold help to "make it stick"; the value is the explained walk-through, not the struggle. Where there's a tension between "fastest path" and "most learning," favor the path that **builds the mental model** — but never at the cost of turning an afternoon into a weekend.

---

## 2. Goals

1. **Credibility showcase** for finance/fintech firms and consultancies evaluating Himanshu
2. **Thought leadership** via regular blog posts (mix of short takes + long-form deep dives)
3. **Portfolio** of case studies and substantive work (existing + future)
4. **Future-proof for monetization**: paid newsletter, consultancy bookings, digital products

---

## 3. Audience & Positioning

**Primary audience**: Finance, fintech firms, and consultancies (people evaluating Himanshu for senior roles, advisory, or partnerships).

**Tone**: Approachable + technical. Playful + cerebral. Confident without arrogance.

**Core positioning**:
- *"I find the signal in the noise"*
- *"I break down complexity into structure"*
- Sharp. Thinks differently. Sees patterns others miss.

---

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro** | Static-first, ships zero JS by default, supports MDX blog posts, view transitions for the "alive" feel |
| Styling | **Tailwind CSS** | Fast iteration, dark-mode native, clean utility classes |
| Content | **MDX** | Markdown + JSX components for blog posts |
| Hosting | **Google Cloud — Compute Engine VM** | Real hyperscaler skills; permanent free tier (`e2-micro`, US regions) for phase 1; scales into the wider GCP ecosystem |
| Reverse proxy | **Nginx** | Serves the built site, handles SSL |
| SSL | **Let's Encrypt** (free) | Auto-renewing certs |
| Process manager | **systemd** (preferred over PM2) | Learning the Linux-native way; PM2 fine as fallback |
| DNS | **Cloudflare** (or migrate to **Cloud DNS** later as a learning exercise) | Cloudflare already manages the domain; point A record to VM external IP |
| Version control | **GitHub** | Source of truth; pull on the VM to deploy |
| Provisioning | **`gcloud` CLI** (preferred over web console) | CLI fluency is the transferable skill that signals real competence |

**Avoid**: Vercel, Netlify, GitHub Pages — they limit both monetization flexibility *and* the cloud-skills goal. The whole point is to work on real infrastructure.

---

## 5. Design System

### Palette (dark mode)

| Token | Hex | Usage |
|---|---|---|
| Base / background | `#1a1a1a` | Page background |
| Accent | `#6366f1` (indigo-500) | Links, buttons, highlights, hover states |
| Text primary | `#f1f5f9` (slate-100) | Body copy, headings |
| Text secondary | `#94a3b8` (slate-400) | Subdued text, captions, metadata |
| Surface secondary | `#2d2d2d` | Cards, code blocks, subtle UI |
| Border subtle | `#3f3f46` (zinc-700) | Dividers, card borders |

### Typography

- **Headings**: A modern geometric sans (e.g., **Inter**, **Geist**, or **Space Grotesk**)
- **Body**: A highly readable sans (**Inter** works as both)
- **Monospace** (for code/data): **JetBrains Mono** or **Geist Mono**
- Generous line-height for long-form readability (1.6–1.75)
- Generous letting on headings

### Layout principles

- **Max content width**: ~720px for prose, ~1100px for full layouts
- **Typography-first**: long-form posts read like a well-typeset essay
- **Whitespace > density**: don't pack the page
- **Subtle motion**: Astro view transitions for snappy page changes; minimal animation beyond that
- **Mobile-first responsive**: works beautifully on phone, tablet, desktop

---

## 6. Site Architecture

```
/                       → Homepage
/insights               → Blog index (list of all posts)
/insights/[slug]        → Individual post
/case-studies           → Case studies index
/case-studies/[slug]    → Individual case study
/about                  → Long-form about page
/contact                → Contact + socials
```

### Homepage sections (top to bottom)

1. **Header / nav** — minimal, sticky on scroll, with the indigo accent on hover
2. **Hero** — short statement of identity + what you think about. Subtle CTA to read insights or view case studies.
3. **Featured insight** — rotates monthly; left accent border in indigo
4. **Insights preview** — 3-card grid of recent posts, "All insights →" link below
5. **Case studies** — 2–3 cards (initially placeholders; will be populated)
6. **About** — short bio (3–4 paragraphs) + link to full about page
7. **Contact / CTA** — email, LinkedIn
8. **Footer** — minimal: copyright, RSS link

---

## 7. Folder Structure

```
signal-to-noise/
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
├── public/
│   ├── favicon.svg
│   └── og-image.png         # Open Graph share image
├── src/
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── Hero.astro
│   │   ├── InsightCard.astro
│   │   ├── CaseStudyCard.astro
│   │   └── Prose.astro      # MDX wrapper with typography styling
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── PostLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── contact.astro
│   │   ├── insights/
│   │   │   ├── index.astro
│   │   │   └── [...slug].astro
│   │   └── case-studies/
│   │       ├── index.astro
│   │       └── [...slug].astro
│   ├── content/
│   │   ├── config.ts        # Content collections schema
│   │   ├── insights/
│   │   │   └── *.mdx
│   │   └── case-studies/
│   │       └── *.mdx
│   └── styles/
│       └── global.css
└── README.md
```

---

## 8. Content Collections (Astro)

Define schemas in `src/content/config.ts`:

```ts
import { defineCollection, z } from 'astro:content';

const insights = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    excerpt: z.string(),
    tags: z.array(z.string()).optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const caseStudies = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    excerpt: z.string(),
    client: z.string().optional(),
    tags: z.array(z.string()).optional(),
    externalLink: z.string().url().optional(),
  }),
});

export const collections = { insights, 'case-studies': caseStudies };
```

---

## 9. Build & Deploy Plan (Google Cloud — literacy-oriented)

> **Philosophy**: This is a CFO building infrastructure *literacy*, not a DevOps engineer training for production. **Claude Code is a co-pilot**: explain each meaningful step in a sentence or two (what it does, why it matters), then carry the syntax. The human comes away with the mental model, not memorized commands. Favor the path that builds understanding — but keep it to an afternoon. The skills tagged **[CFO-relevant]** are the ones genuinely worth internalizing; the rest (tagged **[craft, optional]**) are fine to let the co-pilot handle.

### Local development

```bash
npm install
npm run dev          # localhost:4321
npm run build        # outputs to ./dist
npm run preview      # preview the production build
```

### Phase 0 — GCP foundations (the literacy core) **[CFO-relevant]**

These four concepts *are* the literacy worth having. Understand them; let the co-pilot handle exact commands.

- **Projects & resource hierarchy** — GCP organizes everything into a *project* (a container for resources, billing, and permissions). This is the unit that shows up on bills and audits — worth understanding. Create one: `signal-to-noise`.
- **The `gcloud` CLI** — install the Google Cloud SDK and authenticate. Using the CLI once gives you a feel for how cloud platforms are *actually* operated vs. the marketing console.
  ```bash
  # macOS (Homebrew)
  brew install --cask google-cloud-sdk
  gcloud auth login
  gcloud config set project signal-to-noise
  ```
- **IAM & least privilege** — roles vs. members vs. service accounts. *This is the most CFO-relevant concept here*: it's the basis of access control, segregation of duties, and audit posture — things you sign off on. Understand the principle even if you let the co-pilot write the grants.
- **Billing & the free tier** — activate the $300/90-day credit. Know the `e2-micro` free tier is **US regions only** (Oregon `us-west1`, Iowa `us-central1`, South Carolina `us-east1`). Understanding *what drives a cloud bill* is directly useful to you.

### Phase 1 — Provision the VM (CLI-first)

Decision already made: **US free-tier `e2-micro` for phase 1** (static site; latency to UK is negligible for pre-built HTML). London + paid instance is a deliberate later step when Ghost arrives.

```bash
# Create the VM (e2-micro, Ubuntu 24.04 LTS, US free-tier region)
gcloud compute instances create s2n-web \
  --machine-type=e2-micro \
  --zone=us-central1-a \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --tags=http-server,https-server

# Reserve a STATIC external IP (so it doesn't change on reboot —
# important because DNS will point at it)
gcloud compute addresses create s2n-ip --region=us-central1
gcloud compute instances add-access-config s2n-web \
  --zone=us-central1-a --address=<RESERVED_IP>
```

**Mental model [CFO-relevant]**: you now know what a cloud "instance" actually is, that regions/zones drive latency and sometimes cost, and why a static IP matters. Let the co-pilot own the exact flags.

### Phase 2 — Networking & firewall (explicit, understood)

GCP's firewall is more explicit than DigitalOcean's — that's the point. Allow only what's needed.

```bash
# Allow HTTP and HTTPS to instances tagged http-server / https-server
gcloud compute firewall-rules create allow-http \
  --allow=tcp:80 --target-tags=http-server --source-ranges=0.0.0.0/0
gcloud compute firewall-rules create allow-https \
  --allow=tcp:443 --target-tags=https-server --source-ranges=0.0.0.0/0
# SSH (consider restricting --source-ranges to your own IP for least privilege)
gcloud compute firewall-rules create allow-ssh \
  --allow=tcp:22 --source-ranges=<YOUR_IP>/32
```

**Mental model [CFO-relevant]**: cloud security is *deny-by-default, allow-explicitly* — this is the intuition behind security reviews you sign off on. The exact rule syntax is **[craft, optional]** — co-pilot can handle it.

### Phase 3 — Server hardening & user setup

Do NOT do everything as root. Create a non-root sudo user with key-based SSH.

```bash
# Connect (gcloud handles key injection)
gcloud compute ssh s2n-web --zone=us-central1-a

# On the VM: create a non-root user, add to sudo, set up SSH key
sudo adduser himanshu
sudo usermod -aG sudo himanshu
# copy your public key into /home/himanshu/.ssh/authorized_keys
# disable root SSH + password auth in /etc/ssh/sshd_config, then: sudo systemctl restart ssh
```

**[craft, optional]**: good practice and identical on any host, but not CFO-essential. Fine to let the co-pilot drive this entirely — just know *that* you don't run production as root, and why.

### Phase 4 — Install the stack

Identical to any Ubuntu box — this part is portable knowledge.

```bash
# Node via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install --lts

# Nginx + Certbot
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# Clone, build
cd /var/www && sudo git clone https://github.com/<username>/signal-to-noise.git
cd signal-to-noise && npm install && npm run build
# Nginx serves the static ./dist directory (config written separately)
```

### Phase 5 — DNS & SSL

```bash
# In Cloudflare: A record  signal-to-noise.co → <RESERVED_STATIC_IP>
#                A record  www → <RESERVED_STATIC_IP>
# (Later learning option: migrate DNS to GCP Cloud DNS.)

# SSL on the VM
sudo certbot --nginx -d signal-to-noise.co -d www.signal-to-noise.co
```

**Mental model [CFO-relevant]**: how a domain name actually resolves to a server, and that TLS/HTTPS is free and automated now — useful context, lightly held. Syntax is **[craft, optional]**.

### Deployment workflow (ongoing)

```bash
# Local
git add . && git commit -m "Add new post" && git push origin main

# On the VM
gcloud compute ssh s2n-web --zone=us-central1-a
cd /var/www/signal-to-noise && git pull && npm run build
# Nginx serves ./dist — no restart needed
```

### Stretch (genuinely optional — only if curiosity strikes) **[craft, optional]**

None of this is needed for the site or for CFO literacy. Listed so you know the levers *exist* (which is itself useful vocabulary), not as homework:

- **Cloud Storage bucket** for blog images served via CDN — teaches object storage, a concept worth recognizing on a bill.
- **Cloud DNS** — managed DNS, if you want to see how it differs from Cloudflare.
- **Docker + Artifact Registry** — the modern deployment model; makes the app portable to any host.
- **Terraform** — infrastructure as code. The single highest-value *concept* to simply be aware of (declarative, reproducible, auditable infra), even if you never write any. Knowing the word and what it does is the CFO-relevant part.

---

## 10. Future Monetization Hooks

Plan ahead so v1 doesn't paint us into a corner:

| Capability | When | How |
|---|---|---|
| **Newsletter signup** | v1 | Embed ConvertKit / Beehiiv form on homepage + post pages |
| **Paid newsletter** | v2 | Self-host **Ghost** on a larger GCP instance (the free `e2-micro`'s ~1 GB RAM is too tight for Ghost — step up to `e2-small`/`e2-medium`, likely in London `europe-west2` at that point). Subdomain: `newsletter.signal-to-noise.co`. Keeps ~100% of revenue |
| **Consultancy booking** | v1.5 | Embed Cal.com or Calendly on `/contact`; Stripe handles payment |
| **Digital products** | v3 | Gumroad-style hosted checkout, or self-hosted via LemonSqueezy webhook |
| **Member-only content** | v3 | Migrate to Astro SSR (server-side rendering) when needed; gate via auth |

The GCP VM is the right choice because it grows with you (resize the instance, add managed services) **and** builds transferable cloud skills along the way. The Ghost phase is a deliberate paid upgrade — phase 1 (portfolio + blog) runs genuinely free on the `e2-micro` tier.

---

## 11. Writing Workflow

Posts live as `.mdx` files in `src/content/insights/`. Frontmatter:

```mdx
---
title: "The three numbers your board doesn't actually see"
date: 2026-06-01
excerpt: "Boards run on the metrics that look strategic. The real signal usually lives one layer down."
tags: ["strategy", "boards", "operating model"]
featured: true
---

Your content here. Markdown + JSX components.
```

To publish:
1. Create new `.mdx` file in `src/content/insights/`
2. Write content
3. `git push`
4. SSH into droplet, `git pull`, `npm run build`
5. Live within seconds

---

## 12. v1 Scope (what to build first)

Focus only on these for the initial launch:

- [ ] Astro project initialized with Tailwind, MDX, content collections
- [ ] Charcoal + indigo theme applied globally
- [ ] Header + Footer components
- [ ] Homepage with all sections (hero, featured insight, insights preview, case studies, about, contact)
- [ ] `/insights` index page
- [ ] `/insights/[slug]` post page
- [ ] `/case-studies` index page (placeholder, no posts yet)
- [ ] `/about` page
- [ ] `/contact` page
- [ ] One sample blog post in `src/content/insights/` to test the pipeline
- [ ] One placeholder case study
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Open Graph meta tags for social sharing
- [ ] RSS feed at `/rss.xml`
- [ ] Sitemap

**Not v1**: Search, comments, newsletter signup form (added in v1.5), analytics, dark/light toggle (dark only for now).

---

## 13. Known Decisions Already Made

- **No "Himanshu" in domain name** — the site is positioned as a thinking platform, not a personal brand
- **Dark mode only** for v1 (light mode is more work, not worth it now)
- **Hosting: Google Cloud (Compute Engine)** — chosen over DigitalOcean. Not for billing. Rationale: as a CFO, infrastructure *literacy* (not DevOps mastery) is genuinely useful — sharper vendor negotiations, BI/infra decisions, board-level tech-risk conversations. Treat as a one-afternoon, do-it-once-with-understanding exercise. Claude Code is a co-pilot: explains the why, carries the syntax.
- **Phase 1 on free-tier `e2-micro` (US region)** — latency to UK is negligible for a static site; Ghost phase moves to a paid London instance later
- **No Vercel/Netlify/GitHub Pages** — they undercut both monetization flexibility and the cloud-skills goal
- **`.co` TLD** — `.com` and `.org` for "signal-to-noise" were taken
- **Indigo accent** chosen over cyan/amber/lime — feels most authoritative + thoughtful without being cold

---

## 14. Open Questions (to resolve during build)

- Final font choice (Inter vs Geist vs Space Grotesk — A/B during build)
- Photo / no photo on About page?
- Whether to include a "Now" page (à la nownownow.com)
- Analytics: Plausible (paid, privacy-friendly) vs none for v1

---

## 15. Reference

- Inspiration site (tech only, NOT colors): https://www.yirifi.ai
- Astro docs: https://docs.astro.build
- Tailwind docs: https://tailwindcss.com/docs
- Google Cloud Compute Engine docs: https://cloud.google.com/compute/docs
- `gcloud` CLI reference: https://cloud.google.com/sdk/gcloud/reference
- GCP free tier details: https://cloud.google.com/free/docs/free-cloud-features
- Terraform on GCP (stretch goal): https://cloud.google.com/docs/terraform

---

**Next action for Claude Code**: Initialize the Astro project, set up Tailwind + MDX + content collections per the structure above, and scaffold the homepage with all sections (placeholder content where needed). Then we iterate.
