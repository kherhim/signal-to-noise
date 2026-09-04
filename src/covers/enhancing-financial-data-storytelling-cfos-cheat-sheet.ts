/* FIG. 26 · NUMBERS, NARRATED
   A centred grid of small squares, twelve across by eight down, drawn in
   ash outline. One cream hairline enters left, rises across the grid in
   three segments and exits right; the seven squares it passes through
   are solid cream, the only bright marks.

   Motion: the loop opens by relighting every square solid cream. The
   hairline then reveals rightward over eight seconds; as it passes each
   column, off-path squares fade to ash outline and on-path squares stay.
   Rest: the finished line. */
import {
  type Cover, CREAM, ASH, STEP,
  svg, square, path, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const COLS = 12, ROWS = 8;
const P = 110;                       // pitch
const X0 = 595, Y0 = 270;            // centre of cell (0, 0)
const SZ = 44;
/* The thread, as cell coordinates: shallow (−1/4), steep (−1), shallow
   (−1/3). Every off-path square keeps at least a quarter-cell of clear
   air from the line. */
const ON_PATH = [[0, 7], [4, 6], [5, 5], [6, 4], [7, 3], [8, 2], [11, 1]];
const cx = (c: number) => X0 + c * P, cy = (r: number) => Y0 + r * P;
const POINTS: [number, number][] = [
  [160, cy(7) + (cx(0) - 160) / 4],
  [cx(0), cy(7)], [cx(4), cy(6)], [cx(8), cy(2)], [cx(11), cy(1)],
  [2240, cy(1) - (2240 - cx(11)) / 3],
];

const cover: Cover = {
  slug: 'enhancing-financial-data-storytelling-cfos-cheat-sheet',
  fig: '26',
  caption: 'NUMBERS, NARRATED',

  still(alt) {
    const on = new Set(ON_PATH.map(([c, r]) => `${c},${r}`));
    const squares: string[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const lit = on.has(`${c},${r}`);
        squares.push(square({
          'data-col': lit ? undefined : c,
          cx: cx(c), cy: cy(r), s: SZ,
          'fill-opacity': lit ? 1 : 0, stroke: lit ? CREAM : ASH,
        }));
      }
    }
    const d = POINTS.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(squares, { fill: CREAM, 'stroke-width': 2 }),
      path({ 'data-thread': '', d, stroke: CREAM, 'stroke-width': 2, fill: 'none' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const RELIGHT = 0.004;
    const T0 = 0.05, DRAW = 8000 / 18000;     // eight seconds

    /* Fraction of the thread's length at which it crosses x. */
    const lens: number[] = [0];
    for (let i = 1; i < POINTS.length; i++) {
      lens.push(lens[i - 1] + Math.hypot(POINTS[i][0] - POINTS[i - 1][0], POINTS[i][1] - POINTS[i - 1][1]));
    }
    const total = lens[lens.length - 1];
    const fracAt = (x: number) => {
      for (let i = 1; i < POINTS.length; i++) {
        if (x <= POINTS[i][0]) {
          const t = (x - POINTS[i - 1][0]) / (POINTS[i][0] - POINTS[i - 1][0]);
          return (lens[i - 1] + t * (lens[i] - lens[i - 1])) / total;
        }
      }
      return 1;
    };

    const thread = root.querySelector<SVGPathElement>('[data-thread]');
    if (thread) {
      const L = thread.getTotalLength();
      thread.style.strokeDasharray = `${L}`;
      anims.push(loop(thread, hold([
        { offset: 0, strokeDashoffset: 0, easing: STEP },
        { offset: RELIGHT, strokeDashoffset: L },
        { offset: T0, strokeDashoffset: L, easing: 'linear' },
        { offset: T0 + DRAW, strokeDashoffset: 0 },
      ])));
    }

    q<SVGRectElement>(root, '[data-col]').forEach((sq) => {
      const c = Number(sq.dataset.col);
      const pass = T0 + DRAW * fracAt(cx(c));
      anims.push(loop(sq, hold([
        { offset: 0, fillOpacity: 0, easing: STEP },
        { offset: RELIGHT, fillOpacity: 1 },
        { offset: pass, fillOpacity: 1, easing: 'ease-out' },
        { offset: pass + 0.03, fillOpacity: 0 },
      ])));
    });
    return anims;
  },
};

export default cover;
