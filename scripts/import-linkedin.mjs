// scripts/import-linkedin.mjs
//
// Imports LinkedIn /pulse/ articles into Astro content collections.
// For each URL in scripts/linkedin-urls.json:
//   1. Fetch the page HTML (no login — public articles only)
//   2. Extract <article>, drop noise (header chrome, footer prompts)
//   3. Convert HTML → Markdown via turndown
//   4. Pull title from og:title, date from "Published <Month> <Day>, <Year>"
//   5. Derive slug from the URL (strip "-himanshu-kher-<id>" suffix)
//   6. Auto-assign tags by keyword matching against title + body
//   7. Generate excerpt from first body paragraph
//   8. Write src/content/insights/<slug>.md with frontmatter (draft: true)
//   9. Write scripts/import-results.json as a manifest for review

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import TurndownService from 'turndown';

// ── Config ────────────────────────────────────────────────────
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const URLS_FILE = 'scripts/linkedin-urls.json';
const OUT_DIR = 'src/content/insights';
const RESULTS_FILE = 'scripts/import-results.json';
const RATE_LIMIT_MS = 750; // be polite to LinkedIn

// ── Turndown setup ────────────────────────────────────────────
const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});

turndown.addRule('strip-noise', {
  filter: ['button', 'svg', 'script', 'style', 'noscript', 'iframe', 'form', 'input'],
  replacement: () => '',
});

// LinkedIn images use signed CDN URLs that expire — note as TODO for review
turndown.addRule('image-note', {
  filter: 'img',
  replacement: (_, node) => {
    const alt = node.getAttribute('alt') || '';
    const src = node.getAttribute('src') || '';
    if (!src || src.startsWith('data:')) return '';
    return `\n\n<!-- TODO image: ${src}${alt ? ` (alt: ${alt})` : ''} -->\n\n`;
  },
});

// ── Helpers ───────────────────────────────────────────────────
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'");
}

function extractTitle(html) {
  const m = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  return m ? decodeEntities(m[1]) : null;
}

function extractDate(html) {
  // "Published Jun 4, 2025" or "Updated Apr 12, 2024"
  const m = html.match(/(?:Published|Updated)\s+(\w{3,9})\s+(\d{1,2}),\s+(\d{4})/);
  if (!m) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = months.indexOf(m[1].slice(0, 3));
  if (idx < 0) return null;
  const d = new Date(Date.UTC(Number(m[3]), idx, Number(m[2])));
  return d.toISOString().split('T')[0];
}

