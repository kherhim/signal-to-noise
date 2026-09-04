/* FIG. 04 · BUDGETING, AMBIDEXTROUS
   A complete 8×8 grid of solid cream squares at left; a hairline runs
   right carrying one square through three stages, square, rounded,
   circle; at right a loose constellation of solid, fine-outlined and
   dashed circles. Geometry traced from the original webp: 52-unit squares
   on a 72 pitch from (275, 365); hairline y 643 from x 830 to 1470 with
   stations at 940, 1112 and 1282; circles as listed in RING.

   Motion: the circle at the end of the hairline lifts off and lands on a
   fine-outlined circle in the constellation, which flashes full for a
   beat; the grid cell it once came from fades back in. Then that cell
   detaches again, slides along the hairline and takes the first station.
   Rest: grid whole, three stages on the line, the still. */
import {
  type Cover, CREAM, ASH, EASE_OUT, EASE_IN_OUT,
  svg, rect, circle, dashedCircle, line, text, g, hold, loop,
} from './_lib.ts';

const GX = 275, GY = 365, PITCH = 72, SZ = 52;
const LINE_Y = 643;
const S1 = 940, S2 = 1112, S3 = 1282, TS = 44;
const CELL = { x: GX + 7 * PITCH, y: GY + 4 * PITCH };   // the cell that feeds the line
const LAND = { x: 1759, y: 429 };                       // outlined circle the traveller joins

/* Constellation: kind 1 solid, 2 outlined, 3 dashed. */
const RING = [
  { k: 1, x: 1980, y: 520, r: 64 },
  { k: 1, x: 1790, y: 710, r: 44 },
  { k: 1, x: 1630, y: 560, r: 30 },
  { k: 1, x: 1690, y: 660, r: 12 },
  { k: 2, x: 2130, y: 719, r: 42 },
  { k: 2, x: LAND.x, y: LAND.y, r: 28 },
  { k: 2, x: 1909, y: 839, r: 22 },
  { k: 2, x: 2209, y: 559, r: 16 },
  { k: 3, x: 2070, y: 380, r: 26 },
  { k: 3, x: 1590, y: 810, r: 36 },
];

const cover: Cover = {
  slug: 'the-ambidextrous-budget',
  fig: '04',
  caption: 'BUDGETING, AMBIDEXTROUS',

  still(alt) {
    const grid: string[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const x = GX + c * PITCH, y = GY + r * PITCH;
        const feeds = c === 7 && r === 4;
        grid.push(rect({ x: x - SZ / 2, y: y - SZ / 2, w: SZ, h: SZ, rx: 2, 'data-cell': feeds ? '' : undefined }));
      }
    }

    const ring = RING.map((o) => {
      if (o.k === 1) return circle({ cx: o.x, cy: o.y, r: o.r, fill: CREAM });
      if (o.k === 2) {
        const lands = o.x === LAND.x;
        return circle({
          cx: o.x, cy: o.y, r: o.r, fill: CREAM, 'fill-opacity': 0, stroke: CREAM,
          'stroke-width': 3, 'data-land': lands ? '' : undefined,
        });
      }
      return dashedCircle({ cx: o.x, cy: o.y, r: o.r, stroke: ASH, 'stroke-width': 2.5, 'stroke-dasharray': '10 8' });
    });

    return svg(cover.slug, alt, [
      text('FIG. 04', { x: 249, y: 200, size: 30, spacing: 13.5, fill: ASH }),
      g(grid, { fill: CREAM }),
      line({ x1: 830, y1: LINE_Y, x2: 1470, y2: LINE_Y, stroke: ASH, 'stroke-width': 2.5 }),
      // the three stages on the line
      rect({ x: S1 - TS / 2, y: LINE_Y - TS / 2, w: TS, h: TS, rx: 2, fill: CREAM, 'data-fresh': '' }),
      rect({ x: S2 - TS / 2, y: LINE_Y - TS / 2, w: TS, h: TS, rx: 11, fill: CREAM }),
      circle({ cx: S3, cy: LINE_Y, r: TS / 2, fill: CREAM }),
      // the traveller: a twin of the last stage, invisible at rest
      circle({ cx: S3, cy: LINE_Y, r: TS / 2, fill: CREAM, opacity: 0, 'data-traveller': '' }),
      g(ring),
      line({ x1: 250, y1: 1079, x2: 2150, y2: 1079, stroke: '#86847d', 'stroke-width': 2 }),
      text('BUDGETING, AMBIDEXTROUS', { x: 744, y: 1180, size: 36, spacing: 18.6, fill: '#d9d6cd' }),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];

    /* The grid cell: empty at the loop's start (its square is the circle
       about to leave), fades back in, then empties again the instant the
       fresh square detaches, and refills. */
    const cell = root.querySelector<SVGRectElement>('[data-cell]');
    if (cell) {
      anims.push(loop(cell, hold([
        { offset: 0, opacity: 0 },
        { offset: 0.08, opacity: 0, easing: EASE_OUT },
        { offset: 0.22, opacity: 1 },
        { offset: 0.36, opacity: 1 },
        { offset: 0.361, opacity: 0 },
        { offset: 0.48, opacity: 0, easing: EASE_OUT },
        { offset: 0.64, opacity: 1 },
      ])));
    }

    /* The traveller: visible on the last station at the start, lifts off
       to the outlined circle, fades as it lands, then returns hidden. */
    const t = root.querySelector<SVGCircleElement>('[data-traveller]');
    if (t) {
      const dx = LAND.x - S3, dy = LAND.y - LINE_Y;
      anims.push(loop(t, hold([
        { offset: 0, transform: 'translate(0px, 0px)', opacity: 1 },
        { offset: 0.05, transform: 'translate(0px, 0px)', opacity: 1, easing: EASE_IN_OUT },
        { offset: 0.30, transform: `translate(${dx}px, ${dy}px)`, opacity: 1 },
        { offset: 0.38, transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
        { offset: 0.381, transform: 'translate(0px, 0px)', opacity: 0 },
      ])));
    }

    const land = root.querySelector<SVGCircleElement>('[data-land]');
    if (land) {
      anims.push(loop(land, hold([
        { offset: 0, fillOpacity: 0 },
        { offset: 0.28, fillOpacity: 0 },
        { offset: 0.31, fillOpacity: 1 },
        { offset: 0.36, fillOpacity: 1, easing: EASE_IN_OUT },
        { offset: 0.54, fillOpacity: 0 },
      ])));
    }

    /* The fresh square: hidden in the grid cell until it detaches, then
       slides along the hairline to the first station. */
    const fresh = root.querySelector<SVGRectElement>('[data-fresh]');
    if (fresh) {
      fresh.setAttribute('style', `transform-box: view-box; transform-origin: ${S1}px ${LINE_Y}px`);
      const from = `translate(${CELL.x - S1}px, ${CELL.y - LINE_Y}px) scale(${(SZ / TS).toFixed(3)})`;
      anims.push(loop(fresh, hold([
        { offset: 0, transform: from, opacity: 0 },
        { offset: 0.36, transform: from, opacity: 0 },
        { offset: 0.361, transform: from, opacity: 1, easing: EASE_IN_OUT },
        { offset: 0.62, transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      ])));
    }

    return anims;
  },
};

export default cover;
