/* FIG. 01 · COGNITION, METERED
   A solid cream semicircle sheds squares that drift right and thin out
   over a ruler. Geometry traced from the original webp: 26 grid columns
   and 15 rows on a 63-unit pitch, 50-unit squares, the semicircle centred
   on its flat edge at x=755. Cell codes: 1 solid, 2 outline, 0 empty.

   Motion: squares in the scatter region depart the flat edge on a
   staggered schedule, drift to their resting place, and the ones that rest
   as outlines thin mid-flight. A cursor on the ruler steps with each
   departure. */
import {
  type Cover, CREAM, CREAM_DIM, EASE_OUT, STEP, REST_AT,
  svg, path, rect, line, text, g, prng, hold, loop, stagger, q,
} from './_lib.ts';

const X0 = 763, Y0 = 155, PITCH = 63, SZ = 50;
const EDGE = 755;
const DENSE_COLS = 8;
const TRACED = [
  '1010101120020000010000', '1101011010000000000000', '1111100001000000100100',
  '1111110022000100000000', '1110000112201020000000', '1011010100011000000000',
  '1111111002210000010000', '1111000001000002000000', '1111111101000120000000',
  '1111111110000000000000', '1111010010010000000011', '1111101102000010020000',
  '1111111022100000021000', '1111010000021001000000', '1010110012120000000000',
];

const cover: Cover = {
  slug: 'when-cognition-becomes-metered',
  fig: '01',
  caption: 'COGNITION, METERED',

  still(alt) {
    const rand = prng(41);
    const squares: string[] = [];
    TRACED.forEach((row, r) => {
      const c = row.split('');
      const cells = [...c.slice(0, 20), '0', '0', '0', c[20], '0', c[21]];
      cells.forEach((v, col) => {
        if (v === '0') return;
        const travels = col >= DENSE_COLS;
        const outline = v === '2';
        squares.push(rect({
          x: X0 + col * PITCH, y: Y0 + r * PITCH, w: SZ, h: SZ,
          'fill-opacity': outline ? 0 : 1,
          'data-x': travels ? X0 + col * PITCH : undefined,
          'data-o': travels ? rand().toFixed(4) : undefined,
          'data-outline': travels && outline ? '' : undefined,
        }));
      });
    });

    const ticks: string[] = [line({ x1: 192, y1: 1181, x2: 2208, y2: 1181 })];
    for (let x = 192; x <= 2208; x += 36) {
      ticks.push(line({ x1: x, y1: 1181, x2: x, y2: 1181 + ((x - 192) % 288 === 0 ? 21 : 10) }));
    }

    return svg(cover.slug, alt, [
      text('FIG. 01', { x: 193, y: 88, size: 15, spacing: 15, fill: '#8a8a86' }),
      path({ d: `M${EDGE},168 A450,450 0 0 0 ${EDGE},1068 Z`, fill: CREAM }),
      g(squares, { fill: CREAM, stroke: CREAM, 'stroke-width': 2 }),
      g(ticks, { stroke: CREAM_DIM, 'stroke-width': 2, fill: 'none' }),
      rect({ x: 192, y: 1170, w: 4, h: 36, fill: CREAM, opacity: 0, 'data-cursor': '' }),
      text('COGNITION, METERED', { x: 920, y: 1268, size: 20, spacing: 19, fill: '#f5f3ec' }),
    ], '#121212');
  },

  motion(root) {
    const anims: Animation[] = [];
    const TRAVEL = 0.26;
    const lastStart = (REST_AT - TRAVEL) * 0.96;
    const rects = q<SVGRectElement>(root, 'rect[data-x]').sort(
      (a, b) => Number(a.dataset.o) - Number(b.dataset.o),
    );
    const n = rects.length;

    rects.forEach((r, i) => {
      const s = stagger(i, n, 0, lastStart);
      const dx = EDGE - Number(r.dataset.x);
      const restFill = 'outline' in r.dataset ? 0 : 1;
      anims.push(loop(r, hold([
        { offset: 0, transform: `translateX(${dx}px)`, opacity: 0, fillOpacity: 1 },
        { offset: s, transform: `translateX(${dx}px)`, opacity: 0, fillOpacity: 1 },
        { offset: s + 0.012, transform: `translateX(${dx * 0.985}px)`, opacity: 1, fillOpacity: 1, easing: EASE_OUT },
        { offset: s + TRAVEL * 0.72, transform: `translateX(${dx * 0.12}px)`, opacity: 1, fillOpacity: restFill, easing: 'cubic-bezier(0.3, 0, 0.1, 1)' },
        { offset: s + TRAVEL, transform: 'translateX(0px)', opacity: 1, fillOpacity: restFill },
      ])));
    });

    const cursor = root.querySelector<SVGRectElement>('rect[data-cursor]');
    if (cursor) {
      const span = 2208 - 192 - 4;
      const steps: Keyframe[] = [{ offset: 0, transform: 'translateX(0px)', opacity: 0 }];
      rects.forEach((_, i) => {
        const s = stagger(i, n, 0, lastStart);
        steps.push({ offset: Math.max(0.0001, s), transform: `translateX(${(i / Math.max(1, n - 1)) * span}px)`, opacity: 1, easing: STEP });
      });
      steps.push({ offset: lastStart + 0.001, transform: `translateX(${span}px)`, opacity: 1 });
      steps.push({ offset: REST_AT - 0.02, transform: `translateX(${span}px)`, opacity: 0 });
      anims.push(loop(cursor, hold(steps)));
    }
    return anims;
  },
};

export default cover;
