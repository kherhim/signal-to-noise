/* FIG. 02 · THINKING, SINGLE-SOURCED
   One supplier circle fans hairlines into a grid of squares; beneath it
   the dashed circle of the second source that does not exist. Geometry
   traced from the original webp: circle (640, 610) r 190; an 8×6 grid of
   45-unit squares on a 112×118 pitch from (1290, 300); dashed circle
   (640, 1104) r 120. Cell codes: 1 solid, 2 outline, 0 empty.

   Motion, three phases: pulses run from the supplier along each hairline
   and the square brightens on arrival (0 → 0.56); the supplier dims and
   every fed square flickers together (0.60 → 0.78); rest. */
import {
  type Cover, CREAM, STEP,
  svg, circle, line, text, g, square, prng, hold, loop, stagger, q,
} from './_lib.ts';

const SRC = { x: 828, y: 610 };
const COL0 = 1290, ROW0 = 300, PX = 112, PY = 118, SZ = 45;
const CELLS = ['10111011', '22020112', '01211211', '20111222', '22112211', '01111121'];

const cover: Cover = {
  slug: 'the-cognitive-supply-chain',
  fig: '02',
  caption: 'THINKING, SINGLE-SOURCED',

  still(alt) {
    const rand = prng(7);
    const lines: string[] = [], squares: string[] = [], dots: string[] = [];
    let i = 0;
    CELLS.forEach((row, r) => row.split('').forEach((v, c) => {
      if (v === '0') return;
      const cx = COL0 + c * PX + SZ / 2, cy = ROW0 + r * PY + SZ / 2;
      const solid = v === '1';
      lines.push(line({ 'data-i': i, x1: SRC.x, y1: SRC.y, x2: cx, y2: cy }));
      squares.push(square({
        'data-i': i, 'data-solid': solid ? '' : undefined,
        'data-o': rand().toFixed(4), 'data-j': rand().toFixed(4),
        cx, cy, s: SZ, 'fill-opacity': solid ? 1 : 0,
      }));
      dots.push(circle({ 'data-i': i, 'data-dx': cx - SRC.x, 'data-dy': cy - SRC.y, cx: SRC.x, cy: SRC.y, r: 6, opacity: 0 }));
      i++;
    }));

    return svg(cover.slug, alt, [
      text('FIG. 02', { x: 162, y: 150, size: 30, spacing: 4, fill: '#8a8a86' }),
      g(lines, { stroke: '#5a5a58', 'stroke-width': 1.4, fill: 'none' }),
      g(squares, { fill: '#dbd8cd', stroke: '#86847d', 'stroke-width': 2.4 }),
      g(dots, { fill: CREAM }),
      circle({ 'data-supplier': '', cx: 640, cy: 610, r: 190, fill: CREAM }),
      circle({ cx: 640, cy: 1104, r: 120, fill: 'none', stroke: '#757575', 'stroke-width': 3, 'stroke-dasharray': '18 14' }),
      line({ x1: 160, y1: 1237, x2: 2239, y2: 1237, stroke: '#86847d', 'stroke-width': 2 }),
      text('THINKING, SINGLE-SOURCED', { x: 160, y: 1302, size: 40, spacing: 9, fill: '#dbd8cd' }),
    ], '#0a0a0a');
  },

  motion(root) {
    const anims: Animation[] = [];
    const PULSE = 0.16;
    const rects = q<SVGRectElement>(root, 'rect[data-i]').sort(
      (a, b) => Number(a.dataset.o) - Number(b.dataset.o),
    );
    const n = rects.length;

    rects.forEach((r, i) => {
      const idx = r.dataset.i;
      const ln = root.querySelector<SVGLineElement>(`line[data-i="${idx}"]`);
      const dot = root.querySelector<SVGCircleElement>(`circle[data-i="${idx}"]`);
      if (!ln || !dot) return;
      const jitter = Number(r.dataset.j);
      const s = stagger(i, n, 0, 0.56 - PULSE);
      const d = PULSE * (0.8 + jitter * 0.5);
      const dx = Number(dot.dataset.dx), dy = Number(dot.dataset.dy);

      anims.push(loop(dot, hold([
        { offset: 0, transform: 'translate(0px, 0px)', opacity: 0 },
        { offset: s, transform: 'translate(0px, 0px)', opacity: 0 },
        { offset: s + 0.01, transform: `translate(${dx * 0.02}px, ${dy * 0.02}px)`, opacity: 0.9, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
        { offset: s + d, transform: `translate(${dx}px, ${dy}px)`, opacity: 0.9 },
        { offset: s + d + 0.015, transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
      ])));

      const solid = 'solid' in r.dataset;
      const restFill = solid ? 1 : 0;
      const arrive = s + d;
      const j = jitter * 0.03;
      anims.push(loop(r, hold([
        { offset: 0, fillOpacity: restFill, strokeOpacity: 1 },
        { offset: Math.max(0, arrive - 0.001), fillOpacity: restFill, strokeOpacity: 1 },
        { offset: arrive, fillOpacity: solid ? 1 : 0.35, strokeOpacity: 1, easing: 'ease-out' },
        { offset: arrive + 0.03, fillOpacity: restFill, strokeOpacity: 1 },
        { offset: 0.6 + j, fillOpacity: restFill, strokeOpacity: 1, easing: STEP },
        { offset: 0.62 + j, fillOpacity: 0, strokeOpacity: 0.45, easing: STEP },
        { offset: 0.635 + j, fillOpacity: restFill, strokeOpacity: 1, easing: STEP },
        { offset: 0.645 + j, fillOpacity: 0, strokeOpacity: 0.45, easing: STEP },
        { offset: 0.73 + j, fillOpacity: 0, strokeOpacity: 0.45, easing: STEP },
        { offset: 0.75 + j, fillOpacity: restFill, strokeOpacity: 1 },
      ])));

      anims.push(loop(ln, hold([
        { offset: 0, strokeOpacity: 1 },
        { offset: 0.6, strokeOpacity: 1 },
        { offset: 0.63, strokeOpacity: 0.25, easing: 'ease-in-out' },
        { offset: 0.73, strokeOpacity: 0.25 },
        { offset: 0.78, strokeOpacity: 1 },
      ])));
    });

    const supplier = root.querySelector<SVGCircleElement>('circle[data-supplier]');
    if (supplier) {
      anims.push(loop(supplier, hold([
        { offset: 0, opacity: 1 },
        { offset: 0.6, opacity: 1, easing: 'ease-in-out' },
        { offset: 0.63, opacity: 0.32 },
        { offset: 0.72, opacity: 0.32, easing: 'ease-in-out' },
        { offset: 0.78, opacity: 1 },
      ])));
    }
    return anims;
  },
};

export default cover;
