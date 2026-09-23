// scripts/line/claudish.mjs
//
// The Claudish test (owner rule, 21 Sep 2026). A list of constructions that
// read as machine-written, checked on the text that actually ships.
//
// The rates in the comments are per 1,000 words, measured on 21 Sep 2026 across
// the 59 essays the owner wrote by hand against the 2 the line wrote. The tell
// is never a vocabulary item — it is a construction: announcing instead of
// stating, and contrast reached for as decoration.
//
// Deliberately NOT listed: "delve", "tapestry", "realm", "robust", "crucial",
// "pivotal", "underscore", "seamless", "navigate", "leverage", "testament",
// "meticulous" (2.40 owner / 0.00 line) and "not just X but Y" (1.48 / 0.00).
// The generic anti-AI wordlists would edit the owner's own voice out.

// `fail` stops the gate. `warn` is reported for the owner to judge.
export const RULES = [
  // Owner 5.62 / line 1.11 — the owner's own habit, banned anyway on his
  // instruction of 21 Sep 2026: he does not want them in his articles.
  { id: 'em-dash', severity: 'fail', label: 'em dash', re: /—/g,
    fix: 'a comma, a colon, a full stop, or brackets' },

  // Owner 0.26 / line 1.85 — seven times the owner's rate. A real imperative
  // with a real object ("Follow it one hop at a time") is not this; an
  // announcement wearing an imperative's clothes is.
  { id: 'instruction-opener', severity: 'fail', label: 'reader-instruction opener',
    re: /(?:^|[.!?]\s+|\n)(Apply|Consider|Notice|Picture|Imagine|Observe|Recall|Remember that|Think about|Ask yourself|Note that)\b/g,
    fix: 'state the thing instead of announcing it' },

  { id: 'rather-than', severity: 'fail', label: '"rather than" as elegant contrast', // 0.60 / 1.85
    re: /\brather than\b/gi, fix: '"not", or recast the sentence' },

  { id: 'here-is', severity: 'fail', label: '"Here is / Here\'s the X"', // 0.11 / 0.37
    // Only the announcing use: at a sentence start, or after a conjunction.
    // "Two things here are unknown" is an adverb, not the tell.
    re: /(?:^|[.!?:;]\s+|\n|[\[(“"]|\b(?:and|but|so|yet)\s+)here(?:\s+is|'s|\s+are)\b/gi,
    fix: 'say the thing' },

  { id: 'fronted-inversion', severity: 'fail', label: 'fronted inversion', // 0.00 / 0.37
    re: /(?:^|[.!?]\s+|\n)(Nowhere|Nor|Never)\s+(?:is|are|was|were|does|do|did|has|have|had|can|could|would|will)\b/g,
    fix: 'normal word order' },

  { id: 'that-is-the-point', severity: 'fail', label: 'announcing the point', // 0.00 / 0.37
    re: /\b(?:which|that|this)\s+is\s+the\s+point\b/gi, fix: 'make the point without naming it' },

  { id: 'worth-noting', severity: 'fail', label: '"it is worth noting"', // 0.00 / 0.37
    re: /\b(?:it|that)\s+is\s+worth\s+(?:noting|remembering|asking|saying|observing)\b/gi,
    fix: 'cut it, or say who should act and why' },

  { id: 'in-other-words', severity: 'fail', label: 'restatement scaffolding',
    re: /\b(?:In other words|Put another way|Simply put|To put it (?:simply|another way))\b/gi,
    fix: 'say it once, properly' },

  { id: 'this-is-where', severity: 'fail', label: '"this is where X comes in"',
    re: /\bThis is where\b[^.]*\bcomes? in\b/gi, fix: 'introduce it without the fanfare' },

  { id: 'at-its-core', severity: 'fail', label: 'essence scaffolding',
    // A word boundary cannot follow a comma, so the comma forms belong in
    // their own alternation.
    re: /\b(?:at its core|at the heart of it|in essence)\b|\b(?:fundamentally|ultimately)\s*,/gi,
    fix: 'cut; the sentence after it is the real one' },

  // Owner rule, 23 Sep 2026: the word itself is banned, in any sense. It was
  // the line's stock metaphor (1.14/1k against the owner's 0.11).
  { id: 'ledger', severity: 'fail', label: 'the word "ledger"', re: /\bledgers?\b/gi,
    fix: '"books", "accounts", or name the actual statement' },

  // The rest of this block came out of "The landlord finances the tenant"
  // (23 Sep 2026). Owner rates across 44,536 words: deserves 0.02, the others 0.00.
  { id: 'deserves', severity: 'fail', label: 'abstraction that "deserves" something',
    re: /\bdeserve[sd]?\s+(?:a|an|the|this|that|its|your|our|some|more|closer|careful)\b/gi,
    fix: 'say what to do with it, or cut' },

  { id: 'precisely-because', severity: 'fail', label: '"precisely because"',
    re: /\bprecisely because\b/gi, fix: '"because"' },

  { id: 'signpost-close', severity: 'fail', label: 'signpost close',
    re: /\b(?:will|would|to|can)\s+get\s+(?:you|us)\s+there\b|\bgets? you there\b|\b(?:is|are) all it takes\b/gi,
    fix: 'go straight into the list or the argument' },

  { id: 'your-own-pivot', severity: 'fail', label: '"your own X should / deserves" pivot',
    re: /\byour own \w+ (?:should|deserves|needs|merits)\b/gi,
    fix: 'address the reader directly' },

  { id: 'lies-elsewhere', severity: 'fail', label: '"the question lies elsewhere"',
    re: /\b(?:question|problem|answer|risk|point|difference) lies\b/gi, fix: 'say where it is' },

  // Good moves that stop working when repeated. Counted, not banned: the gate
  // fails only above the threshold, so one deliberate use survives.
  { id: 'contrastive-negation', severity: 'fail', label: 'contrastive negation', // 0.39 / 0.74
    re: /\b(?:is|are|was|were)\s+not\s+(?:a|an|the)\b/g, max: 1,
    fix: 'keep one per essay; recast the others' },

  { id: 'colon-payoff', severity: 'warn', label: 'colon-then-lowercase payoff', // 3.20 / 5.92
    re: /:\s+[a-z]/g, max: 3, fix: 'a full stop carries most of these' },
];

// A source's own words are evidence, not voice: a quotation that contains a
// listed construction must never fail the gate, because it cannot be reworded
// without misquoting. Markdown link targets, code, SVG and HTML go too.
export function scannableText(md) {
  return md
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/["“][^"”\n]{12,}["”]/g, ' ')        // quoted source material
    .replace(/^>.*$/gm, ' ')                       // blockquotes
    .replace(/\]\([^)]*\)/g, '] ')                 // link targets, keep link text
    .replace(/^(?:https?:\/\/)\S+$/gm, ' ');
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

export function scanClaudish(md, { rules = RULES } = {}) {
  const text = scannableText(md);
  const hits = [];
  for (const rule of rules) {
    const found = [...text.matchAll(rule.re)];
    const allowed = rule.max ?? 0;
    if (found.length <= allowed) continue;
    // Only the uses beyond the allowance are reported, so a rule with max: 1
    // names the second and later occurrences, not the one that is permitted.
    for (const m of found.slice(allowed)) {
      hits.push({
        id: rule.id, severity: rule.severity, label: rule.label, fix: rule.fix,
        line: lineOf(text, m.index), match: m[0].trim().slice(0, 40),
        count: found.length, allowed,
      });
    }
  }
  return hits.sort((a, b) => a.line - b.line);
}

export const claudishFails = (hits) => hits.filter((h) => h.severity === 'fail');

export function renderClaudish(hits) {
  if (!hits.length) return 'No Claudish constructions found.';
  const byId = new Map();
  for (const h of hits) byId.set(h.id, [...(byId.get(h.id) ?? []), h]);
  return [...byId.entries()].map(([, hs]) => {
    const h = hs[0];
    const where = hs.map((x) => `line ${x.line}`).join(', ');
    const cap = h.allowed ? ` (${h.count} uses, ${h.allowed} allowed)` : '';
    return `- ${h.severity === 'fail' ? '❌' : '⚠️'} ${h.label}${cap} — ${where}; "${h.match}" → ${h.fix}`;
  }).join('\n');
}

// The same bans, phrased for a model instead of a regex. Layer B is where most
// Claudish constructions come from: on 21 Sep 2026 it twice rewrote a clean
// sentence into an announcing imperative ("The test belongs on your own ledger"
// → "Apply the test to your own ledger"). Telling it up front is cheaper than
// failing the gate and paying for another plagiarism run; the scan above stays
// as the backstop for when it disobeys.
export const PROMPT_BANS = [
  ['em-dash', 'no em dashes anywhere (use a comma, a colon, a full stop or brackets)'],
  ['instruction-opener', 'never open a sentence by instructing the reader: no "Apply...", "Consider...", "Notice...", "Imagine...", "Observe...", "Note that..."'],
  ['rather-than', 'never write "rather than"; use "not", or recast the sentence'],
  ['here-is', 'never open a sentence with "Here is" or "Here are"'],
  ['fronted-inversion', 'no fronted inversion: not "Nowhere is that required", but "Nobody requires that"'],
  ['that-is-the-point', 'never write "that is the point", "which is the point" or "this is the point"'],
  ['worth-noting', 'never write "it is worth noting", "worth remembering" or "worth asking"'],
  ['in-other-words', 'never write "In other words", "Put another way" or "Simply put"'],
  ['this-is-where', 'never write "this is where X comes in"'],
  ['at-its-core', 'never write "at its core", "in essence", "fundamentally," or "ultimately,"'],
  ['ledger', 'never use the word "ledger" or "ledgers", in any sense'],
  ['deserves', 'never say an abstraction "deserves" something ("that phrase deserves a slow reading", "your books deserve this test")'],
  ['precisely-because', 'never write "precisely because"'],
  ['signpost-close', 'never close a paragraph with a signpost such as "will get you there" or "is all it takes"'],
  ['your-own-pivot', 'never write "your own X should/deserves/needs"; address the reader plainly'],
  ['lies-elsewhere', 'never write "the question lies elsewhere" or "the problem lies"'],
  ['contrastive-negation', 'use at most ONE "is not a/an/the ..." construction in the whole text'],
  ['colon-payoff', 'use at most three colons followed by a lower-case clause'],
];

export const promptBanText = () => PROMPT_BANS.map(([, text]) => text).join('; ');
