/* FIG. 03 · BELIEF, REVISED
   Three bell curves over a ticked baseline: a wide faint outline at left
   (the prior), a dashed curve at right (the evidence), and between them a
   tall narrow filled curve (the posterior), its peak pulled towards the
   evidence. Small squares scatter above, densest over the evidence.
   Geometry measured from the original webp: baseline y 1090 from x 190
   to 2210 with a tick every 25.25; prior peak (899, 712) σ 261; evidence
   peak (1500, 599) σ 200; posterior peak (1276, 466) σ 159. Each curve is
   a Gaussian sampled at 80 points.

   Motion: the posterior opens coincident with the prior, faint and
   unfilled. The evidence arrives; the squares fall in and gather over it;
   as they land the posterior slides right and narrows, brightening to its
   filled weight. Rest: peak pulled towards the evidence, the still. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, ASH_DIM, EASE_OUT, EASE_IN_OUT,
  svg, rect, line, path, text, g, ruler, prng, hold, loop, stagger, q,
} from './_lib.ts';

const BASE = 1090;
const X0 = 190, X1 = 2210;
const PRIOR = { x: 899, top: 712, s: 261 };
const EVID = { x: 1500, top: 599, s: 200 };
const POST = { x: 1276, top: 466, s: 159 };

type Bell = { x: number; top: number; s: number };
const height = (b: Bell, x: number): number => (BASE - b.top) * Math.exp(-((x - b.x) ** 2) / (2 * b.s * b.s));

/* Sample the bell across the baseline; closed=true drops to the
   baseline at both ends for a fill. */
function bell(b: Bell, closed: boolean): string {
  const pts: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const x = X0 + ((X1 - X0) * i) / 80;
    pts.push(`${x.toFixed(1)},${(BASE - height(b, x)).toFixed(1)}`);
  }
  const d = 'M' + pts.join(' L');
  return closed ? `${d} L${X1},${BASE} L${X0},${BASE} Z` : d;
}

