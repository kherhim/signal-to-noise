/* FIG. 33 · FUTURES, PLURAL
   From a solid circle at left-centre one straight ash hairline runs right
   to a dashed circle: the plan. Above and below it seven cream hairlines
   fan from the same origin at increasing angles, each ending in a small
   outlined cream circle: the futures the plan did not expect.

   Motion: the plan line draws first, alone and cream, and its target
   appears dashed. Then the fan opens, lines stepping out alternately
   above and below, one per beat, each landing its circle. As the last
   lands the plan line dims to ash. Rest: the still. */
import {
  type Cover, CREAM, ASH, EASE_OUT, STEP,
  svg, circle, dashedCircle, path, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const O = { x: 420, y: 675 };        // origin
const PLAN_LEN = 1460;               // origin → dashed circle edge
const PLAN_R = 52;                   // dashed target radius
const FAN_LEN = 1380;                // origin → outlined circle edge
const FAN_R = 22;
/* Angles in degrees, in the order the fan opens: alternately above (−)
   and below (+), stepping outward. */
const FAN = [-4.5, 4.5, -9, 9, -13.5, 13.5, -18];

const rad = (deg: number) => (deg * Math.PI) / 180;

const cover: Cover = {
  slug: 'should-cfos-build-strategic-flexibility-opposed-plans',
  fig: '33',
  caption: 'FUTURES, PLURAL',

  still(alt) {
    const planD = `M${O.x},${O.y} L${O.x + PLAN_LEN},${O.y}`;
    const fan = FAN.map((deg, i) => {
      const ex = O.x + FAN_LEN * Math.cos(rad(deg));
      const ey = O.y + FAN_LEN * Math.sin(rad(deg));
      const cx = O.x + (FAN_LEN + FAN_R) * Math.cos(rad(deg));
      const cy = O.y + (FAN_LEN + FAN_R) * Math.sin(rad(deg));
      return (
        path({ 'data-fan': i, d: `M${O.x},${O.y} L${ex.toFixed(2)},${ey.toFixed(2)}`, stroke: CREAM, 'stroke-width': 2, fill: 'none' }) +
        circle({ 'data-fan-end': i, cx, cy, r: FAN_R, fill: 'none', stroke: CREAM, 'stroke-width': 3 })
      );
    });

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      // the plan: ash at rest, with a cream copy above it that is only lit while drawing
      path({ 'data-plan-ash': '', d: planD, stroke: ASH, 'stroke-width': 2, fill: 'none' }),
      path({ 'data-plan-cream': '', d: planD, stroke: CREAM, 'stroke-width': 2, fill: 'none', opacity: 0 }),
      dashedCircle({ 'data-target': '', cx: O.x + PLAN_LEN + PLAN_R, cy: O.y, r: PLAN_R }),
      g(fan),
      circle({ cx: O.x, cy: O.y, r: 36, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const PLAN_END = 0.12;
    const FAN_START = 0.2;
    const BEAT = 0.065;
    const DRAW = 0.05;
    const LAST = FAN_START + (FAN.length - 1) * BEAT + DRAW;   // 0.64

    const cream = root.querySelector<SVGPathElement>('[data-plan-cream]');
    if (cream) {
      const L = cream.getTotalLength();
      cream.style.strokeDasharray = `${L}`;
      anims.push(loop(cream, hold([
        { offset: 0, strokeDashoffset: L, opacity: 1, easing: EASE_OUT },
        { offset: PLAN_END, strokeDashoffset: 0, opacity: 1 },
        { offset: LAST, strokeDashoffset: 0, opacity: 1, easing: 'ease-in-out' },
        { offset: LAST + 0.1, strokeDashoffset: 0, opacity: 0 },
      ])));
    }
    const ash = root.querySelector<SVGPathElement>('[data-plan-ash]');
    if (ash) {
      anims.push(loop(ash, hold([
        { offset: 0, strokeOpacity: 0 },
        { offset: LAST, strokeOpacity: 0, easing: 'ease-in-out' },
        { offset: LAST + 0.1, strokeOpacity: 1 },
      ])));
    }
    const target = root.querySelector<SVGCircleElement>('[data-target]');
    if (target) {
      anims.push(loop(target, hold([
        { offset: 0, opacity: 0 },
        { offset: PLAN_END, opacity: 0, easing: 'ease-out' },
        { offset: PLAN_END + 0.03, opacity: 1 },
      ])));
    }

    q<SVGPathElement>(root, '[data-fan]').forEach((p) => {
      const i = Number(p.dataset.fan);
      const L = p.getTotalLength();
      p.style.strokeDasharray = `${L}`;
      const s = FAN_START + i * BEAT;
      anims.push(loop(p, hold([
        { offset: 0, strokeDashoffset: L },
        { offset: s, strokeDashoffset: L, easing: EASE_OUT },
        { offset: s + DRAW, strokeDashoffset: 0 },
      ])));
      const end = root.querySelector<SVGCircleElement>(`[data-fan-end="${i}"]`);
      if (end) {
        anims.push(loop(end, hold([
          { offset: 0, opacity: 0 },
          { offset: s + DRAW, opacity: 0, easing: STEP },
          { offset: s + DRAW + 0.005, opacity: 1 },
        ])));
      }
    });
    return anims;
  },
};

export default cover;
