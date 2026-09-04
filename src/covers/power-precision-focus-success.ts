/* FIG. 11 · EFFORT, CONCENTRATED
   One large solid cream circle right of centre. Across the left two-thirds,
   nine tiny ash dots on an even grid: the ghosts of fronts given up.

   Motion: opens on ten equal cream circles, the nine on the grid and one
   at the survivor's place. Over twelve seconds the nine shrink and fade to
   ash while the tenth grows to hold their combined area (r × √10), so the
   total mass never changes. Rest holds the one circle; the restart fades
   the ten in. */
import {
  type Cover, CREAM, ASH, EASE_IN_OUT,
  svg, circle, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const R0 = 100;                       // each of the ten at the start
const DOT_R = 10;                     // a given-up front at rest
const BIG_R = R0 * Math.sqrt(10);     // 316.2
const BIG = { x: 1750, y: 675 };
const GRID_X = [350, 800, 1250];
const GRID_Y = [300, 675, 1050];

const cover: Cover = {
  slug: 'power-precision-focus-success',
  fig: '11',
  caption: 'EFFORT, CONCENTRATED',

  still(alt) {
    const dots: string[] = [];
    GRID_Y.forEach((y) => GRID_X.forEach((x) => {
      dots.push(circle({ 'data-dot': '', cx: x, cy: y, r: DOT_R, fill: ASH }));
    }));
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      ...dots,
      circle({ 'data-big': '', cx: BIG.x, cy: BIG.y, r: BIG_R, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const ORIGIN = 'transform-box: fill-box; transform-origin: center';
    const GROW_TO = 0.72;                       // ≈ 12 s in
    q<SVGCircleElement>(root, 'circle[data-dot]').forEach((d) => {
      d.setAttribute('style', ORIGIN);
      anims.push(loop(d, hold([
        { offset: 0, transform: `scale(${R0 / DOT_R})`, fill: CREAM, opacity: 0, easing: EASE_IN_OUT },
        { offset: 0.05, transform: `scale(${R0 / DOT_R})`, fill: CREAM, opacity: 1, easing: EASE_IN_OUT },
        { offset: GROW_TO, transform: 'scale(1)', fill: ASH, opacity: 1 },
      ])));
    });
    const big = root.querySelector<SVGCircleElement>('circle[data-big]');
    if (big) {
      big.setAttribute('style', ORIGIN);
      const s0 = (R0 / BIG_R).toFixed(4);
      anims.push(loop(big, hold([
        { offset: 0, transform: `scale(${s0})`, opacity: 0, easing: EASE_IN_OUT },
        { offset: 0.05, transform: `scale(${s0})`, opacity: 1, easing: EASE_IN_OUT },
        { offset: GROW_TO, transform: 'scale(1)', opacity: 1 },
      ])));
    }
    return anims;
  },
};

export default cover;
