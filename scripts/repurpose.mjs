#!/usr/bin/env node
/* Repurpose one canonical article into a social asset pack.
 *
 * One published essay should produce ~10 posts, not one. This reads an
 * article from src/content/insights/, extracts its structure and the
 * strongest candidate lines, pre-builds UTM-tagged canonical links, and
 * writes a scaffold you finish by editing — a native LinkedIn post per
 * major section, a batch of Substack Notes, and a carousel outline.
 *
 * It deliberately does NOT write the posts for you. The voice is the moat;
 * a machine-drafted LinkedIn post reads like a machine-drafted LinkedIn
 * post. What it removes is the blank page: every slot arrives pre-filled
 * with the real sentences from the article, so the job is cutting and
 * sharpening, not starting cold.
 *
 * Usage:
 *   node scripts/repurpose.mjs <slug> [--out <dir>]
 *   node scripts/repurpose.mjs when-cognition-becomes-metered
 *
 * Default output: _sources/social/<slug>.md  (gitignored — drafts stay local).
 * Pass --out distribution/packs to write somewhere committed.
 *
 * The <slug> is the filename in src/content/insights/ without the .md.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://signal-to-noise.co';

// ---------- args ----------

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : '_sources/social';

if (!slug) {
  console.error('Usage: node scripts/repurpose.mjs <slug> [--out <dir>]');
  process.exit(1);
}

const articlePath = resolve(ROOT, 'src/content/insights', `${slug}.md`);
if (!existsSync(articlePath)) {
  console.error(`No article at ${articlePath}`);
  process.exit(1);
}

// ---------- parse ----------

const raw = readFileSync(articlePath, 'utf8');
const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!fmMatch) {
  console.error(`${slug}: no frontmatter found`);
  process.exit(1);
}

const [, fmBlock, body] = fmMatch;

function fmField(name) {
  // Handles: name: "quoted", name: unquoted, and simple inline arrays.
  const line = fmBlock.split('\n').find((l) => l.startsWith(`${name}:`));
  if (!line) return null;
  const val = line.slice(name.length + 1).trim();
  return val.replace(/^["']|["']$/g, '');
}

const title = fmField('title') ?? slug;
const excerpt = fmField('excerpt') ?? '';
const tagsLine = fmField('tags') ?? '';
const tags = tagsLine
  .replace(/[[\]"]/g, '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

// ---------- structure ----------

// H2 sections: heading text + the prose under it.
const sections = [];
{
  const lines = body.split('\n');
  let current = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (current) sections.push(current);
      current = { heading: h2[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
}

// Candidate pull-quotes: standalone declarative sentences, punchy length,
// not headings, not list items, not tables. Ranked by a crude "this sounds
// quotable" heuristic — short, ends in a full stop, no markdown noise.
function candidateQuotes() {
  const stripped = body
    .replace(/^#.*$/gm, '')      // headings
    .replace(/^\s*[-*|].*$/gm, '') // lists + table rows
    .replace(/^\s*>.*$/gm, '')   // blockquotes
    .replace(/\*\*|[*_`]/g, '')  // inline marks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // links → label

  const sentences = stripped
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 30 && s.length <= 200)
    .filter((s) => /[.?!]$/.test(s));

  const score = (s) => {
    let v = 0;
    if (s.length <= 120) v += 2;             // tighter is more quotable
    if (/[.!?]$/.test(s)) v += 1;
    if (/\b(is|isn't|not|never|always|means|costs?)\b/i.test(s)) v += 2; // assertive
    if (/^(This|That|The|You|We|It)\b/.test(s)) v += 1; // strong openers
    if (/\d/.test(s)) v += 1;                // a number people can argue with
    if (s.split(' ').length > 30) v -= 2;    // penalise sprawl
    return v;
  };

  return [...new Set(sentences)]
    .sort((a, b) => score(b) - score(a))
    .slice(0, 8);
}

const quotes = candidateQuotes();

// ---------- UTM links ----------

const canonical = `${SITE}/insights/${slug}/`;
const utm = (source, medium) =>
  `${canonical}?utm_source=${source}&utm_medium=${medium}&utm_campaign=${slug}`;

const links = {
  linkedinFeed: utm('linkedin', 'social'),
  linkedinNewsletter: utm('linkedin', 'newsletter'),
  substack: utm('substack', 'email'),
  note: utm('substack', 'note'),
};

// ---------- scaffold ----------

const wordCount = body.split(/\s+/).filter(Boolean).length;

const out = [];
const P = (s = '') => out.push(s);

P(`# Social pack — ${title}`);
P();
P(`> Auto-scaffolded by \`scripts/repurpose.mjs\`. Everything below is a`);
P(`> starting point pulled from the article — edit hard before posting.`);
P(`> The voice is the moat; don't ship these as-is.`);
P();
P(`- **Canonical:** ${canonical}`);
P(`- **Words:** ${wordCount} · **Tags:** ${tags.join(', ') || '(none)'}`);
P(`- **Excerpt:** ${excerpt}`);
P();
P(`---`);
P();
P(`## Hooks (first line does most of the work)`);
P();
P(`Pick one. A hook is an instruction, a promise, or a claim someone`);
P(`wants to argue with — never "I've just published…".`);
P();
P(`1. ${excerpt || '<opening line of the article>'}`);
quotes.slice(0, 3).forEach((q, i) => P(`${i + 2}. ${q}`));
P();
P(`---`);
P();
P(`## LinkedIn — native posts (NO link in body)`);
P();
P(`One post per major idea. 120–250 words. Must stand alone and be worth`);
P(`reading with zero clicks. End with a soft pointer, not a URL:`);
P(`"The full version — with the chart — is on my site; link on my profile."`);
P();
P(`Feed link (for your profile / newsletter, not the post body):`);
P(`  ${links.linkedinFeed}`);
P();

const postSections = sections.length
  ? sections.slice(0, 3)
  : [{ heading: 'Core thesis', lines: body.split('\n').slice(0, 12) }];

postSections.forEach((sec, i) => {
  const gist = sec.lines
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/[#*_`>|]/g, '')
    .trim()
    .slice(0, 320);
  P(`### Post ${i + 1} — "${sec.heading}"`);
  P();
  P(`Hook: <one line>`);
  P();
  P(`Source material (rewrite in your voice):`);
  P(`> ${gist}${gist.length >= 320 ? '…' : ''}`);
  P();
  P(`Close: <one-line takeaway> · soft pointer to site.`);
  P();
});

P(`---`);
P();
P(`## Substack Notes (batch of 5 — space over ~2 weeks)`);
P();
P(`Restacks are the algorithm. A note is a quote + one line of your take.`);
P(`Note link (only where a link genuinely helps): ${links.note}`);
P();
quotes.slice(0, 5).forEach((q, i) => {
  P(`**Note ${i + 1}**`);
  P(`> ${q}`);
  P(``);
  P(`Your take: <one sentence that makes someone want to restack>`);
  P();
});

P(`---`);
P();
P(`## LinkedIn document carousel (6–10 slides)`);
P();
P(`Title slide → one idea per slide → CTA slide. Each slide ≤ 20 words.`);
P();
P(`1. **Title:** ${title}`);
postSections.forEach((sec, i) => P(`${i + 2}. **${sec.heading}:** <one line>`));
P(`${postSections.length + 2}. **CTA:** Full essay on signal-to-noise.co · follow for more`);
P();
P(`---`);
P();
P(`## Substack full-text repost`);
P();
P(`Post the WHOLE essay (not a teaser). Open with:`);
P(`  *Originally published at [signal-to-noise.co](${links.substack})*`);
P(`Then the full article body. Restack it the day it goes out.`);
P();

// ---------- write ----------

const targetDir = resolve(ROOT, outDir);
mkdirSync(targetDir, { recursive: true });
const targetPath = resolve(targetDir, `${slug}.md`);
writeFileSync(targetPath, out.join('\n'), 'utf8');

console.log(`Wrote ${outDir}/${slug}.md`);
console.log(`  ${sections.length} sections · ${quotes.length} candidate quotes`);
console.log(`  Edit before posting — scaffolds are a starting point, not a draft.`);
