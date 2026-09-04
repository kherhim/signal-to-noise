/* FIG. 47 · PRICE, CONDITIONAL
   A ticked scale runs up the left edge. A cream hairline ceiling crosses
   at two-thirds height, the zone above it hatched in faint ash. From the
   base a solid cream column rises to one tick below the line.

   Motion: the column steps, one tick at a time, from a third of its
   height up to the ceiling and two ticks through it; while it is breached
   the hatch flickers on. It steps back down beneath the line, the hatch
   stills. Rest: column just under the ceiling, the still. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, ASH_DIM, STEP,
  svg, rect, line, g, figMark, captionBlock, hold, loop,
} from './_lib.ts';

const BASE = 1100;        // ground line
const TOP = 260;          // top of the scale
const TICK = 40;          // one tick, in units
const CEIL_H = 14 * TICK; // ceiling sits 14 ticks up (two-thirds of 21)
const CEIL_Y = BASE - CEIL_H;
const REST_H = 13 * TICK; // the column rests one tick under the line
const COL_X = 1240, COL_W = 240;
const SCALE_X = 400, X1 = 480, X2 = 2040;

const cover: Cover = {
  slug: 'ask-warren-buyback-multiple',
  fig: '47',
  caption: 'PRICE, CONDITIONAL',

  still(alt) {
    // vertical scale, ticks to the left, a major every five
    const ticks: string[] = [line({ x1: SCALE_X, y1: BASE, x2: SCALE_X, y2: TOP })];
    for (let i = 0; i <= (BASE - TOP) / TICK; i++) {
      const y = BASE - i * TICK;
      ticks.push(line({ x1: SCALE_X, y1: y, x2: SCALE_X - (i % 5 === 0 ? 21 : 10), y2: y }));
    }

    // hatch above the ceiling: diagonal hairlines, clipped to the zone
    const hatch: string[] = [];
    const rise = CEIL_Y - TOP;
    for (let x = X1 - rise; x <= X2; x += 48) {
      hatch.push(line({ x1: x, y1: CEIL_Y, x2: x + rise, y2: TOP }));
    }

    return svg(cover.slug, alt, [
      `<defs><clipPath id="buyback-zone">${rect({ x: X1, y: TOP, w: X2 - X1, h: rise })}</clipPath></defs>`,
      figMark(cover.fig),
      g(ticks, { stroke: CREAM_DIM, 'stroke-width': 2, fill: 'none' }),
      line({ x1: SCALE_X, y1: BASE, x2: X2, y2: BASE, stroke: ASH_DIM, 'stroke-width': 2 }),
      g(hatch, { 'data-hatch': '', stroke: ASH, 'stroke-width': 1.6, opacity: 0.4, 'clip-path': 'url(#buyback-zone)' }),
      rect({ 'data-col': '', x: COL_X - COL_W / 2, y: BASE - REST_H, w: COL_W, h: REST_H, fill: CREAM }),
      line({ x1: X1, y1: CEIL_Y, x2: X2, y2: CEIL_Y, stroke: CREAM, 'stroke-width': 2 }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const col = root.querySelector<SVGRectElement>('[data-col]');
    const hatch = root.querySelector<SVGGElement>('[data-hatch]');

    /* Heights in ticks: 5 up to 16 (two through the 14-tick ceiling),
       then back down to 13. Each state holds for one step. */
    const ticks = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 15, 14, 13];
    const T0 = 0.06, DT = 0.045;
    const at = (k: number) => T0 + k * DT;

    if (col) {
      col.setAttribute('style', `transform-box: view-box; transform-origin: ${COL_X}px ${BASE}px`);
      const frames: Keyframe[] = [{ offset: 0, transform: `scaleY(${(ticks[0] * TICK) / REST_H})`, easing: STEP }];
      ticks.forEach((t, k) => {
        frames.push({ offset: at(k), transform: `scaleY(${(t * TICK) / REST_H})`, easing: STEP });
      });
      frames[frames.length - 1] = { offset: at(ticks.length - 1), transform: 'scaleY(1)' };
      anims.push(loop(col, hold(frames)));
    }

    if (hatch) {
      // breached while the column is 15 or 16 ticks: states k = 10, 11, 12
      const on = at(10), off = at(13);
      const flicker: Keyframe[] = [
        { offset: 0, opacity: 0.4, easing: STEP },
        { offset: on, opacity: 1, easing: STEP },
        { offset: on + 0.02, opacity: 0.55, easing: STEP },
        { offset: on + 0.04, opacity: 1, easing: STEP },
        { offset: on + 0.065, opacity: 0.6, easing: STEP },
        { offset: on + 0.09, opacity: 1, easing: STEP },
        { offset: on + 0.115, opacity: 0.55, easing: STEP },
        { offset: off, opacity: 0.4 },
      ];
      anims.push(loop(hatch, hold(flicker)));
    }
    return anims;
  },
};

export default cover;
