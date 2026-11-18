import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isMain } from '../lib/is-main.mjs';

const DATA_URL = 'https://github.com/kherhim/signal-to-noise/blob/main/src/data/hyperscalers/quarters.json';

/** The calendar quarter that ended before the start of the previous month, e.g. "Q3 2026". */
export function expectedQuarter(now) {
  const monthIdx = now.getUTCMonth() - 1; // start of previous month (may be -1)
  const idx = (now.getUTCFullYear() * 12 + monthIdx); // months since year 0
  const qIdx = Math.floor(idx / 3) - 1; // quarters since year 0, last one completed
  const year = Math.floor(qIdx / 4);
  return `Q${(qIdx % 4 + 4) % 4 + 1} ${year}`;
}

const rank = (q) => {
  const m = /^Q([1-4]) (\d{4})$/.exec(q);
  return m ? Number(m[2]) * 4 + Number(m[1]) : -Infinity;
};

/** Names of companies whose latest quarter is earlier than expectedQuarter(now). */
export function missingCompanies(data, now) {
  const want = rank(expectedQuarter(now));
  return data.companies
    .filter((c) => Math.max(-Infinity, ...c.quarters.map((x) => rank(x.q))) < want)
    .map((c) => c.name);
}

export function planIssue({ missing, quarter, openIssues }) {
  if (!missing.length) return { action: 'none' };
  const title = `Hyperscaler tracker: ${quarter} results to add`;
  const body = [
    `The ${quarter} results are not yet in the hyperscaler tracker for:`,
    '',
    ...missing.map((n) => `- ${n}`),
    '',
    `Add them to [src/data/hyperscalers/quarters.json](${DATA_URL}) once the filings are out.`,
  ].join('\n');
  const open = openIssues.find((i) => i.title === title);
  return open ? { action: 'comment', title, body, number: open.number } : { action: 'open', title, body };
}

function main() {
  const data = JSON.parse(fs.readFileSync(new URL('../../src/data/hyperscalers/quarters.json', import.meta.url), 'utf8'));
  const now = new Date();
  const quarter = expectedQuarter(now);
  const missing = missingCompanies(data, now);
  if (!missing.length) {
    console.log(`All companies have ${quarter}; nothing to do.`);
    return;
  }
  const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8' });
  const openIssues = JSON.parse(gh('issue', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title'));
  const plan = planIssue({ missing, quarter, openIssues });
  if (plan.action === 'open') console.log(gh('issue', 'create', '--title', plan.title, '--body', plan.body).trim());
  else if (plan.action === 'comment') console.log(gh('issue', 'comment', String(plan.number), '--body', plan.body).trim());
}

if (isMain(import.meta.url, process.argv[1])) main();
