/* FIG. 56 · CASH, BORROWED
   Sixteen quarters along a zero line. The first ten are solid cream bars
   standing above it, the surplus handed back, tall at first and then
   shrinking. The last six hang below the line as outlined bars that
   lengthen quarter by quarter: the same machines, now drawing cash in.

   Motion: the loop opens on the bare zero line. The bars grow out of it
   from left to right, the solid ones rising, the outlined ones dropping,
   so the crossing reads as a single sweep. Two-beat hold. Rest: the still. */
import {
  type Cover, CREAM, ASH_DIM, EASE_OUT,
  svg, rect, line, g, figMark, captionBlock, hold, loop, q, stagger,
} from './_lib.ts';

const X0 = 360, Y0 = 690, BW = 70, GAP = 38;
const UP = [430, 455, 420, 440, 395, 360, 310, 250, 180, 110]; // surplus, falling
const DOWN = [70, 120, 175, 230, 290, 350];                   // borrowing, rising

const cover: Cover = {
  slug: 'the-cash-machines-are-borrowing',
  fig: '56',
  caption: 'CASH, BORROWED',
  motionPx: 455,

  still(alt) {
    const bars: string[] = [];
    [...UP, ...DOWN].forEach((h, i) => {
      const x = X0 + i * (BW + GAP);
      const up = i < UP.length;
      bars.push(rect({
        'data-bar': i, 'data-up': up ? 1 : 0,
        x, y: up ? Y0 - h : Y0, w: BW, h,
        fill: up ? CREAM : 'none',
        stroke: up ? 'none' : CREAM, 'stroke-width': up ? undefined : 4,
      }));
    });
    const xEnd = X0 + (UP.length + DOWN.length) * (BW + GAP) - GAP;
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      line({ x1: X0 - 80, y1: Y0, x2: xEnd + 80, y2: Y0, stroke: ASH_DIM, 'stroke-width': 3 }),
      g(bars),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const bars = q<SVGRectElement>(root, '[data-bar]');
    bars.forEach((bar, i) => {
      const up = bar.dataset.up === '1';
      const s = stagger(i, bars.length, 0.06, 0.62);
      bar.setAttribute('style', `transform-box: fill-box; transform-origin: ${up ? 'bottom' : 'top'}`);
      anims.push(loop(bar, hold([
        { offset: 0, transform: 'scaleY(0)' },
        { offset: s, transform: 'scaleY(0)', easing: EASE_OUT },
        { offset: Math.min(s + 0.08, 0.8), transform: 'scaleY(1)' },
      ])));
    });
    return anims;
  },
};

export default cover;
