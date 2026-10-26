/* Calculations behind the hyperscaler cash tracker. Plain ESM so the page
   and node:test share one copy. Figures are $bn from SEC filings
   (src/data/hyperscalers/quarters.json). */

export const ORDER = ['Microsoft', 'Alphabet', 'Amazon', 'Meta', 'Oracle'];
export const WINDOW = 8;

// Calendar quarter as one integer, so companies with different fiscal years share an axis.
export const quarterIndex = (q) => { const [Q, y] = q.split(' '); return +y * 4 + (+Q[1] - 1); };
export const qLabel = (i) => `Q${(i % 4) + 1} ${String(Math.floor(i / 4)).slice(2)}`;
export const qFull = (i) => `Q${(i % 4) + 1} ${Math.floor(i / 4)}`;

export const windowed = (qs, n = WINDOW) => qs.slice(-n);

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// Free cash flow as each company defines it; capital spending shown is what
// makes the gap match that figure.
const fcfOf = (q) => q.fcf_company_def ?? q.fcf ?? +(q.ocf - q.capex).toFixed(2);

export function prepare(data) {
  return ORDER.map((name) => data.companies.find((c) => c.name === name)).filter(Boolean).map((c) => {
    const qs = windowed([...c.quarters].sort((a, b) => quarterIndex(a.q) - quarterIndex(b.q))).map((q) => {
      const fcf = fcfOf(q);
      return { ...q, i: quarterIndex(q.q), fcf, capexShown: +(q.ocf - fcf).toFixed(2) };
    });
    return { name: c.name, qs };
  });
}

// Each company's own latest quarter, and the four before it for the year-ago debt.
export function tiles(rows) {
  const last4 = (r, k) => sum(r.qs.slice(-4).map((q) => q[k]));
  const debtNow = sum(rows.map((r) => r.qs.at(-1).debt));
  const debtYearAgo = sum(rows.map((r) => r.qs.at(-5).debt));
  return {
    capexShare: sum(rows.map((r) => last4(r, 'capexShown'))) / sum(rows.map((r) => last4(r, 'ocf'))),
    negative: rows.filter((r) => r.qs.at(-1).fcf < 0).map((r) => r.name),
    buyingBack: rows.filter((r) => r.qs.at(-1).buybacks > 0).map((r) => r.name),
    debtNow,
    debtAdded: debtNow - debtYearAgo,
  };
}

export function commonQuarters(rows) {
  const all = rows.flatMap((r) => r.qs.map((q) => q.i));
  const out = [];
  for (let i = Math.min(...all); i <= Math.max(...all); i++) if (rows.every((r) => r.qs.some((q) => q.i === i))) out.push(i);
  return out;
}

export const combined = (rows, key) =>
  commonQuarters(rows).map((i) => ({ i, v: sum(rows.map((r) => r.qs.find((q) => q.i === i)[key] ?? 0)) }));

export const yMax = (rows, step = 20) =>
  Math.ceil(Math.max(...rows.flatMap((r) => r.qs.flatMap((q) => [q.ocf, q.capexShown]))) / step) * step;
