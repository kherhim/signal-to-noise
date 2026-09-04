/* FIG. 20 · FAITH, CLEAR-EYED
   A solid cream dot low-left on a ticked baseline: the present, faced
   squarely. A dashed circle high-right: the outcome, not yet real.
   Between them a fan of nine hairlines from the dot: the scenarios. Most
   sag or wander; one climbs and reaches the dashed circle.

   Motion: the dot holds throughout. The hairlines draw themselves from
   the dot one after another, sagging, wandering, and lastly the one that
   climbs. The dashed circle pulses slowly the whole loop and never
   fills. Rest on the completed fan; the fan fades at the top of the loop
   and redraws. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, STEP,
  svg, path, circle, dashedCircle, ruler, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const RULE_Y = 1000;
const DOT = { x: 420, y: RULE_Y - 34, r: 34 };
const OUTCOME = { x: 1960, y: 330, r: 64 };

/* Cubic curves out of the dot, in drawing order: the sagging and
   wandering ones first, the climb last. */
const SCENARIOS = [
  `C 700,${DOT.y} 900,${RULE_Y - 20} 1120,${RULE_Y - 40}`,
  `C 800,880 1300,900 1780,940`,
  `C 700,700 1000,900 1450,780`,
  `C 900,560 1200,760 1500,880`,
  `C 900,520 1350,560 1660,700`,
  `C 1000,480 1200,780 1920,880`,
  `C 900,540 1500,520 2100,600`,
  `C 1100,400 1500,760 2130,470`,
];
const CLIMB = (() => {
  const dx = OUTCOME.x - DOT.x, dy = OUTCOME.y - DOT.y;
  const len = Math.hypot(dx, dy);
  const ex = OUTCOME.x - (dx / len) * (OUTCOME.r + 2);
  const ey = OUTCOME.y - (dy / len) * (OUTCOME.r + 2);
  return `C 900,760 1300,450 ${ex.toFixed(1)},${ey.toFixed(1)}`;
})();

const cover: Cover = {
  slug: 'how-plan-best-prep-rest-cfos-survival-guide-almost-anything',
  fig: '20',
  caption: 'FAITH, CLEAR-EYED',

  still(alt) {
    const fan = [...SCENARIOS, CLIMB].map((c, i) => path({
      'data-line': i,
      d: `M${DOT.x},${DOT.y} ${c}`,
      stroke: i === SCENARIOS.length ? CREAM_DIM : ASH,
      'stroke-width': 2,
    }));
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      ruler({ x1: 260, x2: 2140, y: RULE_Y, step: 47, every: 5 }),
      g(fan, { fill: 'none', 'stroke-linecap': 'round' }),
      circle({ cx: DOT.x, cy: DOT.y, r: DOT.r, fill: CREAM }),
      dashedCircle({ 'data-outcome': '', cx: OUTCOME.x, cy: OUTCOME.y, r: OUTCOME.r }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const lines = q<SVGPathElement>(root, '[data-line]');
    const GAP = 0.076, DRAW = 0.1;
    lines.forEach((el, i) => {
      const len = el.getTotalLength();
      el.setAttribute('stroke-dasharray', `${len} ${len}`);
      const at = 0.06 + i * GAP;
      anims.push(loop(el, hold([
        { offset: 0, strokeDashoffset: 0, opacity: 1, easing: 'ease-in' },
        { offset: 0.045, strokeDashoffset: 0, opacity: 0, easing: STEP },
        { offset: at, strokeDashoffset: len, opacity: 1, easing: 'cubic-bezier(0.3, 0, 0.5, 1)' },
        { offset: Math.min(at + DRAW, 0.79), strokeDashoffset: 0, opacity: 1 },
      ])));
    });

    const outcome = root.querySelector<SVGCircleElement>('[data-outcome]');
    if (outcome) {
      const frames: Keyframe[] = [];
      // four slow pulses across the moving part of the loop, back at full by rest
      for (let k = 0; k < 4; k++) {
        const t = k * 0.195;
        frames.push({ offset: t, opacity: 1, easing: 'ease-in-out' });
        frames.push({ offset: t + 0.0975, opacity: 0.4, easing: 'ease-in-out' });
      }
      frames.push({ offset: 0.78, opacity: 1 });
      anims.push(loop(outcome, hold(frames)));
    }
    return anims;
  },
};

export default cover;
