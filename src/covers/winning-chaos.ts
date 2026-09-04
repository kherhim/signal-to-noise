/* FIG. 34 · DEFENCE, ABANDONED
   A field of small ash squares scattered across the lower two-thirds, no
   grid, unevenly spaced. Through them one cream line climbs from
   bottom-left to a solid circle at upper-right. A faint horizontal
   hairline marks where it started.

   Motion: the squares jitter continuously, small random drifts and
   flickers. The line does not: it extends in short segments, one per
   beat, steadily up and right, the circle landing on the final segment.
   As it lands, the field subsides to stillness. */
import {
  type Cover, CREAM, ASH, ASH_DIM, STEP, EASE_OUT,
  svg, circle, line, path, square, g, figMark, captionBlock, prng, hold, loop, q,
} from './_lib.ts';

const START = { x: 400, y: 1060 };
const GOAL = { x: 1960, y: 330, r: 64 };
const SEGMENTS = 12;
const SQ = 34;

/* The climbing line: twelve short segments, each a little steeper or
   shallower than the last, ending at the circle's edge. */
function climb(): { d: string; pts: { x: number; y: number }[] } {
  const rand = prng(34);
  const pts = [START];
  const end = { x: GOAL.x - GOAL.r * 0.9, y: GOAL.y + GOAL.r * 0.45 };
  for (let i = 1; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const wob = i === SEGMENTS ? 0 : (rand() - 0.5) * 70;
    pts.push({ x: START.x + (end.x - START.x) * t, y: START.y + (end.y - START.y) * t + wob });
  }
  return { d: pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), pts };
}

/* Scattered field, seeded so the still is stable across builds. Squares
   too near the line or the circle are dropped. */
function field(): { x: number; y: number }[] {
  const rand = prng(1034);
  const { pts } = climb();
  const out: { x: number; y: number }[] = [];
  let guard = 0;
  while (out.length < 44 && guard++ < 2000) {
    const x = 260 + rand() * 1880, y = 470 + rand() * 660;
    if (Math.hypot(x - GOAL.x, y - GOAL.y) < GOAL.r + 60) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.y - y) < 95)) continue;
    // keep a clear channel either side of the line
    const near = pts.some((p, i) => {
      if (!i) return false;
      const q0 = pts[i - 1];
      const dx = p.x - q0.x, dy = p.y - q0.y;
      const t = Math.max(0, Math.min(1, ((x - q0.x) * dx + (y - q0.y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(x - (q0.x + t * dx), y - (q0.y + t * dy)) < 48;
    });
    if (near) continue;
    out.push({ x, y });
  }
  return out;
}

const cover: Cover = {
  slug: 'winning-chaos',
  fig: '34',
  caption: 'DEFENCE, ABANDONED',

  still(alt) {
    const { d } = climb();
    const squares = field().map((p, i) => square({ cx: p.x, cy: p.y, s: SQ, fill: ASH, 'data-sq': i }));
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      line({ x1: 260, y1: START.y, x2: 900, y2: START.y, stroke: ASH_DIM, 'stroke-width': 2 }),
      g(squares),
      path({ d, fill: 'none', stroke: CREAM, 'stroke-width': 4, 'stroke-linejoin': 'round', 'data-line': '' }),
      circle({ cx: GOAL.x, cy: GOAL.y, r: GOAL.r, fill: CREAM, 'data-goal': '' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const T0 = 0.05, BEAT = 0.05;                 // one segment per beat
    const LAND = T0 + SEGMENTS * BEAT;            // 0.65: the circle lands
    const rand = prng(2034);

    const rule = root.querySelector<SVGPathElement>('[data-line]');
    if (rule) {
      const len = rule.getTotalLength();
      rule.style.strokeDasharray = `${len}`;
      const frames: Keyframe[] = [{ offset: 0, strokeDashoffset: len, easing: STEP }];
      for (let i = 1; i <= SEGMENTS; i++) {
        const f: Keyframe = { offset: T0 + i * BEAT, strokeDashoffset: len * (1 - i / SEGMENTS) };
        if (i < SEGMENTS) f.easing = STEP;
        frames.push(f);
      }
      anims.push(loop(rule, hold(frames)));
    }

    const goal = root.querySelector<SVGCircleElement>('[data-goal]');
    if (goal) {
      anims.push(loop(goal, hold([
        { offset: 0, opacity: 0 },
        { offset: LAND, opacity: 0, easing: EASE_OUT },
        { offset: LAND + 0.04, opacity: 1 },
      ])));
    }

    // The field jitters until the circle lands, then settles to the still.
    q<SVGRectElement>(root, '[data-sq]').forEach((el) => {
      const frames: Keyframe[] = [];
      const n = 9;
      for (let k = 0; k <= n; k++) {
        const t = (k / n) * LAND;
        const dx = (rand() - 0.5) * 28, dy = (rand() - 0.5) * 28;
        const blink = rand() < 0.25;
        frames.push({
          offset: t,
          transform: k === 0 || k === n ? 'translate(0px, 0px)' : `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`,
          opacity: blink ? 0.25 : 0.55 + rand() * 0.45,
          easing: blink ? STEP : 'ease-in-out',
        });
      }
      frames.push({ offset: LAND + 0.06, transform: 'translate(0px, 0px)', opacity: 1 });
      anims.push(loop(el, hold(frames)));
    });
    return anims;
  },
};

export default cover;
