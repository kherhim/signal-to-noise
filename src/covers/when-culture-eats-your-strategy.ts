/* FIG. 49 · EXCEPTIONS, TOLERATED
   An ordered grid of outlined cream cells fills the left of the frame;
   towards the right the cells loosen, tilt and drift outward, thinning
   to ash-grey edges and dust before the black. Composition traced from
   the original webp (110-unit outlined cells on a 120 pitch, intact for
   the first third, fragments to about three quarters) and refitted to
   the fabric's safe area: 17 columns × 8 rows of 106-unit cells on a
   116 pitch from (160, 210), so the fig mark and caption clear it.

   Motion: the loop opens with the grid whole and no fragments. Working
   inward from the right edge, cells peel away singly: a few degrees of
   tilt, a short outward drift, a fade from cream to ash or to nothing.
   The frontier creeps one column inward. Rest: the eroded edge of the
   still. */
import {
  type Cover, CREAM_DIM, ASH_DIM,
  svg, rect, line, circle, g, figMark, captionBlock, prng, hold, loop, q,
} from './_lib.ts';

const X0 = 160, Y0 = 210, PITCH = 116, SZ = 106;
const COLS = 17, ROWS = 8;
const INTACT = 6;                 // last column that never moves
const EASE_PEEL = 'cubic-bezier(0.4, 0, 0.3, 1)';

type Piece = {
  c: number; r: number;
  edges: number[];                // 0 top 1 right 2 bottom 3 left; empty = whole rect
  gone: boolean;                  // present at the loop's start, nothing at rest
  tilt: number; dx: number; dy: number; op: number;
};

/* Every cell right of the intact block gets a fate, decided by column
   and a seeded draw, so the composition is identical across builds. */
function fates(): Piece[] {
  const rand = prng(49);
  const out: Piece[] = [];
  for (let c = INTACT + 1; c < COLS; c++) {
    const depth = (c - INTACT) / (COLS - 1 - INTACT);      // 0.1 → 1 across the frontier
    for (let r = 0; r < ROWS; r++) {
      const pGone = Math.min(0.95, 0.05 + 0.9 * Math.pow(depth, 1.4)); // cells lost outright
      const pWhole = Math.max(0, 0.85 - depth * 1.4);          // whole outlines near the frontier
      const pEdges = Math.max(0, 0.55 - depth * 0.55);         // broken outlines further out
      const sign = rand() < 0.5 ? -1 : 1;
      const tilt = sign * (0.5 + depth * 3 + rand() * 1.5);
      const dx = 4 + depth * 40 + rand() * 12;
      const dy = (rand() - 0.5) * (8 + depth * 40);
      let edges: number[] = [];
      let gone = false;
      const u = rand(), v = rand();
      if (u < pGone) {
        gone = true;
      } else if (v < pWhole) {
        edges = [];
      } else if (v < pWhole + pEdges) {
        const n = 2 + (rand() < 0.5 ? 1 : 0);
        const all = [0, 1, 2, 3].sort(() => rand() - 0.5);
        edges = all.slice(0, n);
      } else {
        edges = [Math.floor(rand() * 4)];
      }
      const op = gone ? 0 : Math.max(0.2, 0.9 - depth * 0.6 - rand() * 0.15);
      out.push({ c, r, edges, gone, tilt: +tilt.toFixed(2), dx: Math.round(dx), dy: Math.round(dy), op: +op.toFixed(2) });
    }
  }
  return out;
}

