/* FIG. 57 · COMPUTE, PROMISED
   A five-by-five grid of squares. One, top left, is solid cream: a year of
   sales. The other twenty-four are cream outlines: the compute already
   promised, roughly twenty-five years of sales in commitments.

   Motion: the loop opens on the solid square alone. The outlines then
   appear one by one, row by row, until the grid is full. Two-beat hold.
   Rest: the still. */
import {
  type Cover, CREAM, EASE_OUT,
  svg, rect, g, figMark, captionBlock, hold, loop, q, stagger,
} from './_lib.ts';

const N = 5, S = 118, GAP = 30;
const SIDE = N * S + (N - 1) * GAP;
const X0 = (2400 - SIDE) / 2, Y0 = 250;

const cover: Cover = {
  slug: 'ask-warren-anthropic-ipo',
  fig: '57',
  caption: 'COMPUTE, PROMISED',
  motionPx: 455,

  still(alt) {
    const cells: string[] = [];
    for (let i = 0; i < N * N; i++) {
      const x = X0 + (i % N) * (S + GAP);
      const y = Y0 + Math.floor(i / N) * (S + GAP);
      const solid = i === 0;
      cells.push(rect({
        'data-cell': i, x, y, w: S, h: S,
        fill: solid ? CREAM : 'none',
        stroke: solid ? 'none' : CREAM, 'stroke-width': solid ? undefined : 4,
      }));
    }
    return svg(cover.slug, alt, [figMark(cover.fig), g(cells), captionBlock(cover.caption)]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const cells = q<SVGRectElement>(root, '[data-cell]').slice(1);
    cells.forEach((cell, i) => {
      const s = stagger(i, cells.length, 0.08, 0.66);
      anims.push(loop(cell, hold([
        { offset: 0, opacity: 0 },
        { offset: s, opacity: 0, easing: EASE_OUT },
        { offset: Math.min(s + 0.05, 0.8), opacity: 1 },
      ])));
    });
    return anims;
  },
};

export default cover;
