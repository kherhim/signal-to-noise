/* FIG. 17 · VARIANCE, REMEMBERED
   A ticked baseline; a hairline above it at the mean. Fourteen squares
   run left to right, hovering close to the mean: the interactions. The
   ninth has dropped far below, near the baseline: the one bad one. Every
   square after it is only a dashed outline: the custom that never came
   back.

   Motion: squares step in left to right, one per beat, each settling
   near the mean. The ninth drops with a hard step. Every square after it
   arrives as a dashed outline only. The mean hairline never moves.
   Rest; the squares clear at the top of the loop and step in again. */
import {
  type Cover, CREAM, CREAM_DIM, ASH_DIM, EASE_OUT, STEP,
  svg, square, line, ruler, g, figMark, captionBlock, hold, loop, stagger, q,
} from './_lib.ts';

const BASE = 1000;
const MEAN = 560;
const N = 14;
const BAD = 8;                         // the ninth
const SZ = 50;
const X0 = 330, PITCH = 134;           // 330 .. 2072
const HOVER = [-28, 14, -6, 32, -38, 8, 24, -18, 0, 20, -30, 10, -12, 26];
const DROP_Y = BASE - 46;

const cover: Cover = {
  slug: 'bottomline-customer-happiness-3-cx-stories-cfo',
  fig: '17',
  caption: 'VARIANCE, REMEMBERED',

  still(alt) {
    const squares = Array.from({ length: N }, (_, i) => {
      const cx = X0 + i * PITCH;
      const cy = i === BAD ? DROP_Y : MEAN + HOVER[i];
      const gone = i > BAD;
      return square({
        'data-sq': i, cx, cy, s: SZ,
        fill: gone ? 'none' : CREAM,
        stroke: gone ? CREAM_DIM : undefined,
        'stroke-width': gone ? 2 : undefined,
        'stroke-dasharray': gone ? '10 8' : undefined,
      });
    });
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      ruler({ x1: 260, x2: 2140, y: BASE, step: 47, every: 5 }),
      line({ x1: 260, y1: MEAN, x2: 2140, y2: MEAN, stroke: ASH_DIM, 'stroke-width': 2 }),
      g(squares),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const FADE = 0.04;
    const squares = q<SVGRectElement>(root, '[data-sq]');
    const n = squares.length;
    squares.forEach((sq, i) => {
      const at = stagger(i, n, 0.08, 0.68);
      if (i === BAD) {
        // arrives at the mean like the others, then a hard step down
        const up = -(DROP_Y - MEAN);
        anims.push(loop(sq, hold([
          { offset: 0, transform: 'translateY(0px)', opacity: 1, easing: 'ease-in' },
          { offset: FADE, transform: 'translateY(0px)', opacity: 0, easing: STEP },
          { offset: at, transform: `translateY(${up - 60}px)`, opacity: 0, easing: STEP },
          { offset: at + 0.001, transform: `translateY(${up - 60}px)`, opacity: 1, easing: EASE_OUT },
          { offset: at + 0.02, transform: `translateY(${up}px)`, opacity: 1, easing: STEP },
          { offset: at + 0.032, transform: 'translateY(0px)', opacity: 1 },
        ])));
        return;
      }
      anims.push(loop(sq, hold([
        { offset: 0, transform: 'translateY(0px)', opacity: 1, easing: 'ease-in' },
        { offset: FADE, transform: 'translateY(0px)', opacity: 0, easing: STEP },
        { offset: at, transform: 'translateY(-60px)', opacity: 0, easing: STEP },
        { offset: at + 0.001, transform: 'translateY(-60px)', opacity: 1, easing: EASE_OUT },
        { offset: at + 0.025, transform: 'translateY(0px)', opacity: 1 },
      ])));
    });
    return anims;
  },
};

export default cover;
