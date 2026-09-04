/* FIG. 07 · COUNTING, AUTOMATED
   Rows of small ash circles fill the lower two-thirds, a ledger of beans,
   every one identical. Above them one solid cream circle, larger and
   alone, with a short cream hairline beneath it like an underline.

   Motion: the rows light in from the bottom, one row per beat, hard
   steps, no hand involved. When the last row lands the cream circle and
   its underline fade in and hold. Rest: ledger lit, summary present. */
import {
  type Cover, CREAM, ASH, STEP, EASE_OUT,
  svg, circle, line, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const ROWS = 8, COLS = 21;
const ROW0 = 540, ROW_PITCH = 84;
const COL0 = 320, COL_PITCH = 88;
const BEAN_R = 17;
const SUMMARY = { x: 1200, y: 320, r: 86 };

const cover: Cover = {
  slug: 'from-bean-counting-bots',
  fig: '07',
  caption: 'COUNTING, AUTOMATED',

  still(alt) {
    const rows: string[] = [];
    for (let r = 0; r < ROWS; r++) {
      const beans: string[] = [];
      for (let c = 0; c < COLS; c++) {
        beans.push(circle({ cx: COL0 + c * COL_PITCH, cy: ROW0 + r * ROW_PITCH, r: BEAN_R }));
      }
      // data-row counts from the bottom, the order the rows light in
      rows.push(g(beans, { 'data-row': ROWS - 1 - r, fill: ASH }));
    }
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      ...rows,
      g([
        circle({ cx: SUMMARY.x, cy: SUMMARY.y, r: SUMMARY.r, fill: CREAM }),
        line({ x1: SUMMARY.x - 120, y1: SUMMARY.y + SUMMARY.r + 36, x2: SUMMARY.x + 120, y2: SUMMARY.y + SUMMARY.r + 36, stroke: CREAM, 'stroke-width': 2 }),
      ], { 'data-summary': '' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const BEAT = 0.065;
    q<SVGGElement>(root, 'g[data-row]').forEach((row) => {
      const i = Number(row.dataset.row);
      const at = 0.06 + i * BEAT;
      anims.push(loop(row, hold([
        { offset: 0, opacity: 0, easing: STEP },
        { offset: at, opacity: 1 },
      ])));
    });
    const summary = root.querySelector<SVGGElement>('[data-summary]');
    if (summary) {
      const lastRow = 0.06 + (ROWS - 1) * BEAT;      // 0.515
      anims.push(loop(summary, hold([
        { offset: 0, opacity: 0 },
        { offset: lastRow + 0.05, opacity: 0, easing: EASE_OUT },
        { offset: lastRow + 0.17, opacity: 1 },
      ])));
    }
    return anims;
  },
};

export default cover;
