/* FIG. 30 · PREMIUM, QUESTIONED
   One solid cream column rises from a baseline hairline, left of centre:
   the going price. Stacked on it, a dashed extension of the same width
   nearly doubles its height: the premium. At the dashed top, a small
   outlined circle.

   Motion: the column stands still throughout. The dashed premium rises
   in notches, one per beat, as if bid up; the outlined circle at its
   crown flickers, hopeful. On the last notch the flicker stops and the
   circle holds, empty. Rest: the still. */
import {
  type Cover, CREAM, ASH, ASH_DIM, STEP,
  svg, rect, circle, line, path, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const BASE = 1060;
const CX = 960;
const W = 160;
const COL_TOP = 640;          // going price
const NOTCHES = 6;
const NOTCH = 60;
const PREM_TOP = COL_TOP - NOTCHES * NOTCH;   // 280: the premium's crown
const RING_R = 28;
const DASH = { stroke: ASH, 'stroke-width': 3, 'stroke-dasharray': '18 14', fill: 'none' };

const cover: Cover = {
  slug: 'how-cfos-should-think-ma-balancing-risk-opportunity',
  fig: '30',
  caption: 'PREMIUM, QUESTIONED',

  still(alt) {
    const L = CX - W / 2, R = CX + W / 2;
    const notches: string[] = [];
    for (let k = 0; k < NOTCHES; k++) {
      const y1 = COL_TOP - k * NOTCH, y0 = y1 - NOTCH;
      notches.push(g(
        path({ d: `M${L},${y1} L${L},${y0}` }) + path({ d: `M${R},${y1} L${R},${y0}` }),
        { 'data-notch': k, ...DASH },
      ));
    }
    const crown = g(
      path({ d: `M${L},${PREM_TOP} L${R},${PREM_TOP}`, ...DASH }) +
      circle({ 'data-ring': '', cx: CX, cy: PREM_TOP - RING_R - 6, r: RING_R, fill: 'none', stroke: CREAM, 'stroke-width': 3 }),
      { 'data-crown': '' },
    );
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      line({ x1: 360, y1: BASE, x2: 2040, y2: BASE, stroke: ASH_DIM, 'stroke-width': 2 }),
      rect({ x: L, y: COL_TOP, w: W, h: BASE - COL_TOP, fill: CREAM }),
      g(notches),
      crown,
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const T0 = 0.12;
    const BEAT = 0.09;
    const at = (k: number) => T0 + k * BEAT;
    const LAST = at(NOTCHES - 1);                 // 0.57

    q<SVGGElement>(root, '[data-notch]').forEach((n) => {
      const k = Number(n.dataset.notch);
      anims.push(loop(n, hold([
        { offset: 0, opacity: 0 },
        { offset: at(k), opacity: 0, easing: STEP },
        { offset: at(k) + 0.004, opacity: 1 },
      ])));
    });

    const crown = root.querySelector<SVGGElement>('[data-crown]');
    if (crown) {
      const frames: Keyframe[] = [{ offset: 0, transform: `translateY(${NOTCHES * NOTCH}px)` }];
      for (let k = 0; k < NOTCHES; k++) {
        frames.push({ offset: at(k), transform: `translateY(${(NOTCHES - k) * NOTCH}px)`, easing: STEP });
        frames.push({ offset: at(k) + 0.004, transform: `translateY(${(NOTCHES - k - 1) * NOTCH}px)` });
      }
      frames[frames.length - 1] = { offset: LAST + 0.004, transform: 'translateY(0px)' };
      anims.push(loop(crown, hold(frames)));
    }

    const ring = root.querySelector<SVGCircleElement>('[data-ring]');
    if (ring) {
      const frames: Keyframe[] = [{ offset: 0, strokeOpacity: 1 }];
      let t = 0.03, on = true;
      while (t < LAST - 0.02) {
        on = !on;
        frames.push({ offset: t, strokeOpacity: on ? 1 : 0.15, easing: STEP });
        t += on ? 0.03 : 0.012;
      }
      frames.push({ offset: LAST, strokeOpacity: 1 });
      anims.push(loop(ring, hold(frames)));
    }
    return anims;
  },
};

export default cover;
