/* FIG. 25 · CAPACITY, UNCOUPLED
   Left edge, a column of four solid cream squares over a ruler one tick
   wide: the headcount. To its right a field of squares four rows tall
   runs to the right margin over a ruler ticked across its full width:
   the capacity. The column and its single tick are the same height and
   the same squares; only the field grows.

   Motion: the field, ruler and all, grows one column per beat, rightward.
   The four-square column and its single tick never change. Rest at full
   width; the field fades at the top of the loop and rebuilds. */
import {
  type Cover, CREAM, CREAM_DIM, STEP,
  svg, square, line, g, figMark, captionBlock, hold, loop, stagger, q,
} from './_lib.ts';

const SZ = 60;
const PITCH = 105;
const ROWS = [470, 590, 710, 830];
const HEAD_X = 300;            // the headcount column
const FIELD_X0 = 520;          // first field column
const COLS = 17;               // 520 + 16 * 105 = 2200
const RULE_Y = 960;

function segment(cx: number, half: number, major: boolean): string {
  return line({ x1: cx - half, y1: RULE_Y, x2: cx + half, y2: RULE_Y }) +
    line({ x1: cx, y1: RULE_Y, x2: cx, y2: RULE_Y + (major ? 21 : 10) });
}

const cover: Cover = {
  slug: 'using-llms-cheat-sheet-cfos',
  fig: '25',
  caption: 'CAPACITY, UNCOUPLED',

  still(alt) {
    const head = g(
      ROWS.map((cy) => square({ cx: HEAD_X, cy, s: SZ, fill: CREAM })).join('') +
      g(segment(HEAD_X, 44, true), { stroke: CREAM_DIM, 'stroke-width': 2, fill: 'none' }),
    );

    const field = Array.from({ length: COLS }, (_, i) => {
      const cx = FIELD_X0 + i * PITCH;
      return g(
        ROWS.map((cy) => square({ cx, cy, s: SZ, fill: CREAM })).join('') +
        g(segment(cx, PITCH / 2, i % 4 === 0), { stroke: CREAM_DIM, 'stroke-width': 2, fill: 'none' }),
        { 'data-col': i },
      );
    });

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      head,
      g(field),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const cols = q<SVGGElement>(root, '[data-col]');
    const n = cols.length;
    cols.forEach((col, i) => {
      const at = stagger(i, n, 0.1, 0.7);
      anims.push(loop(col, hold([
        { offset: 0, opacity: 1, easing: 'ease-in' },
        { offset: 0.05, opacity: 0, easing: STEP },
        { offset: at, opacity: 0, easing: STEP },
        { offset: at + 0.001, opacity: 1 },
      ])));
    });
    return anims;
  },
};

export default cover;
