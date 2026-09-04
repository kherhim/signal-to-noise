/* FIG. 48 · LIQUIDITY, STANDING
   One tall solid cream column stands while five thinner ash columns
   around it lean and, two of them, snap into offset segments. A hairline
   waterline crosses the lower third with a faint tide beneath it.

   Motion: the waterline rises from the baseline to the still's height.
   As it climbs, the thin columns buckle in order of thinness: each tilts
   about its base, its upper segment dropping and fading to ash. The cream
   column never moves. Rest: water at the still's line, columns as drawn. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, ASH_DIM, EASE_IN_OUT,
  svg, rect, line, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const BASE = 1060;          // ground line
const WATER = 880;          // resting waterline
const RISE = BASE - WATER;  // how far the water travels

/* Thin columns: x centre, width, height, resting tilt (deg), break point
   as a fraction of height (0 = unbroken), buckle order. */
const THIN = [
  { x: 560,  w: 56, h: 620, tilt: -9,  brk: 0.55, order: 3 },
  { x: 740,  w: 40, h: 540, tilt: -6,  brk: 0,    order: 1 },
  { x: 1200, w: 34, h: 500, tilt: 7,   brk: 0,    order: 0 },
  { x: 1380, w: 48, h: 600, tilt: 8,   brk: 0.6,  order: 2 },
  { x: 1660, w: 60, h: 660, tilt: 5,   brk: 0,    order: 4 },
];

const cover: Cover = {
  slug: 'buffett-on-the-fortress-balance-sheet',
  fig: '48',
  caption: 'LIQUIDITY, STANDING',

  still(alt) {
    const columns = THIN.map((c, i) => {
      const top = BASE - c.h;
      if (!c.brk) {
        return g(
          rect({ x: c.x - c.w / 2, y: top, w: c.w, h: c.h, fill: ASH }),
          { 'data-col': i, 'data-tilt': c.tilt, transform: `rotate(${c.tilt} ${c.x} ${BASE})` },
        );
      }
      const breakY = BASE - c.h * c.brk;
      const lower = rect({ x: c.x - c.w / 2, y: breakY, w: c.w, h: BASE - breakY, fill: ASH });
      const upperTilt = c.tilt * 1.6;
      const upper = g(
        rect({ x: c.x - c.w / 2, y: top, w: c.w, h: breakY - top - 6, fill: ASH_DIM }),
        { 'data-upper': i, 'data-tilt': upperTilt, transform: `rotate(${upperTilt} ${c.x} ${breakY})` },
      );
      return g(lower + upper, { 'data-col': i, 'data-tilt': c.tilt, transform: `rotate(${c.tilt} ${c.x} ${BASE})` });
    });

    const water = g(
      rect({ x: 360, y: WATER, w: 1680, h: RISE + 200, fill: CREAM, 'fill-opacity': 0.06 }) +
      line({ x1: 360, y1: WATER, x2: 2040, y2: WATER, stroke: CREAM_DIM, 'stroke-width': 2 }),
      { 'data-water': '', 'clip-path': 'url(#fortress-ground)' },
    );

    return svg(cover.slug, alt, [
      `<defs><clipPath id="fortress-ground">${rect({ x: 0, y: 0, w: 2400, h: BASE })}</clipPath></defs>`,
      figMark(cover.fig),
      line({ x1: 360, y1: BASE, x2: 2040, y2: BASE, stroke: ASH_DIM, 'stroke-width': 2 }),
      g(columns),
      // the fortress: one column, cap and base plates
      rect({ x: 900 - 60, y: 250, w: 120, h: BASE - 250, fill: CREAM }),
      rect({ x: 900 - 78, y: 236, w: 156, h: 16, fill: CREAM }),
      rect({ x: 900 - 78, y: BASE - 16, w: 156, h: 16, fill: CREAM }),
      water,
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const water = root.querySelector<SVGGElement>('[data-water]');
    if (water) {
      anims.push(loop(water, hold([
        { offset: 0, transform: `translateY(${RISE}px)` },
        { offset: 0.06, transform: `translateY(${RISE}px)`, easing: EASE_IN_OUT },
        { offset: 0.66, transform: 'translateY(0px)' },
      ])));
    }

    /* Columns start upright and buckle one after another as the water
       climbs. CSS transforms replace the attribute transform, so the rest
       keyframe restates the resting tilt about the same origin. */

    q<SVGGElement>(root, '[data-col]').forEach((col) => {
      const i = Number(col.dataset.col);
      const c = THIN[i];
      const at = 0.16 + c.order * 0.1;
      // Pivot at the column's base, in viewBox units, so it matches the
      // rotate(a cx cy) of the still exactly.
      col.setAttribute('style', `transform-box: view-box; transform-origin: ${c.x}px ${BASE}px`);
      anims.push(loop(col, hold([
        { offset: 0, transform: 'rotate(0deg)' },
        { offset: at, transform: 'rotate(0deg)', easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)' },
        { offset: at + 0.07, transform: `rotate(${c.tilt}deg)` },
      ])));
      const upper = col.querySelector<SVGGElement>('[data-upper]');
      if (upper) {
        const breakY = BASE - c.h * c.brk;
        upper.setAttribute('style', `transform-box: view-box; transform-origin: ${c.x}px ${breakY}px`);
        const ut = Number(upper.dataset.tilt);
        anims.push(loop(upper, hold([
          { offset: 0, transform: 'rotate(0deg) translateY(0px)', opacity: 1 },
          { offset: at + 0.03, transform: 'rotate(0deg) translateY(0px)', opacity: 1, easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)' },
          { offset: at + 0.1, transform: `rotate(${ut}deg) translateY(0px)`, opacity: 1 },
        ])));
      }
      // Every segment starts cream and fades to its resting grey as it fails.
      q<SVGRectElement>(col, 'rect').forEach((r) => {
        const rest = r.getAttribute('fill') ?? ASH;
        anims.push(loop(r, hold([
          { offset: 0, fill: CREAM_DIM },
          { offset: at, fill: CREAM_DIM, easing: EASE_IN_OUT },
          { offset: at + 0.12, fill: rest },
        ])));
      });
    });
    return anims;
  },
};

export default cover;
