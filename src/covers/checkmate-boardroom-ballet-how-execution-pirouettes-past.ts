/* FIG. 09 · EXECUTION, UNSUNG
   A dashed ash line rises from lower-left to upper-right: the plan on
   paper. A solid cream line lies exactly over it from the origin to
   two-thirds along, ending in a solid cream circle; beyond, dashes only.

   Motion: the cream line advances along the route one dash per beat, the
   circle at its head, in eighteen steps; the dashes ahead never move. The
   cream line is a path with dasharray equal to its own length, drawn by
   stepping strokeDashoffset from its length to 0. Rest holds at
   two-thirds; the restart cuts back to the origin. */
import {
  type Cover, CREAM, ASH, STEP,
  svg, circle, line, path, figMark, captionBlock, hold, loop,
} from './_lib.ts';

const A = { x: 400, y: 1050 };
const B = { x: 2000, y: 300 };
const LEN = Math.hypot(B.x - A.x, B.y - A.y);      // 1767.1
const PITCHES = 27;                                // dash pitches along the plan
const PITCH = LEN / PITCHES;
const DASH = 40, GAP = PITCH - DASH;
const DONE = 18;                                   // two-thirds of 27
const UX = (B.x - A.x) / LEN, UY = (B.y - A.y) / LEN;
const HEAD = { x: A.x + UX * PITCH * DONE, y: A.y + UY * PITCH * DONE };
const DONE_LEN = PITCH * DONE;

const cover: Cover = {
  slug: 'checkmate-boardroom-ballet-how-execution-pirouettes-past',
  fig: '09',
  caption: 'EXECUTION, UNSUNG',

  still(alt) {
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      line({ x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: ASH, 'stroke-width': 3, 'stroke-dasharray': `${DASH} ${GAP.toFixed(2)}` }),
      path({
        'data-done': '', d: `M${A.x},${A.y} L${HEAD.x.toFixed(2)},${HEAD.y.toFixed(2)}`,
        fill: 'none', stroke: CREAM, 'stroke-width': 6,
        'stroke-dasharray': `${DONE_LEN.toFixed(2)} ${DONE_LEN.toFixed(2)}`, 'stroke-dashoffset': 0,
      }),
      circle({ 'data-head': '', cx: HEAD.x, cy: HEAD.y, r: 40, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const at = (k: number) => 0.05 + k * 0.036;          // k = 0 … 18 → 0.698
    const done = root.querySelector<SVGPathElement>('path[data-done]');
    if (done) {
      const frames: Keyframe[] = [];
      for (let k = 0; k <= DONE; k++) {
        frames.push({ offset: at(k), strokeDashoffset: `${(DONE_LEN - PITCH * k).toFixed(2)}px`, easing: STEP });
      }
      frames.push({ offset: at(DONE) + 0.001, strokeDashoffset: '0px' });
      frames.unshift({ offset: 0, strokeDashoffset: `${DONE_LEN.toFixed(2)}px`, easing: STEP });
      anims.push(loop(done, hold(frames)));
    }
    const head = root.querySelector<SVGCircleElement>('circle[data-head]');
    if (head) {
      const frames: Keyframe[] = [];
      const back = (k: number) => {
        const d = (k - DONE) * PITCH;
        return `translate(${(d * UX).toFixed(2)}px, ${(d * UY).toFixed(2)}px)`;
      };
      frames.push({ offset: 0, transform: back(0), easing: STEP });
      for (let k = 0; k <= DONE; k++) frames.push({ offset: at(k), transform: back(k), easing: STEP });
      frames.push({ offset: at(DONE) + 0.001, transform: 'translate(0px, 0px)' });
      anims.push(loop(head, hold(frames)));
    }
    return anims;
  },
};

export default cover;
