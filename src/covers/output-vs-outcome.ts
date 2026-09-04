/* FIG. 39 · EFFORT, CONNECTED
   Left two-thirds, a ten-by-ten grid of small squares, all ash except
   three in cream. From those three, hairlines run right and converge on
   one solid cream circle, centre-right. The rest of the grid sits silent
   in the dark.

   Motion: all hundred squares flicker on at full cream in quick random
   order, busily, for six seconds. Then the grid dims to ash in one slow
   fade, except the three squares whose hairlines reach the circle; the
   hairlines draw out to the circle and it fills solid as they hold. */
import {
  type Cover, CREAM, ASH, ASH_DIM, HAIR, STEP, EASE_IN_OUT, EASE_OUT,
  svg, circle, line, square, g, figMark, captionBlock, prng, hold, loop, q,
} from './_lib.ts';

const COLS = 10, ROWS = 10;
const X0 = 400, Y0 = 245, PITCH = 96, SZ = 48;
const LIT = [[2, 1], [7, 4], [4, 8]];          // [col, row] of the three connected squares
const TARGET = { x: 1900, y: 675, r: 110 };

const cx = (c: number) => X0 + c * PITCH;
const cy = (r: number) => Y0 + r * PITCH;

const cover: Cover = {
  slug: 'output-vs-outcome',
  fig: '39',
  caption: 'EFFORT, CONNECTED',

  still(alt) {
    const rand = prng(39);
    const cells: string[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const lit = LIT.some(([lc, lr]) => lc === c && lr === r);
        cells.push(square({
          cx: cx(c), cy: cy(r), s: SZ, fill: lit ? CREAM : ASH_DIM,
          'data-cell': lit ? undefined : rand().toFixed(4),
        }));
      }
    }
    const wires = LIT.map(([c, r]) => {
      const x1 = cx(c) + SZ / 2, y1 = cy(r);
      const dx = TARGET.x - x1, dy = TARGET.y - y1;
      const len = Math.hypot(dx, dy);
      const x2 = TARGET.x - (dx / len) * TARGET.r, y2 = TARGET.y - (dy / len) * TARGET.r;
      return line({ x1, y1, x2, y2, 'data-wire': '' });
    });
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(wires, { stroke: ASH, 'stroke-width': 2 }),
      g(cells),
      circle({ cx: TARGET.x, cy: TARGET.y, r: TARGET.r, fill: CREAM, stroke: CREAM, 'stroke-width': 3, 'data-target': '' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const BUSY_END = 0.33;         // six seconds of flicker
    const FADE_END = 0.58;         // the slow dim to ash

    q<SVGRectElement>(root, '[data-cell]').forEach((el) => {
      const o = Number(el.dataset.cell);
      const on = o * 0.2;                          // when it first lights
      const off = on + 0.03 + (o * 7 % 1) * 0.05;  // a brief blink
      const on2 = off + 0.02 + ((o * 13) % 1) * 0.08;
      anims.push(loop(el, hold([
        { offset: 0, fill: HAIR, easing: STEP },
        { offset: on, fill: CREAM, easing: STEP },
        { offset: off, fill: HAIR, easing: STEP },
        { offset: Math.min(on2, BUSY_END - 0.01), fill: CREAM, easing: STEP },
        { offset: BUSY_END, fill: CREAM, easing: EASE_IN_OUT },
        { offset: FADE_END, fill: ASH_DIM },
      ])));
    });

    q<SVGLineElement>(root, '[data-wire]').forEach((el, i) => {
      const len = el.getTotalLength();
      el.style.strokeDasharray = `${len}`;
      const at = FADE_END - 0.06 + i * 0.03;
      anims.push(loop(el, hold([
        { offset: 0, strokeDashoffset: len },
        { offset: at, strokeDashoffset: len, easing: EASE_OUT },
        { offset: at + 0.1, strokeDashoffset: 0 },
      ])));
    });

    const target = root.querySelector<SVGCircleElement>('[data-target]');
    if (target) {
      anims.push(loop(target, hold([
        { offset: 0, fillOpacity: 0 },
        { offset: FADE_END + 0.06, fillOpacity: 0, easing: EASE_OUT },
        { offset: FADE_END + 0.16, fillOpacity: 1 },
      ])));
    }
    return anims;
  },
};

export default cover;
