/* FIG. 19 · TREASURY, LOAD-BEARING
   A wide slab of solid cream squares, three rows deep, spans the upper
   half: the company. Beneath it, dead centre, one narrow ash column
   carries the slab down to the baseline: the treasurer. Either side two
   faint outlined columns reach the slab too, touching it, carrying
   nothing: the visible functions everyone credits.

   Motion: the loop opens with the two outer columns solid cream,
   apparently load-bearing, and the centre column barely visible. Over
   twelve seconds the outer pair fade to faint outlines while the centre
   rises to full ash. The slab never moves. Rest; restart. */
import {
  type Cover, CREAM, ASH, ASH_DIM, EASE_IN_OUT,
  svg, square, rect, line, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const SZ = 50, PITCH = 80;
const COLS = 23;                       // 300 .. 2060
const X0 = 300;
const ROWS = [380, 460, 540];
const SLAB_BOTTOM = ROWS[2] + SZ / 2;  // 565
const BASE = 1040;
const CENTRE = X0 + ((COLS - 1) * PITCH) / 2;   // 1180
const COL_W = 44;
const OUTER = [CENTRE - 560, CENTRE + 560];

const cover: Cover = {
  slug: 'importance-treasurers-finance',
  fig: '19',
  caption: 'TREASURY, LOAD-BEARING',

  still(alt) {
    const slab: string[] = [];
    ROWS.forEach((cy) => {
      for (let c = 0; c < COLS; c++) slab.push(square({ cx: X0 + c * PITCH, cy, s: SZ }));
    });
    const outer = OUTER.map((x) => rect({
      'data-outer': '', x: x - COL_W / 2, y: SLAB_BOTTOM, w: COL_W, h: BASE - SLAB_BOTTOM,
      fill: CREAM, 'fill-opacity': 0, stroke: ASH_DIM, 'stroke-width': 2,
    }));
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      line({ x1: 260, y1: BASE, x2: 2140, y2: BASE, stroke: ASH_DIM, 'stroke-width': 2 }),
      g(outer),
      rect({ 'data-centre': '', x: CENTRE - COL_W / 2, y: SLAB_BOTTOM, w: COL_W, h: BASE - SLAB_BOTTOM, fill: ASH }),
      g(slab, { fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const END = 12000 / 18000;     // twelve seconds
    q<SVGRectElement>(root, '[data-outer]').forEach((el) => {
      anims.push(loop(el, hold([
        { offset: 0, fillOpacity: 1, strokeOpacity: 1 },
        { offset: 0.06, fillOpacity: 1, strokeOpacity: 1, easing: EASE_IN_OUT },
        { offset: END, fillOpacity: 0, strokeOpacity: 1 },
      ])));
    });
    const centre = root.querySelector<SVGRectElement>('[data-centre]');
    if (centre) {
      anims.push(loop(centre, hold([
        { offset: 0, opacity: 0.12 },
        { offset: 0.06, opacity: 0.12, easing: EASE_IN_OUT },
        { offset: END, opacity: 1 },
      ])));
    }
    return anims;
  },
};

export default cover;
