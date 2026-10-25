// scripts/line/figures.mjs
//
// Facts preserved (25 Oct 2026). Layer B rewrites every shipping string to
// change its statistical fingerprint, and on 24 Oct 2026 it changed a fact:
// "Meta raised the bottom of its capital budget" came back as "Meta reduced
// its 2026 capital budget range". Nothing caught it. This compares the draft
// with the rewrite mechanically, with no model in the loop:
//
//   figures    every number with its currency, scale and unit, normalised
//              ("$24.8bn" == "$24.8 billion"), compared as multisets;
//   direction  a word on one side of an axis (rose/fell, more/less, gain/loss)
//              replaced by its opposite in the aligned sentence;
//   negation   "not", "no", "never" near a figure appearing or disappearing.
//
// Every finding stops the gate. False positives are cheaper than a wrong fact.

// --- cleaning: digits in URLs, footnotes and list markers are not figures ---

function strip(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\[\^?[^\]\s]*\d[^\]\s]*\]:?/g, ' ')
    .replace(/^[ \t]*(?:#{1,6}|>+|[-*+]|\d+[.)])[ \t]+/gm, '');
}

// --- figures ---

const SCALES = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, tn: 1e12, trn: 1e12, trillion: 1e12 };
const UNITS = { '%': '%', 'per cent': '%', percent: '%', pp: 'pp', 'percentage points': 'pp', 'percentage point': 'pp', bps: 'bps', bp: 'bps', 'basis points': 'bps', 'basis point': 'bps' };
// Spelled cardinals from two upwards: "one" is a pronoun as often as a number.
// The owner spells some figures out ("seventeen per cent"), so a rewrite to
// digits must match. "Twenty-two" is one figure.
const ONES = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const FRACTIONS = { 'one-third': '1/3', 'two-thirds': '2/3', 'one-quarter': '1/4', 'three-quarters': '3/4', 'one-fifth': '1/5', 'two-fifths': '2/5', 'three-fifths': '3/5', 'four-fifths': '4/5' };

const SCALE_RE = String.raw`(?:(?:\s?(?:thousand|million|billion|trillion|mn|bn|tn|trn)\b)|(?:[kmb](?![\p{L}\p{N}])))`;
const UNIT_RE = String.raw`(?:\s?%|\s(?:per cent|percent|percentage points?|basis points?|bps|bp|pp)\b|(?:bps|bp|pp)\b)`;
const NUM_RE = String.raw`(?<cur>(?:US)?[£$€])?\s?(?<int>\d{1,3}(?:,\d{3})+|\d+)(?<dec>\.\d+)?`;
const FIG = new RegExp(
  String.raw`(?<![\p{L}\p{N}.,])(?:` +
  String.raw`(?<lit>Q[1-4]|H[12]|FY\s?\d{2,4})` +
  String.raw`|(?<frac>${Object.keys(FRACTIONS).join('|')})` +
  String.raw`|(?<word>${Object.keys(WORDS).join('|')})(?:-(?<w2>${Object.keys(ONES).join('|')}))?(?<wscale>\s(?:thousand|million|billion|trillion))?(?<wunit>${UNIT_RE})?` +
  String.raw`|${NUM_RE}(?<scale>${SCALE_RE})?(?<unit>${UNIT_RE})?` +
  String.raw`)(?![\p{L}\p{N}])`, 'giu');

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function rawFigures(text) {
  const out = [];
  for (const m of text.matchAll(FIG)) {
    const g = m.groups;
    const f = { raw: m[0].trim(), at: m.index, end: m.index + m[0].length, cur: '', value: null, scale: 1, unit: '', lit: null };
    if (g.lit) f.lit = g.lit.toUpperCase().replace(/\s/g, '');
    else if (g.frac) f.lit = FRACTIONS[g.frac.toLowerCase()];
    else if (g.word) { f.value = WORDS[g.word.toLowerCase()] + (g.w2 ? ONES[g.w2.toLowerCase()] : 0); if (g.wscale) f.scale = SCALES[norm(g.wscale)]; if (g.wunit) f.unit = UNITS[norm(g.wunit)] ?? norm(g.wunit); }
    else {
      f.cur = (g.cur ?? '').replace(/^US/, '');
      f.value = Number(g.int.replace(/,/g, '') + (g.dec ?? ''));
      if (g.scale) f.scale = SCALES[norm(g.scale)];
      if (g.unit) f.unit = UNITS[norm(g.unit)] ?? norm(g.unit);
    }
    out.push(f);
  }
  // Ranges: "$135 to $145 billion", "5–7%", "£20–30m", "between 2 and 3 per cent".
  // Scale and unit carry leftwards, currency rightwards.
  for (let i = 0; i + 1 < out.length; i++) {
    const a = out[i], b = out[i + 1];
    if (a.lit || b.lit) continue;
    const gap = text.slice(a.end, b.at);
    const between = /^\s*and\s*$/i.test(gap) && /\bbetween\s+$/i.test(text.slice(0, a.at));
    if (!/^\s*(?:to|–|-)\s*$/i.test(gap) && !between) continue;
    if (a.scale === 1 && b.scale !== 1) a.scale = b.scale;
    if (!a.unit && b.unit) a.unit = b.unit;
    if (!b.cur && a.cur) b.cur = a.cur;
  }
  return out.map((f) => ({ ...f, key: f.lit ?? durationKey(text, f) ?? `${f.cur}${Number((f.value * f.scale).toPrecision(12))}${f.unit}` }));
}

