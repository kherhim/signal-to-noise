/* FIG. 52 · DEMAND, SELF-FUNDED
   Three cream discs across the upper field — the supplier at left, the
   customer above centre, the intermediary at right — joined by two ash
   hairlines, so the path reads as an open chain and never as a ring.
   Beneath them a ledger: twenty unit squares on a pitch of 96 standing on
   a baseline at y 980, sixteen filled cream and four left as outlines.
   A hairline drops from the supplier into the same baseline, which is how
   the chain closes: the last stop is the first party's own book. Four
   fine lines fan from the intermediary down to the four outlined cells.

   Motion: a bright unit leaves the supplier, rests a moment at the
   customer, again at the intermediary — each hop a separate agreement,
   none of them circular to whoever signs it — then drops into one cell of
   the supplier's own ledger, which fills solid. Four units go round and
   by 0.58 the book is full, which is the figure the market capitalises.
   Then the supplier dims, the wires with it, and the four cells it funded
   drain back to outline. The loop rests on what is left: the outside
   share. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, ASH_DIM, EASE_IN_OUT, EASE_OUT, STEP,
  svg, circle, square, line, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const SUP = { x: 444, y: 420, r: 125 };
const CUS = { x: 1230, y: 290, r: 92 };
const INT = { x: 1980, y: 520, r: 92 };

const X0 = 300, PITCH = 96, SZ = 72, N_CELLS = 20;
const ROW_Y = 944, BASE_Y = 980;
const ROW_X1 = X0 - SZ / 2 - 36, ROW_X2 = X0 + (N_CELLS - 1) * PITCH + SZ / 2 + 36;
const cellX = (i: number) => X0 + i * PITCH;

/* The cells this period's loop funds. Their positions say nothing: from
   outside the row, a funded unit is indistinguishable from a sold one. */
const FUNDED = [3, 7, 12, 18];

const cover: Cover = {
  slug: 'the-landlord-finances-the-tenant',
  fig: '52',
  caption: 'DEMAND, SELF-FUNDED',
  motionPx: 1668,

  still(alt) {
    const fan = FUNDED.map((i) => line({ x1: INT.x, y1: INT.y, x2: cellX(i), y2: ROW_Y }));

    const hops = [
      line({ x1: SUP.x, y1: SUP.y, x2: CUS.x, y2: CUS.y }),
      line({ x1: CUS.x, y1: CUS.y, x2: INT.x, y2: INT.y }),
      line({ x1: SUP.x, y1: SUP.y, x2: SUP.x, y2: BASE_Y }),
    ];

    const cells: string[] = [];
    for (let i = 0; i < N_CELLS; i++) {
      cells.push(square({
        'data-cell': i, cx: cellX(i), cy: ROW_Y, s: SZ,
        'fill-opacity': FUNDED.includes(i) ? 0 : 1,
      }));
    }

    /* The travelling units all start invisible at the supplier. */
    const dots = FUNDED.map((_, j) => circle({ 'data-dot': j, cx: SUP.x, cy: SUP.y, r: 15, opacity: 0 }));

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(fan, { 'data-wire': '', stroke: ASH_DIM, 'stroke-width': 1.6, fill: 'none' }),
      g(hops, { 'data-wire': '', stroke: ASH, 'stroke-width': 2.5, fill: 'none' }),
      line({ x1: ROW_X1, y1: BASE_Y, x2: ROW_X2, y2: BASE_Y, stroke: ASH_DIM, 'stroke-width': 2 }),
      g(cells, { fill: CREAM, stroke: CREAM_DIM, 'stroke-width': 2.4 }),
      g([
        circle({ 'data-supplier': '', cx: SUP.x, cy: SUP.y, r: SUP.r }),
        circle({ cx: CUS.x, cy: CUS.y, r: CUS.r }),
        circle({ cx: INT.x, cy: INT.y, r: INT.r }),
      ], { fill: CREAM }),
      g(dots, { fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const D = 0.26;                      // one circuit, as a fraction of the loop
    const starts = [0.02, 0.12, 0.22, 0.32];
    const at = (x: number, y: number) => `translate(${x - SUP.x}px, ${y - SUP.y}px)`;
    const home = at(SUP.x, SUP.y);

    FUNDED.forEach((idx, j) => {
      const s = starts[j];
      const arrive = s + D;

      /* Supplier → customer → intermediary → a cell of the supplier's
         ledger, pausing at each party long enough to be signed. */
      const dot = root.querySelector<SVGCircleElement>(`circle[data-dot="${j}"]`);
      if (dot) {
        anims.push(loop(dot, hold([
          { offset: 0, transform: home, opacity: 0 },
          { offset: s, transform: home, opacity: 0, easing: STEP },
          { offset: s + 0.004, transform: home, opacity: 1, easing: EASE_IN_OUT },
          { offset: s + D * 0.26, transform: at(CUS.x, CUS.y), opacity: 1 },
          { offset: s + D * 0.34, transform: at(CUS.x, CUS.y), opacity: 1, easing: EASE_IN_OUT },
          { offset: s + D * 0.6, transform: at(INT.x, INT.y), opacity: 1 },
          { offset: s + D * 0.68, transform: at(INT.x, INT.y), opacity: 1, easing: EASE_IN_OUT },
          { offset: arrive, transform: at(cellX(idx), ROW_Y), opacity: 1, easing: EASE_OUT },
          { offset: arrive + 0.012, transform: at(cellX(idx), ROW_Y), opacity: 0, easing: STEP },
          { offset: arrive + 0.016, transform: home, opacity: 0 },
        ])));
      }

      /* The cell books as revenue on arrival and stays booked, until the
         cheques stop and it drains back to an outline. */
      const cell = root.querySelector<SVGRectElement>(`rect[data-cell="${idx}"]`);
      if (cell) {
        anims.push(loop(cell, hold([
          { offset: 0, fillOpacity: 0 },
          { offset: arrive, fillOpacity: 0, easing: EASE_OUT },
          { offset: arrive + 0.02, fillOpacity: 1 },
          { offset: 0.66 + j * 0.015, fillOpacity: 1, easing: EASE_IN_OUT },
          { offset: 0.74 + j * 0.015, fillOpacity: 0 },
        ])));
      }
    });

    // The supplier stops writing cheques first; the book follows it down.
    const supplier = root.querySelector<SVGCircleElement>('circle[data-supplier]');
    if (supplier) {
      anims.push(loop(supplier, hold([
        { offset: 0, opacity: 1 },
        { offset: 0.62, opacity: 1, easing: EASE_IN_OUT },
        { offset: 0.66, opacity: 0.3 },
        { offset: 0.74, opacity: 0.3, easing: EASE_IN_OUT },
        { offset: 0.79, opacity: 1 },
      ])));
    }

    q<SVGGElement>(root, 'g[data-wire]').forEach((w) => {
      anims.push(loop(w, hold([
        { offset: 0, opacity: 1 },
        { offset: 0.63, opacity: 1, easing: EASE_IN_OUT },
        { offset: 0.67, opacity: 0.25 },
        { offset: 0.75, opacity: 0.25, easing: EASE_IN_OUT },
        { offset: 0.79, opacity: 1 },
      ])));
    });

    return anims;
  },
};

export default cover;
