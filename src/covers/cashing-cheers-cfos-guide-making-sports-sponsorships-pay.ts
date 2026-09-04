/* FIG. 18 · RETURN, MEASURED
   A ticked baseline across the lower third: the metrics. A dashed
   horizontal hairline above it marks the outlay. A solid cream line
   starts below the dash at left, dips, then rises and crosses it late;
   a solid circle sits at the crossing: the return, years in.

   Motion: the ticks step onto the baseline first, one per beat, full
   width: the metrics agreed before the spend. Only then does the line
   draw itself rightward over ten seconds, and the circle appears at the
   crossing. Rest; line and ticks fade at the top of the loop, restart. */
import {
  type Cover, CREAM, CREAM_DIM, ASH_DIM, STEP,
  svg, path, circle, line, g, figMark, captionBlock, hold, loop, stagger, q,
} from './_lib.ts';

const X0 = 260, X1 = 2140;
const BASE = 1000;
const OUTLAY = 600;
const CROSS_X = 1780;
const TICK_STEP = 47;
const CURVE = `M300,760 C 560,760 640,920 900,900 S 1500,760 ${CROSS_X},${OUTLAY} L 2100,417`;

const cover: Cover = {
  slug: 'cashing-cheers-cfos-guide-making-sports-sponsorships-pay',
  fig: '18',
  caption: 'RETURN, MEASURED',

  still(alt) {
    const ticks: string[] = [];
    let i = 0;
    for (let x = X0; x <= X1 + 0.01; x += TICK_STEP, i++) {
      ticks.push(line({ 'data-tick': i, x1: x, y1: BASE, x2: x, y2: BASE + (i % 5 === 0 ? 21 : 10) }));
    }
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      line({ 'data-base': '', x1: X0, y1: BASE, x2: X1, y2: BASE, stroke: CREAM_DIM, 'stroke-width': 2 }),
      g(ticks, { stroke: CREAM_DIM, 'stroke-width': 2, fill: 'none' }),
      line({ x1: X0, y1: OUTLAY, x2: X1, y2: OUTLAY, stroke: ASH_DIM, 'stroke-width': 2, 'stroke-dasharray': '14 12' }),
      path({ 'data-return': '', d: CURVE, fill: 'none', stroke: CREAM, 'stroke-width': 3, 'stroke-linecap': 'round' }),
      circle({ 'data-cross': '', cx: CROSS_X, cy: OUTLAY, r: 34, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const FADE = 0.04;
    const TICKS_FROM = 0.06, TICKS_TO = 0.2;
    const LINE_FROM = 0.23, LINE_SPAN = 10000 / 18000;   // ten seconds

    const ticks = q<SVGLineElement>(root, '[data-tick]');
    const n = ticks.length;
    ticks.forEach((t, i) => {
      const at = stagger(i, n, TICKS_FROM, TICKS_TO);
      anims.push(loop(t, hold([
        { offset: 0, opacity: 1, easing: 'ease-in' },
        { offset: FADE, opacity: 0, easing: STEP },
        { offset: at, opacity: 0, easing: STEP },
        { offset: at + 0.001, opacity: 1 },
      ])));
    });
    const base = root.querySelector<SVGLineElement>('[data-base]');
    if (base) {
      anims.push(loop(base, hold([
        { offset: 0, opacity: 1, easing: 'ease-in' },
        { offset: FADE, opacity: 0, easing: STEP },
        { offset: TICKS_FROM, opacity: 0, easing: STEP },
        { offset: TICKS_FROM + 0.001, opacity: 1 },
      ])));
    }

    const ret = root.querySelector<SVGPathElement>('[data-return]');
    let crossAt = LINE_FROM + LINE_SPAN * 0.8;
    if (ret) {
      const len = ret.getTotalLength();
      ret.setAttribute('stroke-dasharray', `${len} ${len}`);
      // Where along the path the crossing sits: the first point at or past CROSS_X.
      let lo = 0, hi = len;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        if (ret.getPointAtLength(mid).x < CROSS_X) lo = mid; else hi = mid;
      }
      crossAt = LINE_FROM + LINE_SPAN * (hi / len);
      anims.push(loop(ret, hold([
        { offset: 0, strokeDashoffset: 0, opacity: 1, easing: 'ease-in' },
        { offset: FADE, strokeDashoffset: 0, opacity: 0, easing: STEP },
        { offset: LINE_FROM, strokeDashoffset: len, opacity: 1, easing: 'linear' },
        { offset: LINE_FROM + LINE_SPAN, strokeDashoffset: 0, opacity: 1 },
      ])));
    }

    const cross = root.querySelector<SVGCircleElement>('[data-cross]');
    if (cross) {
      cross.setAttribute('style', `transform-box: view-box; transform-origin: ${CROSS_X}px ${OUTLAY}px`);
      anims.push(loop(cross, hold([
        { offset: 0, opacity: 1, transform: 'scale(1)', easing: 'ease-in' },
        { offset: FADE, opacity: 0, transform: 'scale(1)', easing: STEP },
        { offset: crossAt, opacity: 0, transform: 'scale(0.4)', easing: 'cubic-bezier(0.2, 0.7, 0.3, 1.3)' },
        { offset: Math.min(crossAt + 0.03, 0.79), opacity: 1, transform: 'scale(1)' },
      ])));
    }
    return anims;
  },
};

export default cover;
