/* FIG. 29 · GAP, CLOSED
   A cream hairline runs level across the canvas: what is said. From far
   beneath its left end an ash hairline, what is done, rises on a diagonal
   to meet it at a single solid circle three-quarters across. Nothing
   sits between them.

   Motion: the ash line begins flat and low, pinned at its left end. It
   pivots upward in notches, one per beat, the right end climbing towards
   the cream line; the gap narrows visibly. On the final notch the lines
   touch and the circle fills. Rest: the still. */
import {
  type Cover, CREAM, ASH, EASE_OUT,
  svg, circle, path, figMark, captionBlock, hold, loop,
} from './_lib.ts';

const X0 = 300, X1 = 2100;
const SAID_Y = 420;
const PIVOT = { x: X0, y: 1100 };
const MEET = { x: X0 + (X1 - X0) * 0.75, y: SAID_Y };   // (1650, 420)
const NOTCHES = 6;
/* Angle the done line must swing through from flat to meeting: positive
   CSS rotation lowers its right end, so the start pose is +REST_DEG. */
const REST_DEG = (Math.atan2(MEET.y - PIVOT.y, MEET.x - PIVOT.x) * 180) / Math.PI;   // ≈ −26.7

const cover: Cover = {
  slug: 'trust-bridging-gap',
  fig: '29',
  caption: 'GAP, CLOSED',

  still(alt) {
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      path({ d: `M${X0},${SAID_Y} L${X1},${SAID_Y}`, stroke: CREAM, 'stroke-width': 2, fill: 'none' }),
      path({ 'data-done': '', d: `M${PIVOT.x},${PIVOT.y} L${MEET.x},${MEET.y}`, stroke: ASH, 'stroke-width': 2, fill: 'none' }),
      circle({ 'data-meet': '', cx: MEET.x, cy: MEET.y, r: 34, fill: CREAM, stroke: CREAM, 'stroke-width': 3 }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const T0 = 0.1, BEAT = 0.1, STEP_T = 0.03;
    const LAST = T0 + (NOTCHES - 1) * BEAT + STEP_T;   // 0.63

    const done = root.querySelector<SVGPathElement>('[data-done]');
    if (done) {
      done.setAttribute('style', `transform-box: view-box; transform-origin: ${PIVOT.x}px ${PIVOT.y}px`);
      const start = -REST_DEG;   // flat
      const frames: Keyframe[] = [{ offset: 0, transform: `rotate(${start.toFixed(3)}deg)` }];
      for (let k = 0; k < NOTCHES; k++) {
        const from = start * (1 - k / NOTCHES), to = start * (1 - (k + 1) / NOTCHES);
        frames.push({ offset: T0 + k * BEAT, transform: `rotate(${from.toFixed(3)}deg)`, easing: EASE_OUT });
        frames.push({ offset: T0 + k * BEAT + STEP_T, transform: `rotate(${to.toFixed(3)}deg)` });
      }
      frames[frames.length - 1] = { offset: LAST, transform: 'rotate(0deg)' };
      anims.push(loop(done, hold(frames)));
    }

    const meet = root.querySelector<SVGCircleElement>('[data-meet]');
    if (meet) {
      anims.push(loop(meet, hold([
        { offset: 0, fillOpacity: 0 },
        { offset: LAST, fillOpacity: 0, easing: EASE_OUT },
        { offset: LAST + 0.05, fillOpacity: 1 },
      ])));
    }
    return anims;
  },
};

export default cover;
