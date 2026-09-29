/* FIG. 54 · GAP, UNBANKED
   Twelve months left to right. A dashed ash line climbs gently across the
   frame: the budget, priced the way every budget is priced, a little dearer
   each year. Below it a row of cream squares, one per month, falls away on a
   geometric curve: the unit price of the input. A fine ash hairline hangs
   from the budget line down to each square. That widening gap is the
   underspend, and the essay's argument is that it is a reserve, not a
   saving. A cream polyline joins the squares so the curve reads as one
   price.

   Motion: the loop opens with every square sitting on the budget line, the
   price the plan assumed. Month by month each square drops to its resting
   place and its hairline stretches with it. When the last month lands the
   polyline fades in, and the loop rests on the still. */
import {
  type Cover, CREAM, ASH, EASE_IN_OUT,
  svg, square, line, path, g, ruler, figMark, captionBlock, hold, loop, stagger, q, fmt,
} from './_lib.ts';

const N = 12, X0 = 260, PITCH = 170, S = 34;
const TOP = 430, FLOOR = 1060, RISE = 5, DECAY = 0.82;
const colX = (i: number) => X0 + i * PITCH;
const budgetY = (x: number) => TOP - ((x - X0) / PITCH) * RISE;
const priceY = (i: number) => FLOOR - Math.pow(DECAY, i) * (FLOOR - TOP);

const cover: Cover = {
  slug: 'budgeting-for-deflation',
  fig: '54',
  caption: 'GAP, UNBANKED',
  motionPx: Math.round(priceY(N - 1) - budgetY(colX(N - 1))),

  still(alt) {
    const idx = Array.from({ length: N }, (_, i) => i);
    const gaps = idx.slice(1).map((i) => line({
      x1: colX(i), y1: budgetY(colX(i)), x2: colX(i), y2: priceY(i), 'data-gap': i,
    }));
    const dots = idx.map((i) => square({ cx: colX(i), cy: priceY(i), s: S, 'data-dot': i }));
    const curve = 'M' + idx.map((i) => `${fmt(colX(i))} ${fmt(priceY(i))}`).join(' L');

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      line({
        x1: 180, y1: budgetY(180), x2: 2240, y2: budgetY(2240), stroke: ASH, 'stroke-width': 3,
        'stroke-dasharray': '18 14',
      }),
      g(gaps, { stroke: ASH, 'stroke-width': 3 }),
      path({ d: curve, fill: 'none', stroke: CREAM, 'stroke-width': 3, 'data-curve': '' }),
      g(dots, { fill: CREAM }),
      ruler({ x1: X0, x2: colX(N - 1), y: 1130, step: PITCH / 2, every: 2 }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const FALL = 0.14;
    const n = N - 1;

    // Each square starts on the budget line and falls to its price; its
    // hairline grows from the budget line down with it. Month 0 sits on the
    // line already and does not move.
    q<SVGRectElement>(root, 'rect[data-dot]').forEach((d) => {
      const i = Number(d.dataset.dot);
      if (i === 0) return;
      const up = fmt(budgetY(colX(i)) - priceY(i));
      const s = stagger(i - 1, n, 0.06, 0.55);
      anims.push(loop(d, hold([
        { offset: 0, transform: `translateY(${up}px)` },
        { offset: s, transform: `translateY(${up}px)`, easing: EASE_IN_OUT },
        { offset: s + FALL, transform: 'translateY(0px)' },
      ])));
    });

    q<SVGLineElement>(root, 'line[data-gap]').forEach((l) => {
      const i = Number(l.dataset.gap);
      const s = stagger(i - 1, n, 0.06, 0.55);
      l.setAttribute('style', `transform-box: view-box; transform-origin: ${colX(i)}px ${budgetY(colX(i))}px`);
      anims.push(loop(l, hold([
        { offset: 0, transform: 'scaleY(0)' },
        { offset: s, transform: 'scaleY(0)', easing: EASE_IN_OUT },
        { offset: s + FALL, transform: 'scaleY(1)' },
      ])));
    });

    // The curve joins the squares once the last month has landed.
    const curve = root.querySelector<SVGPathElement>('[data-curve]');
    if (curve) {
      anims.push(loop(curve, hold([
        { offset: 0, opacity: 0 },
        { offset: 0.66, opacity: 0, easing: EASE_IN_OUT },
        { offset: 0.76, opacity: 1 },
      ])));
    }

    return anims;
  },
};

export default cover;
