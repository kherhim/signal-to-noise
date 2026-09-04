/* FIG. 14 · CAPABILITY, PROJECTED
   Three solid cream circles climb a diagonal from lower-left, each larger
   than the last; a fourth, largest, sits upper-right as a dashed outline,
   its interior empty. An ash hairline links the four centres.

   Motion: the dashed circle breathes, fading to near-nothing and
   returning, each return a touch brighter than the last; the solids and
   the hairline stay. Rest: the dashed circle at full strength, unfilled. */
import {
  type Cover, CREAM, ASH_DIM, EASE_IN_OUT,
  svg, circle, dashedCircle, line, figMark, captionBlock, hold, loop,
} from './_lib.ts';

const SOLID = [
  { x: 420, y: 1010, r: 48 },
  { x: 858, y: 827, r: 90 },
  { x: 1340, y: 626, r: 140 },
];
const NEXT = { x: 1880, y: 400, r: 200 };

const cover: Cover = {
  slug: 'future-gpt',
  fig: '14',
  caption: 'CAPABILITY, PROJECTED',

  still(alt) {
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      line({ x1: SOLID[0].x, y1: SOLID[0].y, x2: NEXT.x, y2: NEXT.y, stroke: ASH_DIM, 'stroke-width': 2 }),
      ...SOLID.map((c) => circle({ cx: c.x, cy: c.y, r: c.r, fill: CREAM })),
      dashedCircle({ 'data-next': '', cx: NEXT.x, cy: NEXT.y, r: NEXT.r, stroke: CREAM, 'stroke-width': 3.5, 'stroke-dasharray': '22 16' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const next = root.querySelector<SVGCircleElement>('circle[data-next]');
    if (next) {
      anims.push(loop(next, hold([
        { offset: 0, strokeOpacity: 1, easing: EASE_IN_OUT },
        { offset: 0.1, strokeOpacity: 0.06, easing: EASE_IN_OUT },
        { offset: 0.2, strokeOpacity: 0.4, easing: EASE_IN_OUT },
        { offset: 0.3, strokeOpacity: 0.06, easing: EASE_IN_OUT },
        { offset: 0.42, strokeOpacity: 0.62, easing: EASE_IN_OUT },
        { offset: 0.52, strokeOpacity: 0.06, easing: EASE_IN_OUT },
        { offset: 0.64, strokeOpacity: 0.84, easing: EASE_IN_OUT },
        { offset: 0.71, strokeOpacity: 0.06, easing: EASE_IN_OUT },
        { offset: 0.79, strokeOpacity: 1 },
      ])));
    }
    return anims;
  },
};

export default cover;
