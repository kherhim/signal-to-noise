/* FIG. 10 · STORY, THREADED
   A loose, ungridded field of small squares fills the frame, most of
   them ash outlines. A single cream hairline enters left, bends through
   seven of them, each of those seven solid cream, and exits right.
   Nothing else lit.

   Motion: the loop opens by relighting every square cream and equal. The
   hairline draws left to right, keeping each square it touches lit;
   squares it passes by fade to ash as it goes. Rest: the finished thread. */
import {
  type Cover, CREAM, ASH, STEP,
  svg, square, path, g, figMark, captionBlock, prng, hold, loop, q,
} from './_lib.ts';

const SZ = 44;
/* The seven the story keeps, left to right, with the entry and exit
   points the thread runs between. */
const ENTRY: [number, number] = [160, 880];
const EXIT: [number, number] = [2240, 700];
const KEPT: [number, number][] = [
  [360, 830], [660, 690], [940, 790], [1220, 640], [1500, 430], [1790, 520], [2040, 660],
];
const SCATTER = 38;

/* Catmull-Rom through the anchors, as cubic Béziers. */
type Seg = [number, number, number, number, number, number, number, number];
function segments(): Seg[] {
  const P = [ENTRY, ENTRY, ...KEPT, EXIT, EXIT];
  const out: Seg[] = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    out.push([
      p1[0], p1[1],
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    ]);
  }
  return out;
}
function bez(s: Seg, t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * s[0] + b * s[2] + c * s[4] + d * s[6], a * s[1] + b * s[3] + c * s[5] + d * s[7]];
}
function threadD(): string {
  const segs = segments();
  return `M${segs[0][0]},${segs[0][1]} ` + segs.map((s) => `C${s.slice(2).map((v) => v.toFixed(2)).join(',')}`).join(' ');
}

const cover: Cover = {
  slug: 'once-upon-balance-sheet-10-reasons-why-storytelling-cfos',
  fig: '10',
  caption: 'STORY, THREADED',

  still(alt) {
    // Sample the thread so the scatter keeps clear of it.
    const samples: [number, number][] = [];
    segments().forEach((s) => { for (let t = 0; t <= 1; t += 0.05) samples.push(bez(s, t)); });
    const clear = (x: number, y: number, r: number) => samples.every(([sx, sy]) => Math.hypot(sx - x, sy - y) > r);

    const rand = prng(1011);
    const placed: [number, number][] = [...KEPT];
    const scatter: string[] = [];
    let guard = 0;
    while (scatter.length < SCATTER && guard++ < 4000) {
      const x = 230 + rand() * 1940, y = 250 + rand() * 860;
      if (!clear(x, y, 78)) continue;
      if (placed.some(([px, py]) => Math.hypot(px - x, py - y) < 105)) continue;
      placed.push([x, y]);
      scatter.push(square({ 'data-x': x.toFixed(1), cx: x, cy: y, s: SZ, 'fill-opacity': 0, stroke: ASH }));
    }
    const kept = KEPT.map(([x, y]) => square({ cx: x, cy: y, s: SZ, 'fill-opacity': 1, stroke: CREAM }));

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g([...scatter, ...kept], { fill: CREAM, 'stroke-width': 2 }),
      path({ 'data-thread': '', d: threadD(), stroke: CREAM, 'stroke-width': 2, fill: 'none' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const RELIGHT = 0.004;
    const T0 = 0.05, DRAW = 9000 / 18000;     // nine seconds

    const thread = root.querySelector<SVGPathElement>('[data-thread]');
    if (!thread) return anims;
    const L = thread.getTotalLength();
    thread.style.strokeDasharray = `${L}`;
    anims.push(loop(thread, hold([
      { offset: 0, strokeDashoffset: 0, easing: STEP },
      { offset: RELIGHT, strokeDashoffset: L },
      { offset: T0, strokeDashoffset: L, easing: 'linear' },
      { offset: T0 + DRAW, strokeDashoffset: 0 },
    ])));

    /* Fraction of the thread's length at which its tip reaches x, from a
       sampled table of the live path. */
    const N = 240;
    const xs: number[] = [];
    for (let i = 0; i <= N; i++) xs.push(thread.getPointAtLength((i / N) * L).x);
    const fracAt = (x: number) => {
      for (let i = 1; i <= N; i++) {
        if (xs[i] >= x) return (i - 1 + (x - xs[i - 1]) / Math.max(1, xs[i] - xs[i - 1])) / N;
      }
      return 1;
    };

    q<SVGRectElement>(root, '[data-x]').forEach((sq) => {
      const pass = T0 + DRAW * Math.min(1, Math.max(0, fracAt(Number(sq.dataset.x))));
      anims.push(loop(sq, hold([
        { offset: 0, fillOpacity: 0, easing: STEP },
        { offset: RELIGHT, fillOpacity: 1 },
        { offset: pass, fillOpacity: 1, easing: 'ease-out' },
        { offset: pass + 0.04, fillOpacity: 0 },
      ])));
    });
    return anims;
  },
};

export default cover;
