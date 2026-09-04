/* FIG. 04 · BUDGETING, AMBIDEXTROUS
   A complete 8×8 grid of solid cream squares at left; a hairline runs
   right carrying one square through three stages, square, rounded,
   circle; at right a loose constellation of solid, fine-outlined and
   dashed circles. Geometry traced from the original webp: 52-unit squares
   on a 72 pitch from (275, 365); hairline y 643 from x 830 to 1470 with
   stations at 940, 1112 and 1282; circles as listed in RING.

   Motion: the recycling link runs. Three cells detach from the cost book
   one after another, ride the hairline, turn square → rounded → circle as
   they pass the stations, lift off and fill an outlined circle in the
   growth constellation. The constellation drifts while this happens. Then
   the cells refill, the filled circles return to outline, and the loop
   rests on the still. */
import {
  type Cover, CREAM, ASH, EASE_OUT, EASE_IN_OUT, STEP,
  svg, rect, circle, dashedCircle, line, text, g, hold, loop, q,
} from './_lib.ts';

const GX = 275, GY = 365, PITCH = 72, SZ = 52;
const LINE_Y = 643;
const S1 = 940, S2 = 1112, S3 = 1282, TS = 44;

/* Constellation: kind 1 solid, 2 outlined, 3 dashed. */
const RING = [
  { k: 1, x: 1980, y: 520, r: 64 },
  { k: 1, x: 1790, y: 710, r: 44 },
  { k: 1, x: 1630, y: 560, r: 30 },
  { k: 1, x: 1690, y: 660, r: 12 },
  { k: 2, x: 2130, y: 719, r: 42 },
  { k: 2, x: 1759, y: 429, r: 28 },
  { k: 2, x: 1909, y: 839, r: 22 },
  { k: 2, x: 2209, y: 559, r: 16 },
  { k: 3, x: 2070, y: 380, r: 26 },
  { k: 3, x: 1590, y: 810, r: 36 },
];

/* Three journeys: which grid cell (right-hand column, row) detaches, and
   which outlined circle it lands on. */
const UNITS = [
  { row: 4, target: { x: 1759, y: 429 } },
  { row: 1, target: { x: 2130, y: 719 } },
  { row: 6, target: { x: 1909, y: 839 } },
];
const cellPos = (row: number) => ({ x: GX + 7 * PITCH, y: GY + row * PITCH });

