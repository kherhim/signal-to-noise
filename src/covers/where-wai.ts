/* FIG. 42 · LEGACY, SKIPPED
   A staircase of seven ash-outlined squares climbs from lower-left to
   upper-right, the generations of tooling. A dashed circle sits below
   the first step, where finance was. A solid cream circle rests on the
   top step. The steps between are untouched.

   Motion: one leap. The cream circle starts on the dashed circle, lifts
   in a single arc over every intermediate step, lands on the top one and
   settles. The steps do not react. Long hold. Rest: landed, the still. */
import {
  type Cover, CREAM, ASH, EASE_OUT,
  svg, square, circle, dashedCircle, figMark, captionBlock, g, hold, loop,
} from './_lib.ts';

const STEPS = 7, STEP_S = 100;
const STEP_X0 = 520, STEP_Y0 = 1000, STEP_DX = 220, STEP_DY = 110;
const R = 50;
const TOP = { x: STEP_X0 + (STEPS - 1) * STEP_DX, y: STEP_Y0 - (STEPS - 1) * STEP_DY };
const REST = { x: TOP.x, y: TOP.y - STEP_S / 2 - R };   // resting on the top step
const START = { x: 300, y: 1090 };                       // the dashed circle
const LIFT = 380;                                        // height of the arc above the chord

const cover: Cover = {
  slug: 'where-wai',
  fig: '42',
  caption: 'LEGACY, SKIPPED',

  still(alt) {
    const steps: string[] = [];
    for (let i = 0; i < STEPS; i++) {
      steps.push(square({ cx: STEP_X0 + i * STEP_DX, cy: STEP_Y0 - i * STEP_DY, s: STEP_S }));
    }
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(steps, { fill: 'none', stroke: ASH, 'stroke-width': 2.5 }),
      dashedCircle({ cx: START.x, cy: START.y, r: R }),
      circle({ 'data-leaper': '', cx: REST.x, cy: REST.y, r: R, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const el = root.querySelector<SVGCircleElement>('[data-leaper]');
    if (!el) return anims;
    el.setAttribute('style', 'transform-box: fill-box; transform-origin: 50% 100%');

    const DX = START.x - REST.x, DY = START.y - REST.y;
    const T0 = 0.12, T1 = 0.5, N = 20;
    const at = (u: number) => `translate(${(DX * (1 - u)).toFixed(1)}px, ${(DY * (1 - u) - LIFT * Math.sin(Math.PI * u)).toFixed(1)}px) scale(1, 1)`;

    const frames: Keyframe[] = [{ offset: 0, transform: at(0) }];
    for (let i = 0; i <= N; i++) {
      const tau = i / N;
      const u = tau * tau * (3 - 2 * tau);   // ease in and out along the arc
      frames.push({ offset: T0 + (T1 - T0) * tau, transform: at(u), easing: i === N ? EASE_OUT : 'linear' });
    }
    // settle: a brief squash on landing, then the rest pose
    frames.push({ offset: T1 + 0.025, transform: 'translate(0px, 0px) scale(1.08, 0.92)', easing: EASE_OUT });
    frames.push({ offset: T1 + 0.08, transform: 'translate(0px, 0px) scale(1, 1)' });
    anims.push(loop(el, hold(frames)));
    return anims;
  },
};

export default cover;
