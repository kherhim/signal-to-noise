/* FIG. 06 · RULES, EARNED
   A single column of ten solid cream squares, evenly spaced, dead centre.
   The topmost sits inside a thin outlined cream circle; a hairline drops
   from that ring to the bottom square, binding first to last.

   Motion: the squares fill top to bottom, one per beat. Each position
   carries a faint ash outline (slightly smaller, hidden beneath the solid
   at rest) so the empty column is visible before it fills. When the
   tenth fills, the ring around the first fades in: do not forget
   principle one. Rest holds; the restart cuts to empty. Pairs with the
   newbie cover (same square size, a row instead of a column). */
import {
  type Cover, CREAM, ASH, ASH_DIM, STEP, EASE_OUT,
  svg, square, circle, line, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const N = 10;
const CX = 1200;
const SZ = 56;
const PITCH = 94;
const TOP = 270;
const RING_R = 54;

const cover: Cover = {
  slug: '10-commandments-experienced-cfo',
  fig: '06',
  caption: 'RULES, EARNED',

  still(alt) {
    const ghosts: string[] = [], solids: string[] = [];
    for (let i = 0; i < N; i++) {
      const cy = TOP + i * PITCH;
      ghosts.push(square({ cx: CX, cy, s: SZ - 5, fill: 'none', stroke: ASH_DIM, 'stroke-width': 2 }));
      solids.push(square({ 'data-rule': i, cx: CX, cy, s: SZ, fill: CREAM }));
    }
    const bottom = TOP + (N - 1) * PITCH;
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      line({ x1: CX, y1: TOP + RING_R, x2: CX, y2: bottom - SZ / 2, stroke: ASH, 'stroke-width': 2 }),
      g(ghosts),
      g(solids),
      circle({ 'data-ring': '', cx: CX, cy: TOP, r: RING_R, fill: 'none', stroke: CREAM, 'stroke-width': 3 }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const BEAT = 0.06;
    q<SVGRectElement>(root, 'rect[data-rule]').forEach((r) => {
      const i = Number(r.dataset.rule);
      anims.push(loop(r, hold([
        { offset: 0, opacity: 0, easing: STEP },
        { offset: 0.05 + i * BEAT, opacity: 1 },
      ])));
    });
    const ring = root.querySelector<SVGCircleElement>('circle[data-ring]');
    if (ring) {
      const tenth = 0.05 + (N - 1) * BEAT;         // 0.59
      anims.push(loop(ring, hold([
        { offset: 0, strokeOpacity: 0 },
        { offset: tenth + 0.06, strokeOpacity: 0, easing: EASE_OUT },
        { offset: tenth + 0.16, strokeOpacity: 1 },
      ])));
    }
    return anims;
  },
};

export default cover;
