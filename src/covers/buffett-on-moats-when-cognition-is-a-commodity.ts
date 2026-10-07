/* FIG. 55 · MOAT, UNRENTABLE
   At right a solid cream keep inside a fine ash ring: the moat. Fifteen
   squares once sat on that ring. Three are still there, solid cream,
   evenly spaced: the parts no competitor can buy by the token (affection,
   transaction data, physical cost). The other twelve slots are dashed
   outlines, the house mark for something absent. At left those twelve
   squares stand in a neat 4×3 grid over a ticked scale: a rival's copy,
   assembled at a metered price.

   Motion: the loop opens with the twelve squares fading out of the rival's
   grid and back onto the ring, so the moat is whole. Then, one after
   another, each rentable square lifts off the ring and travels left into
   the rival's grid, uncovering its dashed slot. The three solid squares
   and the keep never move. When the last square lands the loop rests on
   the still. */
import {
  type Cover, CREAM, ASH, ASH_DIM, EASE_IN_OUT,
  svg, square, circle, line, g, ruler, figMark, captionBlock, hold, loop, stagger, q, fmt,
} from './_lib.ts';

const CX = 1640, CY = 680, R = 340, N = 15, S = 64, KEEP = 200;
const DURABLE = [0, 5, 10];
const GX = 410, GY = 580, PITCH = 100;

const ringAt = (k: number) => {
  const a = (-90 + (k * 360) / N) * (Math.PI / 180);
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
};

/* The twelve rentable slots, nearest the rival first, each paired with a
   grid cell filled from the right-hand column inwards. */
const RENTABLE = Array.from({ length: N }, (_, k) => k)
  .filter((k) => !DURABLE.includes(k))
  .sort((a, b) => ringAt(a).x - ringAt(b).x)
  .map((k, i) => {
    const col = 3 - Math.floor(i / 3), row = i % 3;
    return { k, ring: ringAt(k), cell: { x: GX + col * PITCH, y: GY + row * PITCH } };
  });

const cover: Cover = {
  slug: 'buffett-on-moats-when-cognition-is-a-commodity',
  fig: '55',
  caption: 'MOAT, UNRENTABLE',
  motionPx: 1569,

  still(alt) {
    const slots = RENTABLE.map((u) => square({
      cx: u.ring.x, cy: u.ring.y, s: S, fill: 'none', stroke: ASH,
      'stroke-width': 3, 'stroke-dasharray': '12 10',
    }));
    const durable = DURABLE.map((k) => square({ cx: ringAt(k).x, cy: ringAt(k).y, s: S }));
    const rented = RENTABLE.map((u, i) => square({ cx: u.cell.x, cy: u.cell.y, s: S, 'data-unit': i }));

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      circle({ cx: CX, cy: CY, r: R, fill: 'none', stroke: ASH_DIM, 'stroke-width': 2 }),
      square({ cx: CX, cy: CY, s: KEEP, fill: CREAM }),
      g(slots),
      g(durable, { fill: CREAM }),
      line({ x1: GX + 3 * PITCH + 80, y1: CY, x2: CX - R - 80, y2: CY, stroke: ASH_DIM, 'stroke-width': 2 }),
      ruler({ x1: GX - 40, x2: GX + 3 * PITCH + 40, y: GY + 2 * PITCH + 90, step: 20, every: 5, stroke: ASH }),
      g(rented, { fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const TRAVEL = 0.12;
    const n = RENTABLE.length;

    // Each square fades out of the rival's grid and reappears on the ring,
    // then waits its turn and travels left back into the grid.
    q<SVGRectElement>(root, 'rect[data-unit]').forEach((el) => {
      const i = Number(el.dataset.unit);
      const u = RENTABLE[i];
      const onRing = `translate(${fmt(u.ring.x - u.cell.x)}px, ${fmt(u.ring.y - u.cell.y)}px)`;
      const home = 'translate(0px, 0px)';
      const s = stagger(i, n, 0.14, 0.62);
      anims.push(loop(el, hold([
        { offset: 0, transform: home, opacity: 1, easing: EASE_IN_OUT },
        { offset: 0.04, transform: home, opacity: 0 },
        { offset: 0.041, transform: onRing, opacity: 0, easing: EASE_IN_OUT },
        { offset: 0.09, transform: onRing, opacity: 1 },
        { offset: s, transform: onRing, opacity: 1, easing: EASE_IN_OUT },
        { offset: s + TRAVEL, transform: home, opacity: 1 },
      ])));
    });

    return anims;
  },
};

export default cover;
