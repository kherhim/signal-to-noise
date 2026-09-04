/* FIG. 43 · BOTTLENECK, BROKEN
   A ticked baseline spans six centuries, 1450 to 2050, a major tick at
   each century. One cream line rises left to right, nearly flat, then
   steepening twice. Solid circles mark the two breaks, 1450 and 2026; an
   outlined circle marks the Industrial Revolution between them. Faint
   hairline verticals drop from each marker to the baseline.

   Motion: the line draws itself from the left over about twelve seconds;
   each marker scales in from nothing as the line reaches it, the final
   solid circle last, top right. Two-beat hold. Rest: the still. */
import {
  type Cover, CANVAS, CREAM, CREAM_DIM, ASH_DIM, EASE_OUT,
  svg, circle, line, path, g, figMark, captionBlock, ruler, hold, loop, q,
} from './_lib.ts';

const BASE = 1060, X1 = 360, X2 = 2040;
const PX_PER_YEAR = (X2 - X1) / 600;
const yearX = (y: number) => X1 + (y - 1450) * PX_PER_YEAR;

/* The three markers: year, height, kind (1 solid, 2 outline), radius. */
const MARKS = [
  { year: 1450, y: 980, kind: 1, r: 22 },
  { year: 1800, y: 800, kind: 2, r: 22 },
  { year: 2026, y: 280, kind: 1, r: 26 },
];

const CURVE =
  `M${yearX(1450)},980 ` +
  `C760,968 1120,940 ${yearX(1800)},800 ` +
  `C1560,660 1760,560 1880,450 ` +
  `C1940,395 1962,330 ${yearX(2026).toFixed(1)},280`;

const cover: Cover = {
  slug: '600-year-curve-why-your-ai-anxiety-actually-history-repeating',
  fig: '43',
  caption: 'BOTTLENECK, BROKEN',

  still(alt) {
    const drops: string[] = [], marks: string[] = [];
    MARKS.forEach((m, i) => {
      const x = yearX(m.year);
      drops.push(line({ 'data-drop': i, x1: x, y1: m.y + m.r + 6, x2: x, y2: BASE - 2 }));
      marks.push(circle({
        'data-mark': i, 'data-x': x.toFixed(1), cx: x, cy: m.y, r: m.r,
        fill: m.kind === 1 ? CREAM : CANVAS, stroke: CREAM, 'stroke-width': 3,
      }));
    });

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      ruler({ x1: X1, x2: X2, y: BASE, step: 56, every: 5, stroke: CREAM_DIM }),
      g(drops, { stroke: ASH_DIM, 'stroke-width': 1.6 }),
      path({ 'data-curve': '', d: CURVE, fill: 'none', stroke: CREAM, 'stroke-width': 4, 'stroke-linecap': 'round' }),
      g(marks),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const curve = root.querySelector<SVGPathElement>('[data-curve]');
    if (!curve) return anims;
    const T0 = 0.02, T1 = 0.7;       // the draw runs T0 → T1
    const len = curve.getTotalLength();
    curve.setAttribute('stroke-dasharray', String(len));
    anims.push(loop(curve, hold([
      { offset: 0, strokeDashoffset: len },
      { offset: T0, strokeDashoffset: len, easing: 'linear' },
      { offset: T1, strokeDashoffset: 0 },
    ])));

    /* Arc-length fraction at which the pen reaches x, by bisection. */
    const fractionAt = (x: number): number => {
      let lo = 0, hi = len;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (curve.getPointAtLength(mid).x < x) lo = mid; else hi = mid;
      }
      return lo / len;
    };

    q<SVGCircleElement>(root, '[data-mark]').forEach((mark) => {
      const i = mark.dataset.mark;
      const t = T0 + fractionAt(Number(mark.dataset.x)) * (T1 - T0);
      mark.setAttribute('style', 'transform-box: fill-box; transform-origin: center');
      anims.push(loop(mark, hold([
        { offset: 0, transform: 'scale(0)', opacity: 0 },
        { offset: t, transform: 'scale(0)', opacity: 0, easing: EASE_OUT },
        { offset: t + 0.04, transform: 'scale(1)', opacity: 1 },
      ])));
      const drop = root.querySelector<SVGLineElement>(`[data-drop="${i}"]`);
      if (drop) {
        anims.push(loop(drop, hold([
          { offset: 0, opacity: 0 },
          { offset: t, opacity: 0, easing: EASE_OUT },
          { offset: t + 0.06, opacity: 1 },
        ])));
      }
    });
    return anims;
  },
};

export default cover;
