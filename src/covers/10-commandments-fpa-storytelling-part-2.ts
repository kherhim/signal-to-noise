/* FIG. 37 · DELTA, BRIDGED
   A monochrome waterfall. A tall solid cream column at left (the
   baseline); four floating step-bars descend rightward, joined by ash
   connector hairlines; a shorter solid column at right (the landing
   point). A ruler-ticked baseline hairline runs beneath.

   Motion: the left column stands throughout. Step-bars drop in one at a
   time, each growing downward from the previous bar's foot, its
   connector extending ahead of it. The right column rises from the
   baseline to meet the last step and holds. Rest is the complete
   bridge. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, EASE_OUT, EASE_IN_OUT,
  svg, rect, line, g, ruler, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const BASE = 1080;                 // baseline
const W = 240, GAP = 70;           // bar width and gap
const X0 = 305;                    // left column's left edge
const LEFT_TOP = 280;
const STEPS = [130, 150, 90, 140]; // each step-bar's drop
const barX = (i: number) => X0 + i * (W + GAP);   // i = 0 left column, 1..4 steps, 5 right column

const cover: Cover = {
  slug: '10-commandments-fpa-storytelling-part-2',
  fig: '37',
  caption: 'DELTA, BRIDGED',

  still(alt) {
    const parts: string[] = [];
    let level = LEFT_TOP;
    STEPS.forEach((drop, i) => {
      const x = barX(i + 1);
      // connector from the previous bar's foot (its right edge) to this bar's left edge
      parts.push(line({ x1: x - GAP, y1: level, x2: x, y2: level, stroke: ASH, 'stroke-width': 2, 'data-link': i }));
      parts.push(rect({ x, y: level, w: W, h: drop, fill: CREAM_DIM, 'data-step': i, 'data-top': level }));
      level += drop;
    });
    const rx = barX(5);
    parts.push(line({ x1: rx - GAP, y1: level, x2: rx, y2: level, stroke: ASH, 'stroke-width': 2, 'data-link': 4 }));
    parts.push(rect({ x: rx, y: level, w: W, h: BASE - level, fill: CREAM, 'data-landing': '' }));

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      rect({ x: barX(0), y: LEFT_TOP, w: W, h: BASE - LEFT_TOP, fill: CREAM }),
      g(parts),
      ruler({ x1: X0, x2: rx + W, y: BASE, step: 62, every: 5, stroke: ASH }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const T0 = 0.08, BEAT = 0.14, GROW = 0.09;

    q<SVGLineElement>(root, '[data-link]').forEach((el) => {
      const i = Number(el.dataset.link);
      const at = T0 + i * BEAT;
      el.setAttribute('style', `transform-box: view-box; transform-origin: ${el.getAttribute('x1')}px ${el.getAttribute('y1')}px`);
      anims.push(loop(el, hold([
        { offset: 0, transform: 'scaleX(0)' },
        { offset: at, transform: 'scaleX(0)', easing: EASE_OUT },
        { offset: at + 0.03, transform: 'scaleX(1)' },
      ])));
    });

    q<SVGRectElement>(root, '[data-step]').forEach((el) => {
      const i = Number(el.dataset.step);
      const at = T0 + i * BEAT + 0.03;
      el.setAttribute('style', `transform-box: view-box; transform-origin: ${barX(i + 1)}px ${el.dataset.top}px`);
      anims.push(loop(el, hold([
        { offset: 0, transform: 'scaleY(0)' },
        { offset: at, transform: 'scaleY(0)', easing: EASE_IN_OUT },
        { offset: at + GROW, transform: 'scaleY(1)' },
      ])));
    });

    const landing = root.querySelector<SVGRectElement>('[data-landing]');
    if (landing) {
      const at = T0 + 4 * BEAT + 0.03;           // 0.67, rises after the last connector
      landing.setAttribute('style', `transform-box: view-box; transform-origin: ${barX(5)}px ${BASE}px`);
      anims.push(loop(landing, hold([
        { offset: 0, transform: 'scaleY(0)' },
        { offset: at, transform: 'scaleY(0)', easing: EASE_OUT },
        { offset: at + 0.1, transform: 'scaleY(1)' },
      ])));
    }
    return anims;
  },
};

export default cover;
