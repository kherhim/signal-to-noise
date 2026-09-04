/* FIG. 38 · CONVICTION, ROUTED
   A small solid circle sits bottom-left. A large solid circle sits
   top-right. Between them a staircase of small cream squares climbs the
   diagonal, riser by tread (two squares along, one up), joining the two.
   A faint ash hairline traces the same diagonal beneath.

   Motion: the large circle appears first as an outline and hangs alone,
   pulsing faintly: a view without a way. Then squares step in from
   bottom-left, one per beat, up the diagonal. When the last square
   touches the outline, it fills solid. */
import {
  type Cover, CREAM, ASH_DIM, STEP, EASE_OUT,
  svg, circle, line, square, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const P = 72, SZ = 50;
const X0 = 600, Y0 = 1050;           // first tread square
const STEPS = 9;                      // each step: two squares along, one up
const START = { x: 500, y: 1090, r: 46 };
const GOAL = { x: 2000, y: 375, r: 170 };

const cover: Cover = {
  slug: 'having-view-vs-way',
  fig: '38',
  caption: 'CONVICTION, ROUTED',

  still(alt) {
    const stairs: string[] = [];
    let n = 0;
    for (let k = 0; k < STEPS; k++) {
      for (let t = 0; t < 2; t++) {
        stairs.push(square({ cx: X0 + (2 * k + t) * P, cy: Y0 - k * P, s: SZ, fill: CREAM, 'data-step': n++ }));
      }
    }
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      line({ x1: START.x, y1: START.y, x2: GOAL.x, y2: GOAL.y, stroke: ASH_DIM, 'stroke-width': 2 }),
      circle({ cx: START.x, cy: START.y, r: START.r, fill: CREAM }),
      g(stairs),
      circle({ cx: GOAL.x, cy: GOAL.y, r: GOAL.r, fill: CREAM, stroke: CREAM, 'stroke-width': 3, 'data-goal': '' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const HANG_END = 0.24;                  // the outline hangs alone until here
    const steps = q<SVGRectElement>(root, '[data-step]');
    const n = steps.length;
    const BEAT = 0.024;
    const lastAt = HANG_END + (n - 1) * BEAT;   // 0.648

    steps.forEach((el) => {
      const i = Number(el.dataset.step);
      const at = HANG_END + i * BEAT;
      anims.push(loop(el, hold([
        { offset: 0, opacity: 0, easing: STEP },
        { offset: at, opacity: 1 },
      ])));
    });

    const goal = root.querySelector<SVGCircleElement>('[data-goal]');
    if (goal) {
      // Outline only, breathing faintly, until the stair arrives; then it fills.
      const frames: Keyframe[] = [{ offset: 0, fillOpacity: 0, strokeOpacity: 0, easing: EASE_OUT }];
      frames.push({ offset: 0.04, fillOpacity: 0, strokeOpacity: 1, easing: 'ease-in-out' });
      for (let t = 0.04 + 0.05; t < lastAt; t += 0.05) {
        const dim = Math.round(t / 0.05) % 2 === 0;
        frames.push({ offset: t, fillOpacity: 0, strokeOpacity: dim ? 0.45 : 1, easing: 'ease-in-out' });
      }
      frames.push({ offset: lastAt + 0.01, fillOpacity: 0, strokeOpacity: 1, easing: EASE_OUT });
      frames.push({ offset: lastAt + 0.08, fillOpacity: 1, strokeOpacity: 1 });
      anims.push(loop(goal, hold(frames)));
    }
    return anims;
  },
};

export default cover;
