/* FIG. 08 · GROWTH, SOLVENT
   A long level cream beam pivoted on a small solid circle at centre. At
   its left end a solid cream circle, cash in hand; at its right end a
   larger outlined circle, growth still hollow.

   Motion: the beam and its two end circles rock about the pivot, four
   degrees either way, each swing shorter than the last like a damped
   scale, then settle level and hold. The pivot never moves. */
import {
  type Cover, CREAM, EASE_IN_OUT,
  svg, circle, line, g, figMark, captionBlock, hold, loop,
} from './_lib.ts';

const PIVOT = { x: 1200, y: 675 };
const HALF = 800;
const CASH_R = 76, GROWTH_R = 120;

const cover: Cover = {
  slug: 'high-wire-acts-high-finance-cfos-circus-growth-vs-cash',
  fig: '08',
  caption: 'GROWTH, SOLVENT',

  still(alt) {
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g([
        line({ x1: PIVOT.x - HALF, y1: PIVOT.y, x2: PIVOT.x + HALF - GROWTH_R, y2: PIVOT.y, stroke: CREAM, 'stroke-width': 4 }),
        circle({ cx: PIVOT.x - HALF, cy: PIVOT.y, r: CASH_R, fill: CREAM }),
        circle({ cx: PIVOT.x + HALF, cy: PIVOT.y, r: GROWTH_R, fill: 'none', stroke: CREAM, 'stroke-width': 4 }),
      ], { 'data-beam': '' }),
      circle({ cx: PIVOT.x, cy: PIVOT.y, r: 18, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const beam = root.querySelector<SVGGElement>('[data-beam]');
    if (beam) {
      beam.setAttribute('style', `transform-box: view-box; transform-origin: ${PIVOT.x}px ${PIVOT.y}px`);
      const swings = [4, -3.2, 2.4, -1.6, 1, -0.5];
      const frames: Keyframe[] = [{ offset: 0, transform: 'rotate(0deg)', easing: EASE_IN_OUT }];
      swings.forEach((deg, i) => {
        frames.push({ offset: 0.09 + i * 0.09, transform: `rotate(${deg}deg)`, easing: EASE_IN_OUT });
      });
      frames.push({ offset: 0.63, transform: 'rotate(0deg)' });
      anims.push(loop(beam, hold(frames)));
    }
    return anims;
  },
};

export default cover;