const cover: Cover = {
  slug: 'when-culture-eats-your-strategy',
  fig: '49',
  caption: 'EXCEPTIONS, TOLERATED',

  still(alt) {
    const whole: string[] = [];
    for (let c = 0; c <= INTACT; c++) {
      for (let r = 0; r < ROWS; r++) {
        whole.push(rect({ x: X0 + c * PITCH, y: Y0 + r * PITCH, w: SZ, h: SZ }));
      }
    }

    const pieces = fates().map((p) => {
      const gx = X0 + p.c * PITCH, gy = Y0 + p.r * PITCH;        // grid position
      const x = gx + p.dx, y = gy + p.dy;                        // drifted position
      const cx = x + SZ / 2, cy = y + SZ / 2;
      let body: string;
      if (p.gone || p.edges.length === 0) {
        body = rect({ x, y, w: SZ, h: SZ });
      } else {
        const corners = [[x, y], [x + SZ, y], [x + SZ, y + SZ], [x, y + SZ]];
        body = [0, 1, 2, 3].map((e) => {
          const [ax, ay] = corners[e], [bx, by] = corners[(e + 1) % 4];
          const kept = p.edges.includes(e);
          return line({ x1: ax, y1: ay, x2: bx, y2: by, opacity: kept ? 1 : 0, 'data-edge': kept ? undefined : '' });
        }).join('');
      }
      return g(body, {
        'data-piece': '', 'data-c': p.c, 'data-r': p.r, 'data-dx': p.dx, 'data-dy': p.dy,
        'data-tilt': p.tilt, 'data-op': p.op, 'data-cx': cx, 'data-cy': cy,
        'stroke-opacity': p.op, opacity: p.gone ? 0 : 1,
        transform: `rotate(${p.tilt} ${cx} ${cy})`,
      });
    });

    // dust: a few tiny specks in the far field, absent at the loop's start
    const rand = prng(7);
    const dust: string[] = [];
    for (let i = 0; i < 34; i++) {
      const x = X0 + (INTACT + 2) * PITCH + rand() * (COLS - INTACT - 2) * PITCH;
      const y = Y0 + rand() * ROWS * PITCH;
      dust.push(circle({ cx: x, cy: y, r: 2.5 + rand() * 1.5, fill: ASH_DIM, 'data-dust': '', 'data-t': rand().toFixed(3) }));
    }

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(whole, { fill: 'none', stroke: CREAM_DIM, 'stroke-width': 2 }),
      g(pieces, { fill: 'none', stroke: CREAM_DIM, 'stroke-width': 2 }),
      g(dust),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const DUR = 0.13;
    const colStart = (c: number) => 0.02 + ((COLS - 1 - c) / (COLS - 2 - INTACT)) * 0.52;
    const jitter = prng(11);

    q<SVGGElement>(root, '[data-piece]').forEach((p) => {
      const c = Number(p.dataset.c);
      const s = colStart(c) + jitter() * 0.08;
      const dx = Number(p.dataset.dx), dy = Number(p.dataset.dy);
      const tilt = Number(p.dataset.tilt), op = Number(p.dataset.op);
      const gone = p.getAttribute('opacity') === '0';
      p.setAttribute('style', `transform-box: view-box; transform-origin: ${p.dataset.cx}px ${p.dataset.cy}px`);
      const home = `translate(${-dx}px, ${-dy}px) rotate(0deg)`;
      anims.push(loop(p, hold([
        { offset: 0, transform: home, strokeOpacity: 1, opacity: 1 },
        { offset: s, transform: home, strokeOpacity: 1, opacity: 1, easing: EASE_PEEL },
        { offset: s + DUR, transform: `translate(0px, 0px) rotate(${tilt}deg)`, strokeOpacity: op, opacity: gone ? 0 : 1 },
      ])));
      // edges that are lost at rest drop out as the cell peels
      q<SVGLineElement>(p, '[data-edge]').forEach((e) => {
        anims.push(loop(e, hold([
          { offset: 0, opacity: 1 },
          { offset: s + DUR * 0.3, opacity: 1, easing: EASE_PEEL },
          { offset: s + DUR, opacity: 0 },
        ])));
      });
    });

    q<SVGCircleElement>(root, '[data-dust]').forEach((d) => {
      const s = 0.3 + Number(d.dataset.t) * 0.4;
      anims.push(loop(d, hold([
        { offset: 0, opacity: 0 },
        { offset: s, opacity: 0, easing: EASE_PEEL },
        { offset: s + 0.1, opacity: 1 },
      ])));
    });
    return anims;
  },
};

export default cover;
