/* FIG. 41 · GREED, LONG-TERM
   A ruler ticked in years crosses the lower half. From one origin at its
   left end, two lines: a steep ash line ending at tick one in a dashed
   circle; a cream line, flatter at first, steepening past it to a solid
   circle at the right edge.

   Motion: two points travel the fixed lines from the origin. The ash
   circle stops at tick one and fades to dashed. The cream circle keeps
   going, slowly at first, then accelerating up the steepening line to
   the right edge. Hold. Rest: the still. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, EASE_OUT,
  svg, circle, dashedCircle, line, path, figMark, captionBlock, ruler, hold, loop,
} from './_lib.ts';

const Y = 1000, X1 = 360, X2 = 2040, TICK = 120;
const ORIGIN = { x: X1, y: 940 };                // the lines start just above the rule
const SHORT = { x: X1 + TICK, y: 520, r: 40 };    // the dashed circle, over tick one
const LONG = { x: 2000, y: 300, r: 56 };          // the solid circle, right edge
const CURVE = `M${ORIGIN.x},${ORIGIN.y} C900,928 1450,870 1700,730 S1940,470 ${LONG.x},${LONG.y}`;

const cover: Cover = {
  slug: 'every-cfo-greedy-just-what-theyre-real-question',
  fig: '41',
  caption: 'GREED, LONG-TERM',

  still(alt) {
    // the ash line stops short of the dashed circle's edge
    const dx = SHORT.x - ORIGIN.x, dy = SHORT.y - ORIGIN.y;
    const len = Math.hypot(dx, dy), k = (len - SHORT.r - 8) / len;
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      ruler({ x1: X1, x2: X2, y: Y, step: TICK, every: 5, stroke: CREAM_DIM }),
      line({ x1: ORIGIN.x, y1: ORIGIN.y, x2: ORIGIN.x + dx * k, y2: ORIGIN.y + dy * k, stroke: ASH, 'stroke-width': 3 }),
      path({ 'data-curve': '', d: CURVE, fill: 'none', stroke: CREAM, 'stroke-width': 4, 'stroke-linecap': 'round' }),
      circle({ 'data-ash': '', cx: ORIGIN.x, cy: ORIGIN.y, r: SHORT.r, fill: ASH, opacity: 0 }),
      dashedCircle({ 'data-dashed': '', cx: SHORT.x, cy: SHORT.y, r: SHORT.r }),
      circle({ 'data-cream': '', cx: LONG.x, cy: LONG.y, r: LONG.r, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const T0 = 0.1;

    const ash = root.querySelector<SVGCircleElement>('[data-ash]');
    const dashed = root.querySelector<SVGCircleElement>('[data-dashed]');
    if (ash && dashed) {
      const dx = SHORT.x - ORIGIN.x, dy = SHORT.y - ORIGIN.y;
      anims.push(loop(ash, hold([
        { offset: 0, transform: 'translate(0px, 0px)', opacity: 0 },
        { offset: T0, transform: 'translate(0px, 0px)', opacity: 0 },
        { offset: T0 + 0.01, transform: `translate(${dx * 0.05}px, ${dy * 0.05}px)`, opacity: 1, easing: EASE_OUT },
        { offset: T0 + 0.12, transform: `translate(${dx}px, ${dy}px)`, opacity: 1 },
        { offset: T0 + 0.2, transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
      ])));
      anims.push(loop(dashed, hold([
        { offset: 0, opacity: 0 },
        { offset: T0 + 0.12, opacity: 0 },
        { offset: T0 + 0.2, opacity: 1 },
      ])));
    }

    const curve = root.querySelector<SVGPathElement>('[data-curve]');
    const cream = root.querySelector<SVGCircleElement>('[data-cream]');
    if (curve && cream) {
      const len = curve.getTotalLength();
      const end = curve.getPointAtLength(len);
      const T1 = 0.64, N = 32;
      const frames: Keyframe[] = [];
      for (let i = 0; i <= N; i++) {
        const tau = i / N;
        const u = tau * tau * tau;            // slow start, accelerating
        const p = curve.getPointAtLength(u * len);
        frames.push({
          offset: i === 0 ? 0 : T0 + (T1 - T0) * tau,
          transform: `translate(${(p.x - end.x).toFixed(1)}px, ${(p.y - end.y).toFixed(1)}px)`,
          easing: 'linear',
        });
        if (i === 0) frames.push({ ...frames[0], offset: T0 });
      }
      frames[frames.length - 1] = { offset: T1, transform: 'translate(0px, 0px)' };
      anims.push(loop(cream, hold(frames)));
    }
    return anims;
  },
};

export default cover;
