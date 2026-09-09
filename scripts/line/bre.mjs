export const AMERICAN = {
  behavior: 'behaviour', behaviors: 'behaviours', color: 'colour', colors: 'colours', favor: 'favour', favorite: 'favourite',
  honor: 'honour', labor: 'labour', neighbor: 'neighbour', rumor: 'rumour', humor: 'humour', harbor: 'harbour',
  center: 'centre', centers: 'centres', meter: 'metre', meters: 'metres', theater: 'theatre', fiber: 'fibre', liter: 'litre',
  defense: 'defence', offense: 'offence', pretense: 'pretence', license: 'licence',
  analyze: 'analyse', analyzed: 'analysed', analyzing: 'analysing', paralyze: 'paralyse', catalyze: 'catalyse',
  optimize: 'optimise', optimized: 'optimised', optimizing: 'optimising', optimization: 'optimisation',
  organize: 'organise', organized: 'organised', organization: 'organisation', organizations: 'organisations',
  realize: 'realise', realized: 'realised', recognize: 'recognise', recognized: 'recognised', prioritize: 'prioritise',
  capitalize: 'capitalise', capitalized: 'capitalised', monetize: 'monetise', monetized: 'monetised', minimize: 'minimise',
  maximize: 'maximise', standardize: 'standardise', summarize: 'summarise', emphasize: 'emphasise', criticize: 'criticise',
  program: 'programme', programs: 'programmes', catalog: 'catalogue', dialog: 'dialogue', gray: 'grey', mold: 'mould',
  traveled: 'travelled', traveling: 'travelling', canceled: 'cancelled', modeling: 'modelling', modeled: 'modelled',
  labeled: 'labelled', fulfill: 'fulfil', enroll: 'enrol', skillful: 'skilful', artifact: 'artefact', artifacts: 'artefacts',
  aluminum: 'aluminium', jewelry: 'jewellery', pajamas: 'pyjamas',
};
// House style: "learned" (not "learnt") is correct and is deliberately absent from the map.

function stripCodeAndUrls(line) {
  return line.replace(/`[^`]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\]\([^)]*\)/g, ']');
}

export function scanBrE(text) {
  const flags = [];
  text.split('\n').forEach((raw, i) => {
    const line = stripCodeAndUrls(raw);
    for (const m of line.matchAll(/[A-Za-z]+/g)) {
      const w = m[0], lw = w.toLowerCase();
      if (lw in AMERICAN && !(lw === 'license' && /license (to|the|a|it)/i.test(line))) {
        if (lw === 'program' && /\b(software|computer) program/i.test(line)) continue;
        flags.push({ word: w, line: i + 1, fix: AMERICAN[lw] });
      }
    }
  });
  return flags;
}

export function applySpellingFixes(text) {
  const fixed = [];
  const out = text.split('\n').map((raw) => {
    const protectedLine = stripCodeAndUrls(raw);
    if (protectedLine !== raw && /`|https?:/.test(raw)) return raw; // leave lines with code/urls untouched
    return raw.replace(/[A-Za-z]+/g, (w) => {
      const fix = AMERICAN[w.toLowerCase()];
      if (!fix) return w;
      fixed.push(w);
      return w[0] === w[0].toUpperCase() ? fix[0].toUpperCase() + fix.slice(1) : fix;
    });
  }).join('\n');
  return { text: out, fixed };
}
