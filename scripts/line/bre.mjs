// American -> British spelling map. Only unambiguous words with a definite British fix live
// here; words with a legitimate American-spelt sense (a device, a proper noun, software, a
// verb) live in AMBIGUOUS instead and are warned on, never auto-fixed.
export const AMERICAN = {
  behavior: 'behaviour', behaviors: 'behaviours', color: 'colour', colors: 'colours', favor: 'favour', favorite: 'favourite',
  honor: 'honour', labor: 'labour', neighbor: 'neighbour', rumor: 'rumour', humor: 'humour', harbor: 'harbour',
  theater: 'theatre', fiber: 'fibre', liter: 'litre',
  defense: 'defence', offense: 'offence', pretense: 'pretence',
  analyze: 'analyse', analyzed: 'analysed', analyzing: 'analysing', paralyze: 'paralyse', catalyze: 'catalyse',
  optimize: 'optimise', optimized: 'optimised', optimizing: 'optimising', optimization: 'optimisation',
  organize: 'organise', organized: 'organised', organization: 'organisation', organizations: 'organisations',
  realize: 'realise', realized: 'realised', recognize: 'recognise', recognized: 'recognised', prioritize: 'prioritise',
  capitalize: 'capitalise', capitalized: 'capitalised', monetize: 'monetise', monetized: 'monetised', minimize: 'minimise',
  maximize: 'maximise', standardize: 'standardise', summarize: 'summarise', emphasize: 'emphasise', criticize: 'criticise',
  gray: 'grey', mold: 'mould',
  traveled: 'travelled', traveling: 'travelling', canceled: 'cancelled', modeling: 'modelling', modeled: 'modelled',
  labeled: 'labelled', fulfill: 'fulfil', enroll: 'enrol', skillful: 'skilful', artifact: 'artefact', artifacts: 'artefacts',
  aluminum: 'aluminium', jewelry: 'jewellery', pajamas: 'pyjamas',
};
// House style: "learned" (not "learnt") is correct and is deliberately absent from the map.

// Words with a legitimate American-spelt sense (a device, a proper noun, software terminology,
// a verb). Flagged as warnings by scanAmbiguous; never auto-fixed by applySpellingFixes.
export const AMBIGUOUS = {
  meter: 'metre (distance) — keep "meter" for a device',
  meters: 'metres (distance) — keep "meters" for a device',
  center: 'centre — keep for proper nouns',
  centers: 'centres — keep for proper nouns',
  program: 'programme — keep for software',
  programs: 'programmes — keep for software',
  license: 'licence (noun) — keep "license" as a verb',
  licenses: 'licences (noun) — keep "licenses" as a verb',
  catalog: 'catalogue',
  catalogs: 'catalogues',
  dialog: 'dialogue — keep "dialog box"',
  dialogs: 'dialogues — keep "dialog box"',
};

// Matches spans that are off-limits for spelling checks/fixes: a backtick code span, a bare
// URL, or a markdown link destination (the "](...)" tail of "[text](url)").
const PROTECTED_RE = /`[^`]*`|https?:\/\/\S+|\]\([^)]*\)/g;

// Split a single line into { text, protected } pieces. Both scanBrE/scanAmbiguous and
// applySpellingFixes iterate the same segments and only look at unprotected text, so a
// protected span never suppresses a fix elsewhere on the same line.
function segments(line) {
  const parts = [];
  let last = 0;
  for (const m of line.matchAll(PROTECTED_RE)) {
    if (m.index > last) parts.push({ text: line.slice(last, m.index), protected: false });
    parts.push({ text: m[0], protected: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), protected: false });
  return parts;
}

// ALL-CAPS word -> ALL-CAPS fix; Capitalised word -> Capitalised fix; else lowercase fix.
function applyCase(word, fix) {
  if (word === word.toUpperCase() && word !== word.toLowerCase()) return fix.toUpperCase();
  if (word[0] === word[0].toUpperCase()) return fix[0].toUpperCase() + fix.slice(1);
  return fix;
}

function scanWith(text, dict, makeEntry) {
  const flags = [];
  text.split('\n').forEach((raw, i) => {
    for (const seg of segments(raw)) {
      if (seg.protected) continue;
      for (const m of seg.text.matchAll(/[A-Za-z]+/g)) {
        const w = m[0], lw = w.toLowerCase();
        if (lw in dict) flags.push(makeEntry(w, i + 1, dict[lw]));
      }
    }
  });
  return flags;
}

/**
 * Scan text for unambiguous American spellings outside protected spans (code spans, bare
 * URLs, markdown link destinations).
 * @param {string} text
 * @returns {{ word: string, line: number, fix: string }[]} fix is always the British spelling.
 */
export function scanBrE(text) {
  return scanWith(text, AMERICAN, (word, line, fix) => ({ word, line, fix: applyCase(word, fix) }));
}

/**
 * Scan text for ambiguous American/British spellings (a device vs a distance, a proper noun,
 * software vs a verb, etc.) outside protected spans. These are warnings only — never
 * auto-fixed by applySpellingFixes.
 * @param {string} text
 * @returns {{ word: string, line: number, note: string }[]}
 */
export function scanAmbiguous(text) {
  return scanWith(text, AMBIGUOUS, (word, line, note) => ({ word, line, note }));
}

/**
 * Apply British spelling fixes to unprotected text, preserving case and leaving protected
 * spans (code spans, bare URLs, markdown link destinations) untouched.
 * @param {string} text
 * @returns {{ text: string, fixed: string[] }}
 */
export function applySpellingFixes(text) {
  const fixed = [];
  const out = text
    .split('\n')
    .map((raw) =>
      segments(raw)
        .map((seg) => {
          if (seg.protected) return seg.text;
          return seg.text.replace(/[A-Za-z]+/g, (w) => {
            const fix = AMERICAN[w.toLowerCase()];
            if (!fix) return w;
            fixed.push(w);
            return applyCase(w, fix);
          });
        })
        .join(''),
    )
    .join('\n');
  return { text: out, fixed };
}
