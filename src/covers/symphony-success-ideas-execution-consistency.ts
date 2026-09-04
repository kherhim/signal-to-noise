/* FIG. 28 · EXECUTION, REPEATED
   One solid cream circle upper-left, alone: the idea. Beneath it a long
   baseline hairline with twenty-four evenly spaced ticks; a solid cream
   square sits on every tick, the row running clean to the right edge.

   Motion: the loop opens by dropping the row out together. The circle
   blinks on once and holds. Squares then step onto the ticks one per
   beat, left to right, strict tempo, no fade. Row complete, everything
   rests; then the row drops out and the beat restarts. */
import {
  type Cover, CREAM, ASH, STEP,
  svg, circle, square, ruler, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const IDEA = { x: 420, y: 400, r: 60 };
const BASE_Y = 900;
const N = 24;
const X0 = 230, PITCH = 87;
const SZ = 44;

const cover: Cover = {
  slug: 'symphony-success-ideas-execution-consistency',
  fig: '28',
  caption: 'EXECUTION, REPEATED',

  still(alt) {
    const squares: string[] = [];
    for (let i = 0; i < N; i++) {
      squares.push(square({ 'data-sq': i, cx: X0 + i * PITCH, cy: BASE_Y - SZ / 2 - 2, s: SZ }));
    }
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      circle({ 'data-idea': '', cx: IDEA.x, cy: IDEA.y, r: IDEA.r, fill: CREAM }),
      ruler({ x1: X0, x2: X0 + (N - 1) * PITCH, y: BASE_Y, step: PITCH, every: 6, minor: 12, major: 24, stroke: ASH }),
      g(squares, { fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const DROP = 0.004;          // the row drops out as the loop opens
    const BLINK = 0.03;
    const T0 = 0.09, BEAT = 0.025;   // last square lands at 0.665

    const idea = root.querySelector<SVGCircleElement>('[data-idea]');
    if (idea) {
      anims.push(loop(idea, hold([
        { offset: 0, opacity: 1, easing: STEP },
        { offset: DROP, opacity: 0, easing: STEP },
        { offset: BLINK, opacity: 1, easing: STEP },
        { offset: BLINK + 0.012, opacity: 0, easing: STEP },
        { offset: BLINK + 0.024, opacity: 1 },
      ])));
    }

    q<SVGRectElement>(root, '[data-sq]').forEach((sq) => {
      const i = Number(sq.dataset.sq);
      const s = T0 + i * BEAT;
      anims.push(loop(sq, hold([
        { offset: 0, opacity: 1, easing: STEP },
        { offset: DROP, opacity: 0, easing: STEP },
        { offset: s, opacity: 1 },
      ])));
    });
    return anims;
  },
};

export default cover;
