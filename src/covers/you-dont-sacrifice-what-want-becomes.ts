/* FIG. 27 · SACRIFICE, CHOSEN
   A solid cream circle sits high right: the goal. Below left, a short
   staircase of eight small squares climbs towards it; the lower five are
   cream outlines, spent, the top three still solid. A single hairline
   links the top square to the circle.

   Motion: the loop opens with every square solid and the circle drawn as
   an outline in five gaps. Every two seconds one square hollows and one
   gap closes, bottom to top, until the outline is whole and the circle
   fills solid. Rest: the still. The circle's outline arcs sit just inside
   the disc's edge, so at rest they are hidden beneath the solid fill. */
import {
  type Cover, CREAM, ASH_DIM, EASE_OUT, STEP,
  svg, circle, square, path, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const GOAL = { x: 1900, y: 380, r: 110 };
const SW = 3;
const STEPS = 8;
const SPENT = 5;
const S0 = { x: 700, y: 1020 };
const DX = 110, DY = -80;
const SZ = 48;
const GAPS = 5;
const SEG_DEG = 44, GAP_DEG = 360 / GAPS - SEG_DEG;   // 44° drawn, 28° open

const rad = (deg: number) => (deg * Math.PI) / 180;
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(rad(a0)), y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1));
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

const cover: Cover = {
  slug: 'you-dont-sacrifice-what-want-becomes',
  fig: '27',
  caption: 'SACRIFICE, CHOSEN',

  still(alt) {
    const squares: string[] = [];
    for (let i = 0; i < STEPS; i++) {
      squares.push(square({
        'data-step': i, cx: S0.x + i * DX, cy: S0.y + i * DY, s: SZ,
        'fill-opacity': i < SPENT ? 0 : 1,
      }));
    }
    const top = { x: S0.x + (STEPS - 1) * DX, y: S0.y + (STEPS - 1) * DY };
    const ang = Math.atan2(GOAL.y - top.y, GOAL.x - top.x);
    const lx = top.x + (SZ / 2 + 10) * Math.cos(ang), ly = top.y + (SZ / 2 + 10) * Math.sin(ang);
    const gx = GOAL.x - (GOAL.r + 8) * Math.cos(ang), gy = GOAL.y - (GOAL.r + 8) * Math.sin(ang);

    const r = GOAL.r - SW / 2;
    const segs: string[] = [], gaps: string[] = [];
    for (let k = 0; k < GAPS; k++) {
      const a = -90 + k * (360 / GAPS);
      segs.push(path({ d: arc(GOAL.x, GOAL.y, r, a, a + SEG_DEG) }));
      gaps.push(path({ 'data-gap': k, d: arc(GOAL.x, GOAL.y, r, a + SEG_DEG, a + SEG_DEG + GAP_DEG) }));
    }

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      path({ d: `M${lx.toFixed(2)},${ly.toFixed(2)} L${gx.toFixed(2)},${gy.toFixed(2)}`, stroke: ASH_DIM, 'stroke-width': 2, fill: 'none' }),
      g(squares, { fill: CREAM, stroke: CREAM, 'stroke-width': SW }),
      g(segs, { stroke: CREAM, 'stroke-width': SW, fill: 'none', 'stroke-linecap': 'round' }),
      g(gaps, { stroke: CREAM, 'stroke-width': SW, fill: 'none', 'stroke-linecap': 'round' }),
      circle({ 'data-goal': '', cx: GOAL.x, cy: GOAL.y, r: GOAL.r, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const T0 = 0.08;
    const BEAT = 2000 / 18000;                 // two seconds
    const at = (k: number) => T0 + k * BEAT;   // gap k closes, square k hollows
    const LAST = at(GAPS - 1);                 // ≈ 0.524

    q<SVGRectElement>(root, '[data-step]').forEach((sq) => {
      const i = Number(sq.dataset.step);
      if (i >= SPENT) return;                  // the top three never change
      anims.push(loop(sq, hold([
        { offset: 0, fillOpacity: 1 },
        { offset: at(i), fillOpacity: 1, easing: EASE_OUT },
        { offset: at(i) + 0.03, fillOpacity: 0 },
      ])));
    });

    /* Gaps close bottom to top: the gap nearest the staircase first. The
       arcs are numbered clockwise from the top, so gap order runs
       2, 1, 0, 4, 3 — lower-left, left, top, right, lower-right. */
    const ORDER = [2, 1, 0, 4, 3];
    q<SVGPathElement>(root, '[data-gap]').forEach((p) => {
      const k = ORDER.indexOf(Number(p.dataset.gap));
      anims.push(loop(p, hold([
        { offset: 0, opacity: 0 },
        { offset: at(k), opacity: 0, easing: STEP },
        { offset: at(k) + 0.004, opacity: 1 },
      ])));
    });

    const goal = root.querySelector<SVGCircleElement>('[data-goal]');
    if (goal) {
      anims.push(loop(goal, hold([
        { offset: 0, fillOpacity: 0 },
        { offset: LAST + 0.05, fillOpacity: 0, easing: EASE_OUT },
        { offset: LAST + 0.12, fillOpacity: 1 },
      ])));
    }
    return anims;
  },
};

export default cover;
