#!/usr/bin/env node
/**
 * Second-pass LinkedIn link cleanup. Runs over every body in
 * src/content/insights/ and handles every linkedin.com link the
 * first-pass `rewrite-linkedin-links.mjs` left behind:
 *
 *   A. /redir/redirect?url=… wrappers → unwrap to the real external URL
 *   B. /pulse/<known-imported-article> → /insights/<slug>/   (cross-ref the
 *      first pass missed due to URL variants — no www., trailing slash, etc.)
 *   C. /in/<profile> → unlink (keep the name as plain text). The point of
 *      this site is to keep readers off LinkedIn, not feed traffic to it.
 *   D. /company/<co> → axi.com for Axi specifically; unlink everything else.
 *   E. /feed/update/urn:li:activity:… → unlink. No durable destination.
 *
 * Touches the body only — sourceUrl in frontmatter stays intact. Idempotent:
 * a second run finds nothing to do.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INSIGHTS_DIR = path.join(__dirname, '..', 'src', 'content', 'insights');

/* Known internal pulse-IDs (the part of /pulse/<id>) that the first
   rewriter missed. Map to the local slug we want to link to instead. */
const internalPulseToSlug = {
  'future-gpt-himanshu-kher': 'future-gpt',
};

/* Company-page mappings. If a company appears here, replace the LinkedIn
   company URL with the mapped homepage. If not, unlink (keep label only). */
const companyToSite = {
  axicorp: 'https://axi.com',
};

const isLinkedIn = (url) => /linkedin\.com/i.test(url);

const unwrapRedirect = (url) => {
  const m = url.match(/linkedin\.com\/redir\/redirect\?url=([^&]+)/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
};

const internalSlugFor = (url) => {
  const m = url.match(/linkedin\.com\/pulse\/([^?/&]+)/i);
  if (!m) return null;
  const pulseId = m[1].toLowerCase();
  for (const [key, slug] of Object.entries(internalPulseToSlug)) {
    if (pulseId.startsWith(key)) return slug;
  }
  return null;
};

const profileFor = (url) => /linkedin\.com\/in\//i.test(url);
const companyFor = (url) => {
  const m = url.match(/linkedin\.com\/company\/([^?/&]+)/i);
  return m ? m[1].toLowerCase() : null;
};
const isFeedActivity = (url) => /linkedin\.com\/feed\/update\//i.test(url);

const counts = {
  A_redirectUnwrapped: 0,
  B_internalRewritten: 0,
  C_profileUnlinked: 0,
  D_companyMapped: 0,
  D_companyUnlinked: 0,
  E_feedUnlinked: 0,
  untouched: 0,
};
const filesChanged = new Set();

/* Decide what to do with a single LinkedIn URL. Returns either:
   { rewriteTo: '<new url>' }  — keep the link, swap the destination
   { unlink: true }            — drop the link, keep the label
   null                         — leave the link untouched */
const decide = (url) => {
  const real = unwrapRedirect(url);
  if (real) {
    counts.A_redirectUnwrapped++;
    return { rewriteTo: real };
  }
  const slug = internalSlugFor(url);
  if (slug) {
    counts.B_internalRewritten++;
    return { rewriteTo: `/insights/${slug}/` };
  }
  if (profileFor(url)) {
    counts.C_profileUnlinked++;
    return { unlink: true };
  }
  const co = companyFor(url);
  if (co) {
    if (companyToSite[co]) {
      counts.D_companyMapped++;
      return { rewriteTo: companyToSite[co] };
    }
    counts.D_companyUnlinked++;
    return { unlink: true };
  }
  if (isFeedActivity(url)) {
    counts.E_feedUnlinked++;
    return { unlink: true };
  }
  counts.untouched++;
  return null;
};

const files = fs
  .readdirSync(INSIGHTS_DIR)
  .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));

for (const file of files) {
  const fullPath = path.join(INSIGHTS_DIR, file);
  const raw = fs.readFileSync(fullPath, 'utf8');

  /* Split frontmatter (first --- … ---) from body — only touch body. */
  if (!raw.startsWith('---')) continue;
  const fmEnd = raw.indexOf('\n---\n', 4);
  if (fmEnd === -1) continue;
  const frontmatter = raw.slice(0, fmEnd + 5);
  const originalBody = raw.slice(fmEnd + 5);
  let body = originalBody;

  /* [label](URL) form */
  body = body.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]*)\)/g,
    (full, label, url) => {
      if (!isLinkedIn(url)) return full;
      const action = decide(url);
      if (!action) return full;
      if (action.unlink) return label;
      return `[${label}](${action.rewriteTo})`;
    },
  );

  /* <URL> form (autolinks) */
  body = body.replace(/<(https?:\/\/[^>]*)>/g, (full, url) => {
    if (!isLinkedIn(url)) return full;
    const action = decide(url);
    if (!action) return full;
    if (action.unlink) return ''; // drop bare autolink entirely
    return `<${action.rewriteTo}>`;
  });

  if (body !== originalBody) {
    fs.writeFileSync(fullPath, frontmatter + body);
    filesChanged.add(file);
  }
}

console.log('LinkedIn cleanup summary');
console.log('────────────────────────');
console.log(`A. Redirect wrappers unwrapped:          ${counts.A_redirectUnwrapped}`);
console.log(`B. Internal cross-refs rewritten:        ${counts.B_internalRewritten}`);
console.log(`C. Profile links unlinked:               ${counts.C_profileUnlinked}`);
console.log(`D. Company → mapped site (axi.com etc): ${counts.D_companyMapped}`);
console.log(`D. Company links unlinked (no mapping):  ${counts.D_companyUnlinked}`);
console.log(`E. Feed activity links unlinked:         ${counts.E_feedUnlinked}`);
console.log(`   Untouched linkedin.com links:         ${counts.untouched}`);
console.log(`Files modified: ${filesChanged.size}`);
for (const f of [...filesChanged].sort()) console.log(`  - ${f}`);
