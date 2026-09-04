/* FIG. 16 · MOTIVE, SUBMERGED
   A hairline waterline crosses the upper third. Above it a small outlined
   cream circle, the decision as stated; below it a far larger solid ash
   circle, the motive, its crown almost touching the line.

   Motion: the ash circle sways left and right and the small circle above
   moves only as its rigid follower (both sit in one group). The waterline
   never moves. The sway eases back to centre and rests. */
import {
  type Cover, CREAM, ASH, ASH_DIM, EASE_IN_OUT,
  svg, circle, line, g, figMark, captionBlock, hold, loop,
} from './_lib.ts';

const CX = 1200;
const WATER = 520;
const MOTIVE_R = 300;
const STATED_R = 52;

const cover: Cover = {
  slug: 'freud-finance-folly-cfos-perspective',
  fig: '16',
  caption: 'MOTIVE, SUBMERGED',

  still(alt) {
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g([
        circle({ cx: CX, cy: WATER + MOTIVE_R + 14, r: MOTIVE_R, fill: ASH }),
        circle({ cx: CX, cy: WATER - STATED_R - 30, r: STATED_R, fill: 'none', stroke: CREAM, 'stroke-width': 3 }),
      ], { 'data-body': '' }),
      line({ x1: 300, y1: WATER, x2: 2100, y2: WATER, stroke: ASH_DIM, 'stroke-width': 2 }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const body = root.querySelector<SVGGElement>('[data-body]');
    if (body) {
      anims.push(loop(body, hold([
        { offset: 0, transform: 'translateX(0px)', easing: EASE_IN_OUT },
        { offset: 0.16, transform: 'translateX(-170px)', easing: EASE_IN_OUT },
        { offset: 0.38, transform: 'translateX(170px)', easing: EASE_IN_OUT },
        { offset: 0.56, transform: 'translateX(-90px)', easing: EASE_IN_OUT },
        { offset: 0.68, transform: 'translateX(40px)', easing: EASE_IN_OUT },
        { offset: 0.78, transform: 'translateX(0px)' },
      ])));
    }
    return anims;
  },
};

export default cover;