// --- durations, compared in months (26 Oct 2026): "twenty years" == "two
// decades", "the first half" == "the first six months" == H1 ---

const MONTHS = { month: 1, months: 1, quarter: 3, quarters: 3, year: 12, years: 12, decade: 120, decades: 120 };

function durationKey(text, f) {
  if (f.cur || f.unit) return null;
  const m = /^[\s-]+(months?|quarters?|years?|decades?)\b/i.exec(text.slice(f.end));
  if (!m) return null;
  const months = Number((f.value * f.scale * MONTHS[m[1].toLowerCase()]).toPrecision(12));
  const before = text.slice(0, f.at);
  if (/\bfirst\s+$/i.test(before) && months === 6) return 'H1';
  if (/\b(?:second|last|final)\s+$/i.test(before) && months === 6) return 'H2';
  if (/\bfirst\s+$/i.test(before) && months === 3) return 'Q1';
  return `${months}mo`;
}

// Durations named without a number. They never raise a finding of their own,
// because "a year ago" can fairly become "last year"; they only answer for a
// numbered figure on the other side ("a decade" against "ten years").
const SOFT = [
  [/\b(?:a|one|the\s+(?:past|last|next|previous))\s+(?:full\s+)?year\b/gi, () => '12mo'],
  [/\b(?:a|one|the\s+(?:past|last|next|previous))\s+decade\b/gi, () => '120mo'],
  [/\b(?:a|one|the\s+(?:past|last|next|previous))\s+month\b/gi, () => '1mo'],
  [/\bhalf(?:\s+a|-)\s*year\b|\bhalf\s+of\s+the\s+year\b/gi, () => '6mo'],
  [/\ba\s+quarter\b(?!\s+of)/gi, () => '3mo'],
  [/\b(first|second)\s+half\b/gi, (m) => (m[1].toLowerCase() === 'first' ? 'H1' : 'H2')],
  [/\b(first|second|third|fourth)\s+quarter\b/gi, (m) => `Q${['first', 'second', 'third', 'fourth'].indexOf(m[1].toLowerCase()) + 1}`],
];
const softFigures = (text) => SOFT.flatMap(([re, key]) => [...text.matchAll(re)].map((m) => ({ raw: m[0], key: key(m) })));

// --- sentences ---

