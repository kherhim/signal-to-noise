/* FIG. 24 · CRISIS, AVERTED
   Two horizontal hairlines, stacked. The upper carries a sharp spike
   mid-frame with a solid cream circle at its apex: the crisis, and the
   captain who steered through it. The lower runs dead straight; above
   it, at the same x, a dashed circle marks the storm that never came.

   Motion: both lines draw themselves left to right at the same speed.
   As the upper line crests the spike its circle pulses bright twice; the
   dashed circle below gives one faint flicker and stays dashed. Lines
   finish and hold on the rest; everything fades at the top of the loop
   and the lines redraw. */
import {
  type Cover, CREAM, CREAM_DIM, STEP,
  svg, path, circle, dashedCircle, figMark, captionBlock, hold, loop,
} from './_lib.ts';

const X0 = 260, X1 = 2140;
const UPPER = 520, LOWER = 1000;
const SPIKE_X = 1200, APEX = 300, HALF = 70;
const R = 44;

const cover: Cover = {
  slug: 'oh-captainmy-captain',
  fig: '24',
  caption: 'CRISIS, AVERTED',

  still(alt) {
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      path({
        'data-line': 'upper',
        d: `M${X0},${UPPER} L${SPIKE_X - HALF},${UPPER} L${SPIKE_X},${APEX} L${SPIKE_X + HALF},${UPPER} L${X1},${UPPER}`,
        fill: 'none', stroke: CREAM_DIM, 'stroke-width': 2, 'stroke-linejoin': 'round',
      }),
      path({
        'data-line': 'lower',
        d: `M${X0},${LOWER} L${X1},${LOWER}`,
        fill: 'none', stroke: CREAM_DIM, 'stroke-width': 2,
      }),
      circle({ 'data-apex': '', cx: SPIKE_X, cy: APEX, r: R, fill: CREAM }),
      dashedCircle({ 'data-storm': '', cx: SPIKE_X, cy: LOWER - (UPPER - APEX), r: R }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const START = 0.07, SPAN = 0.55;      // the longer line draws over SPAN
    const upper = root.querySelector<SVGPathElement>('[data-line="upper"]');
    const lower = root.querySelector<SVGPathElement>('[data-line="lower"]');
    if (!upper || !lower) return anims;
    const lu = upper.getTotalLength();
    const ll = lower.getTotalLength();
    // Same drawing speed for both, so the pens keep level.
    const lines: Array<[SVGPathElement, number, number]> = [[upper, lu, SPAN], [lower, ll, SPAN * (ll / lu)]];
    for (const [el, len, span] of lines) {
      el.setAttribute('stroke-dasharray', `${len} ${len}`);
      anims.push(loop(el, hold([
        { offset: 0, strokeDashoffset: 0, opacity: 1, easing: 'ease-in' },
        { offset: 0.05, strokeDashoffset: 0, opacity: 0, easing: STEP },
        { offset: START, strokeDashoffset: len, opacity: 1, easing: 'linear' },
        { offset: START + span, strokeDashoffset: 0, opacity: 1 },
      ])));
    }

    // When the pen reaches the apex of the spike.
    const apexAt = START + SPAN * ((SPIKE_X - HALF - X0 + Math.hypot(HALF, UPPER - APEX)) / lu);
    const apex = root.querySelector<SVGCircleElement>('[data-apex]');
    if (apex) {
      apex.setAttribute('style', `transform-box: view-box; transform-origin: ${SPIKE_X}px ${APEX}px`);
      anims.push(loop(apex, hold([
        { offset: 0, opacity: 1, transform: 'scale(1)', easing: 'ease-in' },
        { offset: 0.05, opacity: 0, transform: 'scale(1)', easing: STEP },
        { offset: apexAt, opacity: 0, transform: 'scale(0.6)', easing: 'ease-out' },
        { offset: apexAt + 0.02, opacity: 1, transform: 'scale(1.3)', easing: 'ease-in-out' },
        { offset: apexAt + 0.05, opacity: 0.55, transform: 'scale(1)', easing: 'ease-in-out' },
        { offset: apexAt + 0.08, opacity: 1, transform: 'scale(1.3)', easing: 'ease-in-out' },
        { offset: apexAt + 0.12, opacity: 1, transform: 'scale(1)' },
      ])));
    }

    const storm = root.querySelector<SVGCircleElement>('[data-storm]');
    if (storm) {
      anims.push(loop(storm, hold([
        { offset: 0, opacity: 1, easing: 'ease-in' },
        { offset: 0.05, opacity: 0, easing: STEP },
        { offset: apexAt + 0.01, opacity: 0, easing: STEP },
        { offset: apexAt + 0.02, opacity: 0.45, easing: STEP },
        { offset: apexAt + 0.035, opacity: 0, easing: STEP },
        { offset: apexAt + 0.045, opacity: 0.45, easing: 'ease-out' },
        { offset: apexAt + 0.1, opacity: 1 },
      ])));
    }
    return anims;
  },
};

export default cover;
