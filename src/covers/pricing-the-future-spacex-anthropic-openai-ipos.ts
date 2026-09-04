/* FIG. 44 · PLATFORMS, PRICED
   The essay's table as a 3×3 matrix of hairlines: three rows, the
   companies; three columns, the lenses. In each cell a dot and concentric
   outlined rings, one per grade: four for very high, three for high or
   medium-high, two for moderate. The partner-dependency column, the
   third, is drawn with a heavier stroke.

   Motion: the loop opens on the dots alone. Column by column each cell
   adds its rings one at a time, scaling out from the centre, the matrix
   filling like a table being graded. Two-beat hold. Rest: the still. */
import {
  type Cover, CREAM, ASH_DIM, EASE_OUT,
  svg, circle, line, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const X0 = 600, Y0 = 240, CW = 400, CH = 300;
const RING = 30;                     // radius step per grade
const GRADES = [[4, 3, 2], [3, 3, 3], [3, 3, 4]]; // rows: SpaceX, Anthropic, OpenAI

const cover: Cover = {
  slug: 'pricing-the-future-spacex-anthropic-openai-ipos',
  fig: '44',
  caption: 'PLATFORMS, PRICED',

  still(alt) {
    const grid: string[] = [];
    for (let i = 0; i <= 3; i++) {
      grid.push(line({ x1: X0, y1: Y0 + i * CH, x2: X0 + 3 * CW, y2: Y0 + i * CH }));
      grid.push(line({ x1: X0 + i * CW, y1: Y0, x2: X0 + i * CW, y2: Y0 + 3 * CH }));
    }

    const cells: string[] = [];
    GRADES.forEach((row, r) => row.forEach((grade, c) => {
      const cx = X0 + (c + 0.5) * CW, cy = Y0 + (r + 0.5) * CH;
      const rings: string[] = [circle({ cx, cy, r: 9, fill: CREAM })];
      for (let k = 1; k <= grade; k++) {
        rings.push(circle({ 'data-ring': k, 'data-col': c, cx, cy, r: k * RING, fill: 'none' }));
      }
      cells.push(g(rings, { stroke: CREAM, 'stroke-width': c === 2 ? 5 : 2.6 }));
    }));

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(grid, { stroke: ASH_DIM, 'stroke-width': 2, fill: 'none' }),
      g(cells),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const T0 = 0.06, COL_GAP = 0.2, RING_GAP = 0.045, GROW = 0.05;
    q<SVGCircleElement>(root, '[data-ring]').forEach((ring) => {
      const k = Number(ring.dataset.ring), c = Number(ring.dataset.col);
      const s = T0 + c * COL_GAP + (k - 1) * RING_GAP;
      ring.setAttribute('style', 'transform-box: fill-box; transform-origin: center');
      anims.push(loop(ring, hold([
        { offset: 0, transform: 'scale(0)', opacity: 0 },
        { offset: s, transform: 'scale(0)', opacity: 0, easing: EASE_OUT },
        { offset: s + GROW, transform: 'scale(1)', opacity: 1 },
      ])));
    });
    return anims;
  },
};

export default cover;