const cover: Cover = {
  slug: 'bayesian-thinking-for-cfos',
  fig: '03',
  caption: 'BELIEF, REVISED',

  still(alt) {
    const rand = prng(23);
    const squares: string[] = [];
    let i = 0;
    while (squares.length < 44 && i < 400) {
      i++;
      // seven in ten cluster over the evidence, the rest drift anywhere
      let x: number;
      if (rand() < 0.7) {
        const u = rand(), v = rand();
        x = EVID.x + 290 * Math.sqrt(-2 * Math.log(u + 1e-9)) * Math.cos(2 * Math.PI * v);
      } else {
        x = 860 + rand() * 1280;
      }
      if (x < 860 || x > 2160) continue;
      const roof = BASE - Math.max(height(PRIOR, x), height(EVID, x), height(POST, x)) - 40;
      const y = 170 + rand() * Math.max(40, roof - 170);
      if (y > roof) continue;
      const s = 8 + Math.round(rand() * 6);
      const o = 0.18 + rand() * 0.42;
      squares.push(rect({
        x: x - s / 2, y: y - s / 2, w: s, h: s, fill: CREAM, opacity: o.toFixed(2),
        'data-sq': '', 'data-o': o.toFixed(2),
        'data-dx': ((rand() - 0.5) * 700).toFixed(0), 'data-dy': (-(140 + rand() * 260)).toFixed(0),
        'data-t': rand().toFixed(3),
      }));
    }

    const marker = (b: Bell, stroke: string, extra: Record<string, string> = {}) =>
      line({ x1: b.x, y1: b.top, x2: b.x, y2: BASE, stroke, 'stroke-width': 2, 'stroke-dasharray': '8 8', ...extra });

    return svg(cover.slug, alt, [
      text('FIG. 03', { x: 191, y: 121, size: 29, spacing: 9.6, fill: CREAM_DIM }),
      g(squares),
      // prior: wide, faint
      path({ d: bell(PRIOR, false), fill: 'none', stroke: ASH_DIM, 'stroke-width': 2.5 }),
      marker(PRIOR, ASH_DIM),
      // evidence: dashed
      g([
        path({ d: bell(EVID, false), fill: 'none', stroke: ASH, 'stroke-width': 2.5, 'stroke-dasharray': '16 12' }),
        marker(EVID, ASH),
      ], { 'data-evidence': '' }),
      // posterior: tall, narrow, filled
      g([
        path({ d: bell(POST, true), fill: CREAM, 'fill-opacity': 0.07, stroke: 'none', 'data-post-fill': '' }),
        marker(POST, CREAM_DIM, { 'data-post-mark': '' }),
        path({ d: bell(POST, false), fill: 'none', stroke: CREAM, 'stroke-width': 4, 'stroke-opacity': 1, 'vector-effect': 'non-scaling-stroke', 'data-post-line': '' }),
      ], { 'data-posterior': '' }),
      ruler({ x1: X0, x2: X1, y: BASE, step: 25.25, every: 8, minor: 14, major: 26, stroke: ASH }),
      line({ x1: X0, y1: BASE, x2: X1, y2: BASE, stroke: CREAM, 'stroke-width': 3 }),
      // Curve labels, as on the published cover.
      text('PRIOR', { x: PRIOR.x, y: PRIOR.top - 44, size: 26, spacing: 9, fill: ASH, 'text-anchor': 'middle' }),
      text('POSTERIOR', { x: POST.x, y: POST.top - 46, size: 26, spacing: 9, fill: CREAM_DIM, 'text-anchor': 'middle' }),
      text('EVIDENCE', { x: EVID.x + 114, y: EVID.top - 43, size: 26, spacing: 9, fill: ASH, 'text-anchor': 'middle' }),
      text('BELIEF, REVISED', { x: 1001, y: 1273, size: 29, spacing: 8.6, fill: CREAM_DIM }),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];

    /* Evidence arrives first. */
    const ev = root.querySelector<SVGGElement>('[data-evidence]');
    if (ev) {
      anims.push(loop(ev, hold([
        { offset: 0, opacity: 0 },
        { offset: 0.04, opacity: 0, easing: EASE_OUT },
        { offset: 0.2, opacity: 1 },
      ])));
    }

    /* Squares fall in from above and settle, staggered. */
    const sq = q<SVGRectElement>(root, '[data-sq]').sort((a, b) => Number(a.dataset.t) - Number(b.dataset.t));
    sq.forEach((r, i) => {
      const s = stagger(i, sq.length, 0.06, 0.44);
      const from = `translate(${r.dataset.dx}px, ${r.dataset.dy}px)`;
      const o = Number(r.dataset.o);
      anims.push(loop(r, hold([
        { offset: 0, transform: from, opacity: 0 },
        { offset: s, transform: from, opacity: 0, easing: EASE_OUT },
        { offset: s + 0.05, transform: `translate(${(Number(r.dataset.dx) * 0.6).toFixed(0)}px, ${(Number(r.dataset.dy) * 0.6).toFixed(0)}px)`, opacity: o, easing: EASE_OUT },
        { offset: s + 0.16, transform: 'translate(0px, 0px)', opacity: o },
      ])));
    });

    /* The posterior opens on the prior, then slides and narrows as the
       squares land. Scale about the peak's foot on the baseline. */
    const post = root.querySelector<SVGGElement>('[data-posterior]');
    if (post) {
      post.setAttribute('style', `transform-box: view-box; transform-origin: ${POST.x}px ${BASE}px`);
      const from = `translateX(${PRIOR.x - POST.x}px) scale(${(PRIOR.s / POST.s).toFixed(3)}, ${((BASE - PRIOR.top) / (BASE - POST.top)).toFixed(3)})`;
      anims.push(loop(post, hold([
        { offset: 0, transform: from },
        { offset: 0.26, transform: from, easing: EASE_IN_OUT },
        { offset: 0.64, transform: 'translateX(0px) scale(1, 1)' },
      ])));
      const lineEl = post.querySelector<SVGPathElement>('[data-post-line]');
      if (lineEl) {
        anims.push(loop(lineEl, hold([
          { offset: 0, strokeOpacity: 0.3 },
          { offset: 0.26, strokeOpacity: 0.3, easing: EASE_IN_OUT },
          { offset: 0.64, strokeOpacity: 1 },
        ])));
      }
      const fillEl = post.querySelector<SVGPathElement>('[data-post-fill]');
      if (fillEl) {
        anims.push(loop(fillEl, hold([
          { offset: 0, fillOpacity: 0 },
          { offset: 0.3, fillOpacity: 0, easing: EASE_IN_OUT },
          { offset: 0.64, fillOpacity: 0.07 },
        ])));
      }
      const mark = post.querySelector<SVGLineElement>('[data-post-mark]');
      if (mark) {
        anims.push(loop(mark, hold([
          { offset: 0, opacity: 0 },
          { offset: 0.4, opacity: 0, easing: EASE_OUT },
          { offset: 0.66, opacity: 1 },
        ])));
      }
    }
    return anims;
  },
};

export default cover;
