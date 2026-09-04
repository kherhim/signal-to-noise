/* FIG. 13 · VALUE, UNRECORDED
   Two tall outlined columns on a hairline baseline, then and now. The
   left is solid cream to 83 per cent of its height; the right is solid
   cream to 10 per cent, the rest open ash outline.

   Motion: the right column opens filled to the left's height and drains
   in steps, a little each beat, until cream stands at 10 per cent. The
   outlines never move. Rest holds the drained column; the restart is a
   hard cut back to full. */
import {
  type Cover, CREAM, ASH, ASH_DIM, STEP,
  svg, rect, line, figMark, captionBlock, hold, loop,
} from './_lib.ts';

const BASE = 1060;
const COL_H = 760;
const COL_W = 300;
const LEFT_X = 860, RIGHT_X = 1540;
const THEN = 0.83, NOW = 0.10;
const STEPS = 8;

function column(cx: number, fillFrac: number, extra: Record<string, string | number> = {}): string {
  const fillH = COL_H * fillFrac;
  return (
    rect({ x: cx - COL_W / 2, y: BASE - fillH, w: COL_W, h: fillH, fill: CREAM, ...extra }) +
    rect({ x: cx - COL_W / 2, y: BASE - COL_H, w: COL_W, h: COL_H, fill: 'none', stroke: ASH, 'stroke-width': 2 })
  );
}

const cover: Cover = {
  slug: 'evolving-financial-analytics-navigating-beyond-traditional',
  fig: '13',
  caption: 'VALUE, UNRECORDED',

  still(alt) {
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      line({ x1: 360, y1: BASE, x2: 2040, y2: BASE, stroke: ASH_DIM, 'stroke-width': 2 }),
      column(LEFT_X, THEN),
      column(RIGHT_X, NOW, { 'data-now': '' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const now = root.querySelector<SVGRectElement>('rect[data-now]');
    if (now) {
      // Scale the resting 10 per cent fill about its bottom edge.
      now.setAttribute('style', 'transform-box: fill-box; transform-origin: 50% 100%');
      const full = THEN / NOW;
      const frames: Keyframe[] = [{ offset: 0, transform: `scaleY(${full})`, easing: STEP }];
      for (let k = 0; k <= STEPS; k++) {
        const s = full - (k / STEPS) * (full - 1);
        frames.push({ offset: 0.12 + k * 0.075, transform: `scaleY(${s.toFixed(4)})`, easing: STEP });
      }
      frames.push({ offset: 0.78, transform: 'scaleY(1)' });
      anims.push(loop(now, hold(frames)));
    }
    return anims;
  },
};

export default cover;
