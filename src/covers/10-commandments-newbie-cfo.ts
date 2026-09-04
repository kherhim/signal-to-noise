/* FIG. 05 · RULES, GIVEN
   A single row of ten outlined cream squares across the middle of the
   frame, evenly spaced, none filled. Nothing else.

   Motion: a flicker runs left to right. Each square fills solid for a
   beat, then returns to outline before the next fills. After the tenth
   the row rests empty; the loop is seamless. Pairs with the experienced
   cover (same square size, a row instead of a column). */
import {
  type Cover, CREAM, STEP,
  svg, square, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const N = 10;
const CY = 675;
const SZ = 56;
const PITCH = 160;
const X0 = 1200 - ((N - 1) * PITCH) / 2;   // 480 … 1920

const cover: Cover = {
  slug: '10-commandments-newbie-cfo',
  fig: '05',
  caption: 'RULES, GIVEN',

  still(alt) {
    const squares: string[] = [];
    for (let i = 0; i < N; i++) {
      squares.push(square({ 'data-rule': i, cx: X0 + i * PITCH, cy: CY, s: SZ, 'fill-opacity': 0 }));
    }
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(squares, { fill: CREAM, stroke: CREAM, 'stroke-width': 3 }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const BEAT = 0.06;
    q<SVGRectElement>(root, 'rect[data-rule]').forEach((r) => {
      const i = Number(r.dataset.rule);
      const on = 0.04 + i * BEAT;
      anims.push(loop(r, hold([
        { offset: 0, fillOpacity: 0, easing: STEP },
        { offset: on, fillOpacity: 1, easing: STEP },
        { offset: on + BEAT, fillOpacity: 0 },
      ])));
    });
    return anims;
  },
};

export default cover;