const cover: Cover = {
  slug: 'the-ambidextrous-budget',
  fig: '04',
  caption: 'BUDGETING, AMBIDEXTROUS',

  still(alt) {
    const grid: string[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const x = GX + c * PITCH, y = GY + r * PITCH;
        const unit = UNITS.findIndex((u) => c === 7 && u.row === r);
        grid.push(rect({ x: x - SZ / 2, y: y - SZ / 2, w: SZ, h: SZ, rx: 2, 'data-cell': unit >= 0 ? unit : undefined }));
      }
    }

    const ring = RING.map((o) => {
      if (o.k === 1) return circle({ cx: o.x, cy: o.y, r: o.r, fill: CREAM, 'data-solid': '' });
      if (o.k === 2) {
        const unit = UNITS.findIndex((u) => u.target.x === o.x && u.target.y === o.y);
        return circle({
          cx: o.x, cy: o.y, r: o.r, fill: CREAM, 'fill-opacity': 0, stroke: CREAM,
          'stroke-width': 3, 'data-target': unit >= 0 ? unit : undefined,
        });
      }
      return dashedCircle({ cx: o.x, cy: o.y, r: o.r, stroke: ASH, 'stroke-width': 2.5, 'stroke-dasharray': '10 8', 'data-dashed': '' });
    });

    /* Travelling units: three stacked shapes at the first station, all
       invisible at rest. The group moves; the shapes cross-fade. */
    const units = UNITS.map((_, i) => g([
      rect({ x: S1 - TS / 2, y: LINE_Y - TS / 2, w: TS, h: TS, rx: 2, fill: CREAM, 'data-stage': 1 }),
      rect({ x: S1 - TS / 2, y: LINE_Y - TS / 2, w: TS, h: TS, rx: 11, fill: CREAM, 'data-stage': 2, opacity: 0 }),
      circle({ cx: S1, cy: LINE_Y, r: TS / 2, fill: CREAM, 'data-stage': 3, opacity: 0 }),
    ], { 'data-unit': i, opacity: 0 }));

    return svg(cover.slug, alt, [
      text('FIG. 04', { x: 249, y: 200, size: 30, spacing: 13.5, fill: ASH }),
      g(grid, { fill: CREAM }),
      line({ x1: 830, y1: LINE_Y, x2: 1470, y2: LINE_Y, stroke: ASH, 'stroke-width': 2.5 }),
      // the three stages on the line
      rect({ x: S1 - TS / 2, y: LINE_Y - TS / 2, w: TS, h: TS, rx: 2, fill: CREAM }),
      rect({ x: S2 - TS / 2, y: LINE_Y - TS / 2, w: TS, h: TS, rx: 11, fill: CREAM }),
      circle({ cx: S3, cy: LINE_Y, r: TS / 2, fill: CREAM }),
      g(ring),
      ...units,
      line({ x1: 250, y1: 1079, x2: 2150, y2: 1079, stroke: '#86847d', 'stroke-width': 2 }),
      text('BUDGETING, AMBIDEXTROUS', { x: 744, y: 1180, size: 36, spacing: 18.6, fill: '#d9d6cd' }),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const D = 0.3;                 // one journey, as a fraction of the loop
    const starts = [0.02, 0.17, 0.32];

    UNITS.forEach((u, i) => {
      const s = starts[i];
      const cell = cellPos(u.row);
      const at = (x: number, y: number) => `translate(${x - S1}px, ${y - LINE_Y}px)`;
      const scaleIn = ` scale(${(SZ / TS).toFixed(3)})`;

      // The cell empties the instant its unit leaves, refills near the end.
      const cellEl = root.querySelector<SVGRectElement>(`rect[data-cell="${i}"]`);
      if (cellEl) {
        anims.push(loop(cellEl, hold([
          { offset: 0, opacity: 1 },
          { offset: s, opacity: 1, easing: STEP },
          { offset: s + 0.001, opacity: 0 },
          { offset: 0.6 + i * 0.05, opacity: 0, easing: EASE_OUT },
          { offset: 0.68 + i * 0.05, opacity: 1 },
        ])));
      }

      // The unit: cell → first station → along the line → lift-off → target.
      const unit = root.querySelector<SVGGElement>(`g[data-unit="${i}"]`);
      if (!unit) return;
      unit.setAttribute('style', `transform-box: view-box; transform-origin: ${S1}px ${LINE_Y}px`);
      anims.push(loop(unit, hold([
        { offset: 0, transform: at(cell.x, cell.y) + scaleIn, opacity: 0 },
        { offset: s, transform: at(cell.x, cell.y) + scaleIn, opacity: 0, easing: STEP },
        { offset: s + 0.001, transform: at(cell.x, cell.y) + scaleIn, opacity: 1, easing: EASE_IN_OUT },
        { offset: s + D * 0.22, transform: at(S1, LINE_Y) + ' scale(1)', opacity: 1, easing: 'linear' },
        { offset: s + D * 0.42, transform: at(S2, LINE_Y) + ' scale(1)', opacity: 1, easing: 'linear' },
        { offset: s + D * 0.62, transform: at(S3, LINE_Y) + ' scale(1)', opacity: 1, easing: EASE_IN_OUT },
        { offset: s + D * 0.92, transform: at(u.target.x, u.target.y) + ' scale(1)', opacity: 1 },
        { offset: s + D, transform: at(u.target.x, u.target.y) + ' scale(1)', opacity: 0 },
        { offset: s + D + 0.001, transform: at(cell.x, cell.y) + scaleIn, opacity: 0 },
      ])));

      // Square → rounded → circle as it passes the stations.
      const stage = (n: number) => unit.querySelector<SVGElement>(`[data-stage="${n}"]`);
      const sq = stage(1), rd = stage(2), ci = stage(3);
      if (sq && rd && ci) {
        anims.push(loop(sq, hold([
          { offset: 0, opacity: 1 },
          { offset: s + D * 0.36, opacity: 1, easing: EASE_IN_OUT },
          { offset: s + D * 0.46, opacity: 0 },
          { offset: s + D, opacity: 0, easing: STEP },
          { offset: s + D + 0.001, opacity: 1 },
        ])));
        anims.push(loop(rd, hold([
          { offset: 0, opacity: 0 },
          { offset: s + D * 0.36, opacity: 0, easing: EASE_IN_OUT },
          { offset: s + D * 0.46, opacity: 1 },
          { offset: s + D * 0.56, opacity: 1, easing: EASE_IN_OUT },
          { offset: s + D * 0.66, opacity: 0 },
        ])));
        anims.push(loop(ci, hold([
          { offset: 0, opacity: 0 },
          { offset: s + D * 0.56, opacity: 0, easing: EASE_IN_OUT },
          { offset: s + D * 0.66, opacity: 1 },
          { offset: s + D, opacity: 1, easing: STEP },
          { offset: s + D + 0.001, opacity: 0 },
        ])));
      }

      // The outlined circle it lands on fills, holds, then empties again.
      const target = root.querySelector<SVGCircleElement>(`circle[data-target="${i}"]`);
      if (target) {
        anims.push(loop(target, hold([
          { offset: 0, fillOpacity: 0 },
          { offset: s + D * 0.9, fillOpacity: 0, easing: EASE_OUT },
          { offset: s + D, fillOpacity: 1 },
          { offset: 0.64 + i * 0.04, fillOpacity: 1, easing: EASE_IN_OUT },
          { offset: 0.74 + i * 0.04, fillOpacity: 0 },
        ])));
      }
    });

    // The growth constellation drifts a little while the link runs.
    q<SVGCircleElement>(root, 'circle[data-solid]').forEach((c, i) => {
      const dx = [16, -14, 12, -10][i % 4], dy = [-12, 10, -16, 8][i % 4];
      anims.push(loop(c, hold([
        { offset: 0, transform: 'translate(0px, 0px)', easing: EASE_IN_OUT },
        { offset: 0.35, transform: `translate(${dx}px, ${dy}px)`, easing: EASE_IN_OUT },
        { offset: 0.72, transform: 'translate(0px, 0px)' },
      ])));
    });
    q<SVGCircleElement>(root, 'circle[data-dashed]').forEach((c, i) => {
      anims.push(loop(c, hold([
        { offset: 0, opacity: 1, easing: EASE_IN_OUT },
        { offset: 0.2 + i * 0.15, opacity: 0.35, easing: EASE_IN_OUT },
        { offset: 0.45 + i * 0.15, opacity: 1 },
      ])));
    });

    return anims;
  },
};

export default cover;
