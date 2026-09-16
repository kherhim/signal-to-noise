/* FIG. 51 · JUDGEMENT, UNDISCOUNTED
   Seven columns in a row, each in two parts: a solid cream plinth of one
   fixed height (the expert hours it takes to check the work) and an ash
   block standing on it (the cost of generating the work). Left to right
   the ash steps down towards nothing and never reaches the baseline; the
   cream row does not change. A dashed hairline continues the top of the
   plinths past the last column: the premium goes on being paid after the
   token price has stopped mattering.

   Motion: the loop opens on the old skyline, every ash block at full
   height. One column after another the ash falls to its resting height
   while the cream underneath stays exactly where it is. When the last
   fall lands the dashed continuation fades in, and the loop rests on the
   still. */
import {
  type Cover, CREAM, ASH, EASE_IN_OUT,
  svg, rect, line, g, figMark, captionBlock, hold, loop, stagger, q,
} from './_lib.ts';

const X0 = 160, PITCH = 280, COL_W = 190;
const BASE = 1080, PLINTH = 180, TOP = BASE - PLINTH;
const FULL = 600;
const ASH_H = [600, 395, 260, 170, 110, 70, 45];
const colX = (i: number) => X0 + i * PITCH;

const cover: Cover = {
  slug: 'the-verification-premium',
  fig: '51',
  caption: 'JUDGEMENT, UNDISCOUNTED',
  motionPx: 555,

  still(alt) {
    const plinths = ASH_H.map((_, i) => rect({ x: colX(i), y: TOP, w: COL_W, h: PLINTH }));
    const blocks = ASH_H.map((h, i) => rect({ x: colX(i), y: TOP - h, w: COL_W, h, 'data-block': i, 'data-h': h }));
    const lastEnd = colX(ASH_H.length - 1) + COL_W;

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(blocks, { fill: ASH }),
      g(plinths, { fill: CREAM }),
      line({
        x1: lastEnd + 40, y1: TOP, x2: 2240, y2: TOP, stroke: ASH, 'stroke-width': 3,
        'stroke-dasharray': '18 14', 'data-future': '',
      }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const FALL = 0.16;
    const blocks = q<SVGRectElement>(root, 'rect[data-block]');
    const falling = blocks.filter((b) => Number(b.dataset.h) < FULL);
    const n = falling.length;

    // Each ash block starts at the old full height and falls to rest on its
    // plinth. The plinth is not animated: it does not move.
    falling.forEach((b, j) => {
      const i = Number(b.dataset.block), h = Number(b.dataset.h);
      const k = (FULL / h).toFixed(4);
      const s = stagger(j, n, 0.06, 0.5);
      b.setAttribute('style', `transform-box: view-box; transform-origin: ${colX(i) + COL_W / 2}px ${TOP}px`);
      anims.push(loop(b, hold([
        { offset: 0, transform: `scaleY(${k})`, opacity: 0, easing: EASE_IN_OUT },
        { offset: 0.04, transform: `scaleY(${k})`, opacity: 1 },
        { offset: s, transform: `scaleY(${k})`, opacity: 1, easing: EASE_IN_OUT },
        { offset: s + FALL, transform: 'scaleY(1)', opacity: 1 },
      ])));
    });

    // The continuation appears once the last fall has landed.
    const future = root.querySelector<SVGLineElement>('[data-future]');
    if (future) {
      anims.push(loop(future, hold([
        { offset: 0, opacity: 0 },
        { offset: 0.66, opacity: 0, easing: EASE_IN_OUT },
        { offset: 0.76, opacity: 1 },
      ])));
    }

    return anims;
  },
};

export default cover;
