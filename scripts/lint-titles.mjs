#!/usr/bin/env node
/* Lints every article title to sentence case.
   Runs as `prebuild` so an offending title fails the build before
   it can be deployed.

   Sentence case rule:
   - First word: any capitalization (always capitalized).
   - First word after a clause boundary (colon, em-dash, sentence-end
     punctuation): any capitalization.
   - Every other word: must start lowercase UNLESS the whole word is
     on the allowlist (acronyms, proper nouns, wordplay).

   To allow a new acronym or proper noun, add it to ALLOWLIST below. */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src/content/insights/', import.meta.url).pathname;

// Single Unicode placeholder used to hide quoted sentence-end punctuation
// during clause splitting so a quoted exclamation like "No." doesn't get
// treated as a clause separator. U+E000 is in the Private Use Area.
const PLACEHOLDER = String.fromCharCode(0xe000);

const ALLOWLIST = new Set([
  // Org / role acronyms (both apostrophe variants)
  'CFO', 'CFOs', "CFO's", 'CFO’s',
  'CEO', 'CEOs', "CEO's", 'CEO’s',
  'CTO', 'CTOs',
  'COO', 'COOs',
  // Finance acronyms
  'FP&A', 'M&A', 'P&L', 'IPO', 'IPOs', 'EBITDA', 'KPI', 'KPIs', 'CX', 'ROI',
  // AI / tech
  'AI', 'AIs', 'GPT', 'LLM', 'LLMs', 'ChatGPT', 'GenAI', 'ML', 'API', 'APIs',
  // Companies that read as proper nouns
  'OpenAI', 'Anthropic', 'SpaceX', 'Microsoft', 'Google', 'Apple', 'Meta',
  'Amazon', 'Netflix', 'Tesla', 'NVIDIA', 'Salesforce', 'LinkedIn',
  // First-person pronouns (always capitalized in English)
  'I', "I'm", "I've", "I'd", "I'll", 'I’m', 'I’ve', 'I’d', 'I’ll',
  // Wordplay / deliberate capitalizations
  'wAI', // "Where there is will, there is wAI"
  // Style choice: Fintech as a brand/category capitalization
  'Fintech', 'Fintechs',
  // Common days/months
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
  // Country / region codes
  'US', 'USA', 'UK', 'EU', 'NYC', 'SF', 'APAC', 'EMEA',
  // Misc
  'Q1', 'Q2', 'Q3', 'Q4',
]);

/* Multi-word proper nouns. Each consecutive token sequence matching one
   of these (case-sensitively on the bare token) is exempt. Add
   personifications, place names, multi-word brands here. */
const MULTI_WORD_ALLOWLIST = [
  ['Father', 'Time'],   // Personification
];

/* Strip leading/trailing quotes, brackets, parens, punctuation from a
   token but keep internal punctuation (so "FP&A," → "FP&A", but
   "CFO's" stays "CFO's"). */
function stripWrapping(token) {
  return token
    .replace(/^[\s"“”‘’'(\[]+/, '')
    .replace(/[\s"“”‘’'),.!?:;\]]+$/, '');
}

function isAcceptableCapitalized(token) {
  const bare = stripWrapping(token);
  if (!bare) return true;
  // Allowlisted token
  if (ALLOWLIST.has(bare)) return true;
  // Pure numbers, dashes, symbols
  if (!/[A-Za-z]/.test(bare)) return true;
  // First alpha character drives the rule (handles "10th", "1990s", etc.)
  const firstAlpha = bare.match(/[A-Za-z]/);
  if (!firstAlpha) return true;
  if (firstAlpha[0] === firstAlpha[0].toLowerCase()) return true;
  return false;
}

/* A token fully wrapped in quotes is a quotation, not prose — we don't
   lint the case of a quoted exclamation like ‘"No."’ or ‘"Run".’. */
function isQuotedToken(raw) {
  return /^[“"‘'][^“”"‘’']*[”"’'][.,!?;:]*$/.test(raw);
}

/* Returns indices in `tokens` that participate in any multi-word
   allowlist match (so we skip them during the per-token lint). */
function multiWordExemptIndices(tokens) {
  const exempt = new Set();
  const bare = tokens.map(stripWrapping);
  for (const phrase of MULTI_WORD_ALLOWLIST) {
    for (let i = 0; i <= tokens.length - phrase.length; i++) {
      let match = true;
      for (let j = 0; j < phrase.length; j++) {
        if (bare[i + j] !== phrase[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        for (let j = 0; j < phrase.length; j++) exempt.add(i + j);
      }
    }
  }
  return exempt;
}

function lintTitle(title) {
  // Strip the wrapping YAML quotes.
  const clean = title.replace(/^"|"$/g, '').replace(/\\"/g, '"');

  // Mask sentence-end punctuation that lives inside a quoted phrase
  // (e.g. ‘"No."’) so it doesn't trigger a clause split.
  const masked = clean.replace(
    /[“"‘'][^“”"‘’']*[”"’']/g,
    (m) => m.replace(/[.?!;]/g, PLACEHOLDER),
  );

  // Clause separators: colon, em-dash, sentence-end punctuation.
  const offenders = [];
  const placeholderRe = new RegExp(PLACEHOLDER, 'g');
  const clauses = masked.split(/[:—?!.;]+/);
  for (const clause of clauses) {
    const restored = clause.replace(placeholderRe, '.');
    const tokens = restored.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const mwExempt = multiWordExemptIndices(tokens);
    // tokens[0] is the first word of a clause — always exempt.
    for (let i = 1; i < tokens.length; i++) {
      if (mwExempt.has(i)) continue;
      if (isQuotedToken(tokens[i])) continue;
      if (!isAcceptableCapitalized(tokens[i])) {
        offenders.push(tokens[i]);
      }
    }
  }
  return offenders;
}

function extractTitle(frontmatter) {
  const m = frontmatter.match(/^title:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

function main() {
  const files = readdirSync(ROOT).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
  let failed = 0;
  for (const f of files) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const title = extractTitle(fm[1]);
    if (!title) continue;
    const offenders = lintTitle(title);
    if (offenders.length > 0) {
      failed++;
      console.error(`✗ ${f}`);
      console.error(`   ${title}`);
      console.error(`   Offending tokens: ${offenders.join(', ')}`);
      console.error('');
    }
  }
  if (failed > 0) {
    console.error(`Title lint failed: ${failed} article(s) violate sentence case.`);
    console.error('Fix the title, or add the proper noun/acronym to ALLOWLIST in scripts/lint-titles.mjs.');
    process.exit(1);
  }
  console.log(`✓ Title lint passed (${files.length} articles).`);
}

main();