function urlToSlug(url) {
  const m = url.match(/\/pulse\/([^/?#]+)/);
  if (!m) return null;
  // Strip "-himanshu-kher-<id>" or "-kher-<id>" (older URLs) at the end
  return m[1].replace(/-(?:himanshu-)?kher(?:-[a-z0-9]+)?$/i, '');
}

function extractArticleBody(html) {
  const m = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (!m) return null;
  let body = m[1];

  // The real body starts after the "+ Follow" CTA. Slice there if present.
  const followMatch = body.search(/\+\s*Follow/);
  if (followMatch > 0) {
    body = body.substring(followMatch + 8); // length of "+ Follow"
  }

  return body;
}

function tagsFor(title, body) {
  const text = (title + ' ' + body).toLowerCase();
  const rules = {
    leadership: /\b(leader|leadership|leading|judgment|trade.?off)/,
    strategy: /\b(strateg|execution|vision)/,
    ai: /(\bai\b|genai|\bllm\b|gpt|chatgpt|artificial intelligence|machine learning|automat)/,
    'fp-and-a': /(fp&a|\bfpa\b|fp and a|financial planning|analytic|storytell|narrative)/,
    cfo: /\b(cfo|chief financial officer)/,
    teams: /\b(team|culture|trust|cross.functional|collaborat)/,
    risk: /\b(risk|resilien|crisis|optionality|uncertain)/,
    reflections: /\b(reflect|musing|personal|philosoph|year.?end|year-end)/,
  };
  const tags = [];
  for (const [tag, regex] of Object.entries(rules)) {
    if (regex.test(text)) tags.push(tag);
  }
  return tags;
}

function generateExcerpt(markdown) {
  const lines = markdown.split('\n');
  let para = '';
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('#') || t.startsWith('<!--') || t.startsWith('-') || t.startsWith('*'))
      continue;
    para = t;
    break;
  }
  // Strip markdown formatting for excerpt readability
  para = para
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  if (para.length > 180) para = para.substring(0, 177).trim() + '…';
  return para;
}

function cleanMarkdown(md) {
  let out = md;

  // Drop common LinkedIn post-body cruft
  const tailMarkers = [
    /\n+Like\s*Comment\s*Share[\s\S]*$/i,
    /\n+Subscribe to newsletter[\s\S]*$/i,
    /\n+Report this article[\s\S]*$/i,
    /\n+More from[\s\S]*$/i,
    /\n+Sign in to.*$/im,
    /\n+\d+\s*Like[\s\S]*$/i, // "12 Like ..." reaction count
  ];
  for (const m of tailMarkers) out = out.replace(m, '');

  // Collapse runs of blank lines
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

function yamlString(s) {
  // Always JSON.stringify — safe quoting for YAML strings
  return JSON.stringify(s);
}

// ── Per-article import ────────────────────────────────────────
async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function importOne(article) {
  const html = await fetchHtml(article.url);

  const title = extractTitle(html) || article.title.split('\n')[0].trim();
  const date = extractDate(html) || new Date().toISOString().split('T')[0];
  const slug = urlToSlug(article.url);
  if (!slug) throw new Error('Could not derive slug');

  const bodyHtml = extractArticleBody(html);
  if (!bodyHtml) throw new Error('No <article> body found');

  let md = cleanMarkdown(turndown.turndown(bodyHtml));
  const tags = tagsFor(title, md);
  const excerpt = generateExcerpt(md);

  const frontmatter = [
    '---',
    `title: ${yamlString(title)}`,
    `date: ${date}`,
    `excerpt: ${yamlString(excerpt)}`,
    `tags: [${tags.map((t) => JSON.stringify(t)).join(', ')}]`,
    'draft: true',
    `sourceUrl: ${yamlString(article.url)}`,
    '---',
    '',
    md,
    '',
  ].join('\n');

  const filePath = resolve(OUT_DIR, `${slug}.md`);
  await writeFile(filePath, frontmatter);

  return {
    slug,
    title,
    date,
    tags,
    excerpt,
    sourceUrl: article.url,
    bodyLength: md.length,
  };
}

// ── Main ──────────────────────────────────────────────────────
const urls = JSON.parse(await readFile(URLS_FILE, 'utf-8'));
console.log(`Importing ${urls.length} articles → ${OUT_DIR}/\n`);

const results = [];
for (let i = 0; i < urls.length; i++) {
  const article = urls[i];
  const num = String(i + 1).padStart(2, ' ');
  const slug = article.url.split('/pulse/')[1].slice(0, 48);
  process.stdout.write(`${num}/${urls.length}  ${slug.padEnd(50)}  `);

  try {
    const r = await importOne(article);
    results.push({ status: 'ok', ...r });
    console.log(`✓  ${r.slug}.md  [${r.bodyLength} chars]  tags: ${r.tags.join(', ') || '—'}`);
  } catch (e) {
    results.push({ status: 'fail', url: article.url, error: e.message });
    console.log(`✗  FAILED: ${e.message}`);
  }

  if (i < urls.length - 1) await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
}

await writeFile(RESULTS_FILE, JSON.stringify(results, null, 2));

const ok = results.filter((r) => r.status === 'ok').length;
const fail = results.filter((r) => r.status === 'fail').length;
console.log(`\n${'='.repeat(70)}`);
console.log(`Done: ${ok}/${urls.length} imported, ${fail} failed.`);
console.log(`Manifest:        ${RESULTS_FILE}`);
console.log(`Imported files:  ${OUT_DIR}/`);
if (fail) {
  console.log(`\nFailed URLs:`);
  results.filter((r) => r.status === 'fail').forEach((r) => console.log(`  - ${r.url}: ${r.error}`));
}