function sentences(text) {
  const out = [];
  for (const para of strip(text).split(/\n\s*\n/)) {
    const flat = para.replace(/\s+/g, ' ').trim();
    if (!flat) continue;
    for (const s of flat.split(/(?<=[.!?]["”’)]?)\s+(?=["“‘(]?[\p{Lu}\p{N}£$€])/u)) if (s.trim()) out.push(s.trim());
  }
  return out;
}

export function extractFacts(text) {
  return sentences(text).map((s, i) => ({ index: i, text: s, figures: rawFigures(s), soft: softFigures(s) }));
}

// --- direction lexicon: each axis has two opposed classes ---

const forms = (s) => s.split(/\s+/).filter(Boolean);
export const AXES = [
  { axis: 'quantity',
    up: forms('raise raised raises raising rise rises rose risen rising increase increased increases increasing grow grows grew grown growing growth climb climbs climbed climbing gain gained gains gaining jump jumped jumps surge surged surges soar soared soars expand expanded expands expanding boost boosted boosts lift lifted lifts higher highest upward upwards double doubled'),
    down: forms('cut cuts cutting reduce reduced reduces reducing reduction fall falls fell fallen falling decrease decreased decreases decreasing decline declined declines declining drop dropped drops dropping lower lowered lowers lowest shrink shrinks shrank shrunk slip slipped slips slump slumped plunge plunged trim trimmed trims contract contracted contraction downward downwards halve halved') },
  { axis: 'amount', up: forms('more most larger largest bigger biggest greater'), down: forms('less least fewer fewest smaller smallest') },
  { axis: 'position', up: forms('above ahead exceed exceeded exceeds'), down: forms('below behind') },
  { axis: 'sign', up: forms('positive gain gains profit profits profitable surplus'), down: forms('negative loss losses lossmaking deficit') },
  { axis: 'spread', up: forms('widen widened widens widening wider'), down: forms('narrow narrowed narrows narrowing narrower') },
  { axis: 'strength', up: forms('strengthen strengthened strengthens stronger'), down: forms('weaken weakened weakens weaker') },
  { axis: 'quality', up: forms('better best improve improved improves improving'), down: forms('worse worst worsen worsened deteriorate deteriorated') },
];
// Axes in one family may stand in for each other on the same side ("more
// revenue" == "higher revenue"); any other swap across axes is a change of
// meaning ("narrowed the range" != "reduced the range", 26 Oct 2026). The
// quality family is evaluative, not factual: it is left out of cross-axis
// swaps ("worst day" may fairly become "steepest decline") and keeps only its
// same-axis flip check.
const FAMILY = { quantity: 'size', amount: 'size', position: 'size', strength: 'quality', quality: 'quality', sign: 'sign', spread: 'spread' };
// "over" and "under" are left out: "over the year", "under pressure".
// "up" and "down" count only beside a figure ("up 12%", "down by $3bn"):
// as particles ("set up", "break down") they would flag constantly.
const NEAR_FIGURE = /^(?:by\s+)?(?:(?:US)?[£$€])?\d/;
// On the sign axis "gain" and "loss" count only as nouns ("a loss", "its
// gains", "$2m loss", "gain of"): the verb in "gain share" is not a sign fact,
// and the noun is not also counted as a quantity word.
const SIGN_NOUNS = new Set(forms('gain gains loss losses'));
const DETERMINERS = new Set(forms('a an the its their his her our my your this that these those no any each every net'));
const isNoun = (toks, i) => (i > 0 && (DETERMINERS.has(toks[i - 1].w) || /\d/.test(toks[i - 1].w) || /['’]s$/.test(toks[i - 1].w))) || toks[i + 1]?.w === 'of';
const NEG = new Set(forms('not no never nor none neither without cannot'));

// Contractions become " not" before tokenising; offsets refer to lowered(s).
const lowered = (s) => s.toLowerCase().replace(/n['’]t\b/g, ' not');
const tokens = (s) => [...lowered(s).matchAll(/[\p{L}]+(?:-[\p{L}]+)*|[£$€]?\d[\d,.]*%?/gu)].map((m) => ({ w: m[0], at: m.index }));

function polarity(s) {
  const counts = {};
  for (const a of AXES) counts[a.axis] = { up: 0, down: 0, upWords: [], downWords: [] };
  const lower = lowered(s), toks = tokens(s);
  for (const [i, t] of toks.entries()) {
    for (const a of AXES) {
      // A noun "gain" is a sign fact only; the verb is quantity only.
      if (SIGN_NOUNS.has(t.w) && (a.axis === 'sign') !== isNoun(toks, i)) continue;
      if (a.up.includes(t.w)) { counts[a.axis].up++; counts[a.axis].upWords.push(t.w); }
      if (a.down.includes(t.w)) { counts[a.axis].down++; counts[a.axis].downWords.push(t.w); }
    }
    if ((t.w === 'up' || t.w === 'down') && NEAR_FIGURE.test(lower.slice(t.at + t.w.length).trimStart())) {
      const c = counts.quantity;
      if (t.w === 'up') { c.up++; c.upWords.push('up'); } else { c.down++; c.downWords.push('down'); }
    }
  }
  return counts;
}

// Is there a negation within six words of a figure?
function negatedNearFigure(s) {
  const toks = tokens(s);
  const figAt = toks.map((t, i) => (/\d/.test(t.w) || WORDS[t.w] ? i : -1)).filter((i) => i >= 0);
  return toks.some((t, i) => NEG.has(t.w) && figAt.some((j) => Math.abs(i - j) <= 6));
}

// --- alignment: rewrites keep order, mostly; they join and split sentences ---

const STOP = new Set(forms('the a an and or of to in on at for by with from as is are was were be been it its this that these those which who than then but so'));
const contentWords = (s) => new Set(tokens(s).map((t) => t.w).filter((w) => w.length > 2 && !STOP.has(w) && !/\d/.test(w)));
const entities = (s) => new Set((s.match(/(?<!^|[.!?]\s)\b\p{Lu}[\p{L}&]+/gu) ?? []));
const overlap = (a, b) => [...a].filter((x) => b.has(x)).length;

function align(draft, output) {
  const cands = [];
  for (let j = 0; j < output.length; j++) {
    cands.push({ from: j, text: output[j].text, figures: output[j].figures });
    if (j + 1 < output.length) cands.push({ from: j, text: `${output[j].text} ${output[j + 1].text}`, figures: [...output[j].figures, ...output[j + 1].figures] });
  }
  const scale = output.length / Math.max(draft.length, 1);
  return draft.map((d, i) => {
    const dk = d.figures.map((f) => f.key), de = entities(d.text), dw = contentWords(d.text);
    let best = null;
    for (const c of cands) {
      const dist = Math.abs(c.from - i * scale);
      if (dist > 4) continue;
      const ck = new Set(c.figures.map((f) => f.key));
      const shared = dk.filter((k) => ck.has(k)).length;
      const cw = contentWords(c.text);
      const jac = overlap(dw, cw) / Math.max(new Set([...dw, ...cw]).size, 1);
      const score = 3 * shared + 2 * overlap(de, entities(c.text)) + 5 * jac - 0.5 * dist - (c.text.length > d.text.length * 1.8 ? 0.5 : 0);
      if (!best || score > best.score) best = { ...c, shared, score };
    }
    return best && best.score > 0.5 ? { draft: d, output: best } : { draft: d, output: null };
  });
}

// --- the comparison ---

const ctx = (s) => (s.length > 160 ? `${s.slice(0, 157)}…` : s);

export function compareFacts(before, after) {
  return compareFactsDetailed(before, after).findings;
}

// Words of `a` not matched in `b`, as a multiset.
const without = (a, b) => { const r = [...b]; return a.filter((w) => { const i = r.indexOf(w); if (i < 0) return true; r.splice(i, 1); return false; }); };

export function compareFactsDetailed(before, after) {
  const draft = extractFacts(before), output = extractFacts(after);
  const findings = [];

  // Figures: multisets of normalised keys.
  const bag = (sents) => {
    const m = new Map();
    for (const s of sents) for (const f of s.figures) { if (!m.has(f.key)) m.set(f.key, []); m.get(f.key).push({ raw: f.raw, sentence: s.text }); }
    return m;
  };
  const bd = bag(draft), bo = bag(output);
  const softCount = (sents) => { const m = new Map(); for (const s of sents) for (const f of s.soft) m.set(f.key, (m.get(f.key) ?? 0) + 1); return m; };
  const sd = softCount(draft), so = softCount(output);
  for (const [k, ds] of bd) {
    const os = bo.get(k) ?? [];
    for (const d of ds.slice(os.length + (so.get(k) ?? 0))) findings.push({ kind: 'figure-missing', draft: ctx(d.sentence), output: null, detail: `"${d.raw}" (${k}) is in the draft but not in the rewrite` });
  }
  for (const [k, os] of bo) {
    const ds = bd.get(k) ?? [];
    for (const o of os.slice(ds.length + (sd.get(k) ?? 0))) findings.push({ kind: 'figure-added', draft: null, output: ctx(o.sentence), detail: `"${o.raw}" (${k}) is in the rewrite but not in the draft` });
  }

  // Direction and negation, per aligned sentence pair.
  const pairs = align(draft, output);
  for (const { draft: d, output: o } of pairs) {
    if (!o) continue;
    const pd = polarity(d.text), po = polarity(o.text);
    // Across axes: a direction word lost on one axis and one gained on another.
    const lost = [], gained = [];
    for (const a of AXES) for (const side of ['up', 'down']) {
      const x = pd[a.axis][`${side}Words`], y = po[a.axis][`${side}Words`];
      for (const w of without(x, y)) lost.push({ axis: a.axis, side, w });
      for (const w of without(y, x)) gained.push({ axis: a.axis, side, w });
    }
    // Only in a factual sentence: the pair must share a figure.
    const factual = (l) => o.shared > 0 && FAMILY[l.axis] !== 'quality';
    const swap = lost.filter(factual).flatMap((l) => gained.filter(factual).filter((g) => g.axis !== l.axis && (FAMILY[g.axis] !== FAMILY[l.axis] || g.side !== l.side)).map((g) => [l, g]));
    if (swap.length) {
      findings.push({ kind: 'direction-change', draft: ctx(d.text), output: ctx(o.text),
        detail: swap.map(([l, g]) => `"${l.w}" (${l.axis}, ${l.side}) became "${g.w}" (${g.axis}, ${g.side})`).filter((v, i, a) => a.indexOf(v) === i).join('; ') });
    }
    for (const a of AXES) {
      const x = pd[a.axis], y = po[a.axis];
      // The rewrite gained one side of the axis and lost the other: a flip.
      // Both conditions keep "rose ... fell" → "fell ... rose" and joined sentences quiet.
      const flipDown = y.down > x.down && x.up > y.up;
      const flipUp = y.up > x.up && x.down > y.down;
      if (flipDown || flipUp) {
        findings.push({ kind: 'direction-flip', draft: ctx(d.text), output: ctx(o.text),
          detail: `${a.axis}: "${(flipDown ? x.upWords : x.downWords).join(', ')}" became "${(flipDown ? y.downWords : y.upWords).join(', ')}"` });
      }
    }
    if (o.shared > 0 && negatedNearFigure(d.text) !== negatedNearFigure(o.text)) {
      findings.push({ kind: 'negation', draft: ctx(d.text), output: ctx(o.text),
        detail: negatedNearFigure(d.text) ? 'a negation beside a figure was dropped' : 'a negation was added beside a figure' });
    }
  }
  // Draft sentences with no counterpart were not checked for direction or
  // negation: reported for information, never a failure.
  return { findings, unmatched: pairs.filter((p) => !p.output).length, sentences: draft.length };
}

export function renderFacts(facts) {
  if (!facts) return 'not reached';
  if (facts.skipped) return 'skipped (no Layer B rewrite to compare)';
  const note = facts.unmatched ? `\nUnmatched: ${facts.unmatched} of ${facts.sentences} draft sentences had no counterpart in the rewrite, so direction and negation were not checked for them (information only).` : '';
  if (!facts.findings.length) return `Every figure, direction word and negation in the draft survives the rewrite.${note}`;
  return [`${facts.findings.length} change${facts.findings.length === 1 ? '' : 's'} of fact between the draft and the Layer B rewrite:`,
    ...facts.findings.map((f) => `- ❌ ${f.kind}${f.field && f.field !== 'body' ? ` [${f.field}]` : ''}: ${f.detail}${f.draft ? `\n  draft: "${f.draft}"` : ''}${f.output ? `\n  rewrite: "${f.output}"` : ''}`)].join('\n') + note;
}
