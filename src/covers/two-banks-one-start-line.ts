/* FIG. 50 · OUTCOMES, DIVERGENT
   The essay's own figure, monochrome: the value of $10,000 invested at
   the end of 1999 in JPMorgan (cream) and Citigroup (ash), dividends
   reinvested, on a log scale, with the S&P 500 as a faint dotted
   reference. Both lines leave one solid dot; one ends high right, the
   other never gets back. The 27 year-end points are the series from the
   essay's inline chart (720×430, log scale), mapped into the cover.

   Motion: the start dot pulses once, then both bank lines draw themselves
   left to right in step, the index line fading in beneath them, and the
   two end dots land as the lines arrive. Rest: the complete chart. */
import {
  type Cover, CREAM, ASH, ASH_DIM, EASE_OUT, EASE_IN_OUT,
  svg, circle, path, figMark, captionBlock, hold, loop,
} from './_lib.ts';

/* Year-end y values (chart units) for 1999 … 2025; x is evenly spaced. */
const JPM = [234.6, 241.0, 252.1, 273.6, 245.9, 240.4, 237.1, 223.8, 228.0, 244.9, 227.6, 226.3, 239.3, 221.2, 203.0, 197.4, 192.7, 175.4, 161.6, 165.6, 142.9, 146.3, 132.0, 139.9, 124.3, 102.8, 84.3];
const CITI = [234.6, 222.2, 222.2, 238.1, 217.8, 216.2, 213.6, 203.2, 237.8, 321.1, 362.2, 341.4, 375.6, 351.7, 335.5, 333.3, 335.7, 327.1, 313.1, 332.7, 306.0, 318.9, 318.3, 332.9, 322.8, 302.3, 271.2];
const SPX = [234.6, 239.4, 246.7, 260.9, 246.4, 240.4, 237.7, 229.1, 226.2, 253.0, 239.3, 231.1, 230.0, 221.3, 205.0, 197.6, 196.9, 190.3, 178.8, 181.5, 165.6, 155.8, 141.0, 152.8, 139.2, 126.2, 116.7];

/* Chart → cover mapping: x 64…550.8 → 220…2180; y 84.3…375.6 → 300…1010. */
const X0 = 220, X1 = 2180, Y0 = 300, Y1 = 1010;
const px = (i: number) => X0 + (i / 26) * (X1 - X0);
const py = (y: number) => Y0 + ((y - 84.3) / (375.6 - 84.3)) * (Y1 - Y0);
const poly = (ys: number[]) => ys.map((y, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(y).toFixed(1)}`).join(' ');

const cover: Cover = {
  slug: 'two-banks-one-start-line',
  fig: '50',
  caption: 'OUTCOMES, DIVERGENT',

  still(alt) {
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      path({ d: poly(SPX), fill: 'none', stroke: ASH_DIM, 'stroke-width': 3, 'stroke-dasharray': '2 14', 'stroke-linecap': 'round', 'data-index': '' }),
      path({ d: poly(CITI), fill: 'none', stroke: ASH, 'stroke-width': 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'data-line': 'citi' }),
      path({ d: poly(JPM), fill: 'none', stroke: CREAM, 'stroke-width': 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'data-line': 'jpm' }),
      circle({ cx: px(0), cy: py(234.6), r: 16, fill: CREAM, 'data-start': '' }),
      circle({ cx: px(26), cy: py(JPM[26]), r: 16, fill: CREAM, 'data-end': 'jpm' }),
      circle({ cx: px(26), cy: py(CITI[26]), r: 16, fill: ASH, 'data-end': 'citi' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const DRAW_FROM = 0.08, DRAW_TO = 0.62;

    // The start dot pulses once before the lines set off.
    const start = root.querySelector<SVGCircleElement>('[data-start]');
    if (start) {
      start.setAttribute('style', `transform-box: view-box; transform-origin: ${px(0)}px ${py(234.6)}px`);
      anims.push(loop(start, hold([
        { offset: 0, transform: 'scale(1)', easing: EASE_IN_OUT },
        { offset: 0.04, transform: 'scale(1.6)', easing: EASE_IN_OUT },
        { offset: DRAW_FROM, transform: 'scale(1)' },
      ])));
    }

    // Both bank lines draw in step, left to right.
    root.querySelectorAll<SVGPathElement>('path[data-line]').forEach((p) => {
      const len = p.getTotalLength();
      p.setAttribute('stroke-dasharray', String(len));
      anims.push(loop(p, hold([
        { offset: 0, strokeDashoffset: len },
        { offset: DRAW_FROM, strokeDashoffset: len, easing: 'linear' },
        { offset: DRAW_TO, strokeDashoffset: 0 },
      ])));
    });

    // The index reference fades in beneath them.
    const index = root.querySelector<SVGPathElement>('[data-index]');
    if (index) {
      anims.push(loop(index, hold([
        { offset: 0, opacity: 0 },
        { offset: 0.2, opacity: 0, easing: EASE_IN_OUT },
        { offset: 0.55, opacity: 1 },
      ])));
    }

    // End dots land as the lines arrive.
    root.querySelectorAll<SVGCircleElement>('[data-end]').forEach((c) => {
      const cx = Number(c.getAttribute('cx')), cy = Number(c.getAttribute('cy'));
      c.setAttribute('style', `transform-box: view-box; transform-origin: ${cx}px ${cy}px`);
      anims.push(loop(c, hold([
        { offset: 0, transform: 'scale(0)', opacity: 0 },
        { offset: DRAW_TO - 0.02, transform: 'scale(0)', opacity: 0, easing: EASE_OUT },
        { offset: DRAW_TO + 0.04, transform: 'scale(1.4)', opacity: 1, easing: EASE_IN_OUT },
        { offset: DRAW_TO + 0.1, transform: 'scale(1)', opacity: 1 },
      ])));
    });

    return anims;
  },
};

export default cover;
