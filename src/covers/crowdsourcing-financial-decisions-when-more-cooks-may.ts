/* FIG. 21 · JUDGEMENT, POOLED
   A ruler scale across the lower third; a dashed vertical hairline marks
   one point on it, the true value. Above, forty small ash squares scatter
   widely: the independent estimates. A solid cream circle, their average,
   rests on the scale touching the dashed line; a larger outlined circle,
   the single expert, sits well to its left.

   Motion: the squares drop in one at a time, each landing over a
   different point on the scale. With every arrival the cream circle
   slides a step towards the dashed line, settling on it as the last
   square lands. The outlined circle never moves. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, ASH_DIM, EASE_OUT, STEP,
  svg, square, circle, line, ruler, g, figMark, captionBlock, prng, hold, loop, stagger, q,
} from './_lib.ts';

const X0 = 260, X1 = 2140;
const RULE_Y = 960;
const TRUTH_X = 1320;
const N = 40;
const SZ = 44;
const CROWD_START = -560;      // where the cream circle begins, relative to rest
const rand = prng(21);
/* Each estimate: x on the scale (a wide, roughly bell-shaped scatter
   about the truth) and a height above it. */
const ESTIMATES: Array<{ x: number; y: number }> = [];
while (ESTIMATES.length < N) {
  const u = (rand() + rand() + rand()) / 3;          // 0..1, peaked at 0.5
  const x = Math.round(TRUTH_X + (u - 0.5) * 1760);
  const y = Math.round(320 + rand() * 500);
  if (ESTIMATES.every((e) => Math.hypot(e.x - x, e.y - y) > 78)) ESTIMATES.push({ x, y });
}

const cover: Cover = {
  slug: 'crowdsourcing-financial-decisions-when-more-cooks-may',
  fig: '21',
  caption: 'JUDGEMENT, POOLED',

  still(alt) {
    const squares = ESTIMATES.map((e, i) => square({ 'data-est': i, cx: e.x, cy: e.y, s: SZ, fill: ASH }));
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      ruler({ x1: X0, x2: X1, y: RULE_Y, step: 47, every: 5 }),
      line({ x1: TRUTH_X, y1: 260, x2: TRUTH_X, y2: RULE_Y + 21, stroke: ASH_DIM, 'stroke-width': 2, 'stroke-dasharray': '14 12' }),
      g(squares),
      circle({ cx: 640, cy: RULE_Y - 64, r: 62, fill: 'none', stroke: CREAM_DIM, 'stroke-width': 2 }),
      circle({ 'data-crowd': '', cx: TRUTH_X, cy: RULE_Y - 44, r: 42, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const DROP = 0.05;
    const first = 0.06, last = 0.74;
    const squares = q<SVGRectElement>(root, '[data-est]');
    const n = squares.length;
    squares.forEach((sq, i) => {
      const at = stagger(i, n, first, last);
      anims.push(loop(sq, hold([
        { offset: 0, transform: 'translateY(0px)', opacity: 1, easing: 'ease-in' },
        { offset: 0.03, transform: 'translateY(0px)', opacity: 0, easing: STEP },
        { offset: at, transform: 'translateY(-260px)', opacity: 0, easing: EASE_OUT },
        { offset: at + 0.008, transform: 'translateY(-220px)', opacity: 1, easing: 'cubic-bezier(0.4, 0, 0.9, 0.6)' },
        { offset: at + DROP, transform: 'translateY(0px)', opacity: 1 },
      ])));
    });

    const crowd = root.querySelector<SVGCircleElement>('[data-crowd]');
    if (crowd) {
      const frames: Keyframe[] = [
        { offset: 0, transform: 'translateX(0px)', easing: STEP },
        { offset: 0.03, transform: `translateX(${CROWD_START}px)`, easing: STEP },
      ];
      for (let i = 0; i < n; i++) {
        const land = stagger(i, n, first, last) + DROP;
        const dx = CROWD_START * (1 - (i + 1) / n);
        frames.push({ offset: land, transform: `translateX(${dx.toFixed(1)}px)`, easing: EASE_OUT });
        frames.push({ offset: Math.min(land + 0.012, 0.8), transform: `translateX(${dx.toFixed(1)}px)`, easing: STEP });
      }
      // the last landing is already at the rest transform; make sure of it
      frames.push({ offset: 0.8, transform: 'translateX(0px)' });
      anims.push(loop(crowd, hold(frames)));
    }
    return anims;
  },
};

export default cover;
