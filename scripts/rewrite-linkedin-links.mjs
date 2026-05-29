// scripts/rewrite-linkedin-links.mjs
//
// Walks every .md in src/content/insights/ and rewrites inline LinkedIn
// /pulse/ links that point to articles we've imported, swapping them for
// local /insights/<slug> paths. Tracking query params (?trackingId=…&trk=…)
// are stripped from any remaining LinkedIn URLs.
//
// Only the article body is touched. Frontmatter (including sourceUrl) is
// left intact — that's the canonical record of where the post came from.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const URLS_FILE = 'scripts/linkedin-urls.json';
const POSTS_DIR = 'src/content/insights';

// Mirror the slug derivation used by the importer.
function urlToSlug(url) {
  const m = url.match(/\/pulse\/([^/?#]+)/);
  if (!m) return null;
  return m[1].replace(/-(?:himanshu-)?kher(?:-[a-z0-9]+)?$/i, '');
}

// Normalize URL for map lookup: drop query, drop trailing slash, lowercase host.
function normalizeUrl(url) {
  return url.split('?')[0].split('#')[0].replace(/\/$/, '').toLowerCase();
}

// Load all known LinkedIn URLs and build a map → local slug.
const urls = JSON.parse(await readFile(URLS_FILE, 'utf-8'));
const urlMap = new Map();
for (const { url } of urls) {
  const slug = urlToSlug(url);
  if (slug) urlMap.set(normalizeUrl(url), slug);
}
console.log(`Loaded ${urlMap.size} URL → local-slug mappings.\n`);

// Walk each .md file
const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith('.md'));

let totalRewritten = 0;
let totalStripped = 0;
let filesTouched = 0;

for (const file of files) {
  const path = resolve(POSTS_DIR, file);
  const original = await readFile(path, 'utf-8');

  // Split into frontmatter (untouched) + body
  const m = original.match(/^(---\n[\s\S]+?\n---\n)([\s\S]*)$/);
  if (!m) continue;
  const [, frontmatter, body] = m;

  let newBody = body;
  let rewrittenInFile = 0;
  let strippedInFile = 0;

  // (a) Markdown links: [text](https://www.linkedin.com/pulse/…)
  newBody = newBody.replace(
    /\[([^\]]+)\]\((https?:\/\/(?:www\.)?linkedin\.com\/pulse\/[^)\s]+)\)/g,
    (_, text, url) => {
      const norm = normalizeUrl(url);
      const slug = urlMap.get(norm);
      if (slug) {
        rewrittenInFile++;
        return `[${text}](/insights/${slug})`;
      }
      if (url !== norm) {
        // Same URL minus query/hash — strip tracking
        strippedInFile++;
        return `[${text}](${url.split('?')[0].split('#')[0]})`;
      }
      return `[${text}](${url})`;
    },
  );

  // (b) Angle-bracket links: <https://www.linkedin.com/pulse/…>
  newBody = newBody.replace(
    /<(https?:\/\/(?:www\.)?linkedin\.com\/pulse\/[^>\s]+)>/g,
    (_, url) => {
      const norm = normalizeUrl(url);
      const slug = urlMap.get(norm);
      if (slug) {
        rewrittenInFile++;
        return `</insights/${slug}>`;
      }
      if (url !== norm) {
        strippedInFile++;
        return `<${url.split('?')[0].split('#')[0]}>`;
      }
      return `<${url}>`;
    },
  );

  if (rewrittenInFile || strippedInFile) {
    await writeFile(path, frontmatter + newBody);
    filesTouched++;
    totalRewritten += rewrittenInFile;
    totalStripped += strippedInFile;
    const tag = rewrittenInFile
      ? `+${rewrittenInFile} rewritten${strippedInFile ? `, +${strippedInFile} cleaned` : ''}`
      : `+${strippedInFile} cleaned`;
    console.log(`${file.padEnd(60)}  ${tag}`);
  }
}

console.log(`\n${'='.repeat(70)}`);
console.log(`${totalRewritten} cross-references rewritten to local /insights/`);
console.log(`${totalStripped} tracking-only params stripped from non-corpus URLs`);
console.log(`${filesTouched}/${files.length} files touched`);
