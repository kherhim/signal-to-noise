#!/usr/bin/env node
/**
 * pull-quarter.mjs — print one quarter's figures for the hyperscaler cash tracker.
 *
 *   node scripts/trackers/hyperscalers/pull-quarter.mjs META 2026-09-30
 *
 * Reads SEC EDGAR company facts (XBRL) and prints $bn values for review.
 * Never writes quarters.json: a person checks the numbers against the filing
 * and adds the row by hand in a PR. Cash-flow facts are tagged year to date,
 * so the quarter is the period's YTD figure minus the previous quarter's YTD
 * (a fiscal first quarter is used as is).
 */
const CIK = { MSFT: 789019, GOOGL: 1652044, AMZN: 1018724, META: 1326801, ORCL: 1341439 };
const FLOW = {
  ocf: ['NetCashProvidedByUsedInOperatingActivities'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  buybacks: ['PaymentsForRepurchaseOfCommonStock'],
  finance_lease_principal: ['FinanceLeasePrincipalPayments'],
};
const STOCK = { debt: ['LongTermDebtNoncurrent', 'LongTermNotesPayableNoncurrent', 'OtherLongTermDebtNoncurrent'] };

const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;

export function quarterFlow(facts, end) {
  const f = facts.filter((x) => x.form?.startsWith('10-') && x.start && x.end);
  const cur = f.filter((x) => x.end === end).sort((a, b) => days(a.start, a.end) - days(b.start, b.end));
  if (!cur.length) return null;
  const q = cur.find((x) => days(x.start, x.end) < 100);
  if (q) return q.val;
  const ytd = cur[0];
  const prev = f.find((x) => x.start === ytd.start && days(x.end, end) > 80 && days(x.end, end) < 100);
  return prev ? ytd.val - prev.val : null;
}

export const stockAt = (facts, end) => facts.find((x) => x.end === end && !x.start)?.val ?? null;

async function main([ticker, end]) {
  const cik = CIK[ticker];
  if (!cik || !/^\d{4}-\d{2}-\d{2}$/.test(end ?? '')) throw new Error('usage: pull-quarter.mjs <MSFT|GOOGL|AMZN|META|ORCL> <YYYY-MM-DD>');
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`, {
    headers: { 'User-Agent': 'signal-to-noise.co trackers himanshu@signal-to-noise.co' },
  });
  if (!res.ok) throw new Error(`EDGAR ${res.status}`);
  const gaap = (await res.json()).facts['us-gaap'];
  const usd = (tag) => gaap[tag]?.units?.USD ?? [];
  const bn = (v) => (v == null ? 'not tagged' : (v / 1e9).toFixed(3));
  const pick = (tags, fn) => { for (const t of tags) { const v = fn(usd(t), end); if (v != null) return [v, t]; } return [null, tags[0]]; };
  console.log(`${ticker} quarter ending ${end} ($bn)`);
  for (const [k, tags] of Object.entries(FLOW)) { const [v, t] = pick(tags, quarterFlow); console.log(`  ${k.padEnd(24)} ${bn(v).padStart(10)}  ${t}`); }
  for (const [k, tags] of Object.entries(STOCK)) { const [v, t] = pick(tags, stockAt); console.log(`  ${k.padEnd(24)} ${bn(v).padStart(10)}  ${t}`); }
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
