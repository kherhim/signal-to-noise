/* FIG. 45 · FINANCE, HYBRIDISED
   At left, a faint ash outline of a pyramid of fifteen small squares
   (5-4-3-2-1), empty. At right the same fifteen shapes, solid cream, in
   a wide flat lattice: nine squares, four turned forty-five degrees, two
   circles, joined by short hairlines.

   Motion: the loop opens with the fifteen solid shapes inside the
   pyramid. Row by row from the apex they drift right to their lattice
   positions; four rotate on the way, two cross-fade to circles. The ash
   outline never moves. Rest: the lattice, the still. */
import {
  type Cover, CREAM, ASH_DIM, EASE_IN_OUT,
  svg, square, circle, line, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const S = 54;                      // square side
const PYR_X = 560, PYR_BASE = 980, PYR_PITCH = 96;
const LAT_X0 = 1100, LAT_Y0 = 600, LAT_DX = 250, LAT_DY = 190;
const ROWS = [1, 2, 3, 4, 5];      // pyramid rows, apex first
/* lattice kinds, row-major: s square, r rotated, c circle */
const KINDS = ['s', 'r', 's', 'c', 's', 'r', 's', 's', 's', 'r', 's', 'c', 's', 'r', 's'];

function pyramidCells(): { x: number; y: number; row: number }[] {
  const cells: { x: number; y: number; row: number }[] = [];
  ROWS.forEach((n, r) => {
    const y = PYR_BASE - (ROWS.length - 1 - r) * PYR_PITCH;
    for (let j = 0; j < n; j++) cells.push({ x: PYR_X + (j - (n - 1) / 2) * PYR_PITCH, y, row: r });
  });
  return cells;
}

const cover: Cover = {
  slug: 'future-finance-talent-stack',
  fig: '45',
  caption: 'FINANCE, HYBRIDISED',

  still(alt) {
    const pyr = pyramidCells();
    const outlines = pyr.map((c) => square({ cx: c.x, cy: c.y, s: S }));

    const links: string[] = [], movers: string[] = [];
    const STOP = 50; // hairlines stop this far from a shape's centre
    for (let i = 0; i < 15; i++) {
      const r = Math.floor(i / 5), c = i % 5;
      const cx = LAT_X0 + c * LAT_DX, cy = LAT_Y0 + r * LAT_DY;
      if (c < 4) links.push(line({ x1: cx + STOP, y1: cy, x2: cx + LAT_DX - STOP, y2: cy }));
      if (r < 2) links.push(line({ x1: cx, y1: cy + STOP, x2: cx, y2: cy + LAT_DY - STOP }));

      const p = pyr[i];
      const mv = { 'data-mv': i, 'data-row': p.row, 'data-dx': p.x - cx, 'data-dy': p.y - cy };
      const kind = KINDS[i];
      if (kind === 's') movers.push(square({ ...mv, cx, cy, s: S, fill: CREAM }));
      else if (kind === 'r') movers.push(square({ ...mv, 'data-rot': '', cx, cy, s: S, fill: CREAM, transform: `rotate(45 ${cx} ${cy})` }));
      else movers.push(g(
        square({ 'data-xf': 'sq', cx, cy, s: S, fill: CREAM, opacity: 0 }) +
        circle({ 'data-xf': 'ci', cx, cy, r: S * 0.56, fill: CREAM }),
        mv,
      ));
    }

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(outlines, { fill: 'none', stroke: ASH_DIM, 'stroke-width': 2 }),
      g(links, { stroke: ASH_DIM, 'stroke-width': 2, fill: 'none' }),
      g(movers),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const T0 = 0.04, ROW_GAP = 0.13, TRAVEL = 0.2;

    q<SVGElement>(root, '[data-mv]').forEach((el) => {
      const row = Number(el.dataset.row);
      const dx = Number(el.dataset.dx), dy = Number(el.dataset.dy);
      const s = T0 + row * ROW_GAP;
      const rot = 'rot' in el.dataset;
      if (rot) el.setAttribute('style', 'transform-box: fill-box; transform-origin: center');
      const from = `translate(${dx}px, ${dy}px)${rot ? ' rotate(0deg)' : ''}`;
      const to = `translate(0px, 0px)${rot ? ' rotate(45deg)' : ''}`;
      anims.push(loop(el, hold([
        { offset: 0, transform: from },
        { offset: s, transform: from, easing: EASE_IN_OUT },
        { offset: s + TRAVEL, transform: to },
      ])));

      const sq = el.querySelector<SVGRectElement>('[data-xf="sq"]');
      const ci = el.querySelector<SVGCircleElement>('[data-xf="ci"]');
      if (sq && ci) {
        const a = s + TRAVEL * 0.45, b = s + TRAVEL;
        anims.push(loop(sq, hold([
          { offset: 0, opacity: 1 },
          { offset: a, opacity: 1, easing: EASE_IN_OUT },
          { offset: b, opacity: 0 },
        ])));
        anims.push(loop(ci, hold([
          { offset: 0, opacity: 0 },
          { offset: a, opacity: 0, easing: EASE_IN_OUT },
          { offset: b, opacity: 1 },
        ])));
      }
    });
    return anims;
  },
};

export default cover;
