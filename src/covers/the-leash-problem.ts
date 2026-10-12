/* FIG. 53 · LEASH, CONTESTED
   Left, a 6×5 field of small squares: the many, drawn in outline, and four
   solid ones, the few who could hold the leash. Right, one large cream
   circle. A single hairline, the leash, runs from the circle to one of the
   solid squares. Beyond the circle a dashed ring, the house mark for
   something absent, sits invisible at rest.

   Motion, two phases: the leash passes from hand to hand among the four
   solid squares, and each time a pulse runs up it from the holder to the
   circle, a command obeyed (0 → 0.52). Then every leash goes, the dashed
   ring appears and the circle drifts off on its own (0.53 → 0.72) before
   settling back and the first leash returns (0.78). Rest. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, ASH_DIM, EASE_IN_OUT, EASE_OUT,
  svg, circle, dashedCircle, line, g, square, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const COL0 = 330, ROW0 = 480, PITCH = 100, SZ = 44;
const COLS = 6, ROWS = 5;
const MIND = { x: 1760, y: 680, r: 200 };
const RING_R = 300;
const DRIFT = 150;

/* The few: [col, row], holder 0 is the one on the leash at rest. */
const HOLDERS: [number, number][] = [[5, 2], [4, 0], [5, 4], [3, 3]];
const at = (c: number, r: number) => ({ x: COL0 + c * PITCH, y: ROW0 + r * PITCH });

const SLOT = 0.13;

const cover: Cover = {
  slug: 'the-leash-problem',
  fig: '53',
  caption: 'LEASH, CONTESTED',
  motionPx: DRIFT,

  still(alt) {
    const many: string[] = [], few: string[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = at(c, r);
        const h = HOLDERS.findIndex(([hc, hr]) => hc === c && hr === r);
        if (h >= 0) few.push(square({ cx: p.x, cy: p.y, s: SZ, fill: CREAM, 'data-few': h }));
        else many.push(square({ cx: p.x, cy: p.y, s: SZ, fill: 'none', stroke: ASH_DIM, 'stroke-width': 2.5, 'data-many': '' }));
      }
    }

    const leashes = HOLDERS.map(([c, r], i) => {
      const p = at(c, r);
      return line({ x1: p.x + SZ / 2, y1: p.y, x2: MIND.x, y2: MIND.y, 'data-leash': i, opacity: i === 0 ? 1 : 0 });
    });

    const pulses = HOLDERS.map(([c, r], i) => {
      const p = at(c, r);
      return circle({ cx: p.x + SZ / 2, cy: p.y, r: 9, opacity: 0, 'data-pulse': i, 'data-dx': MIND.x - (p.x + SZ / 2), 'data-dy': MIND.y - p.y });
    });

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(many),
      g(leashes, { stroke: CREAM_DIM, 'stroke-width': 2.5, fill: 'none' }),
      g(pulses, { fill: CREAM }),
      g(few),
      g([
        dashedCircle({ cx: MIND.x, cy: MIND.y, r: RING_R, stroke: ASH, opacity: 0, 'data-ring': '' }),
        circle({ cx: MIND.x, cy: MIND.y, r: MIND.r, fill: CREAM }),
      ], { 'data-mind': '' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];

    HOLDERS.forEach((_, i) => {
      const s = i * SLOT;
      const leash = root.querySelector<SVGLineElement>(`line[data-leash="${i}"]`);
      if (leash) {
        const frames: Keyframe[] = i === 0
          ? [
              { offset: 0, opacity: 1 },
              { offset: SLOT, opacity: 1, easing: EASE_IN_OUT },
              { offset: SLOT + 0.012, opacity: 0 },
              { offset: 0.76, opacity: 0, easing: EASE_IN_OUT },
              { offset: 0.79, opacity: 1 },
            ]
          : [
              { offset: 0, opacity: 0 },
              { offset: s, opacity: 0, easing: EASE_IN_OUT },
              { offset: s + 0.012, opacity: 1 },
              { offset: s + SLOT, opacity: 1, easing: EASE_IN_OUT },
              { offset: s + SLOT + 0.012, opacity: 0 },
            ];
        anims.push(loop(leash, hold(frames)));
      }

      const dot = root.querySelector<SVGCircleElement>(`circle[data-pulse="${i}"]`);
      if (dot) {
        const dx = Number(dot.dataset.dx), dy = Number(dot.dataset.dy);
        anims.push(loop(dot, hold([
          { offset: 0, transform: 'translate(0px, 0px)', opacity: 0 },
          { offset: s + 0.02, transform: 'translate(0px, 0px)', opacity: 0 },
          { offset: s + 0.025, transform: 'translate(0px, 0px)', opacity: 0.95, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
          { offset: s + 0.11, transform: `translate(${dx}px, ${dy}px)`, opacity: 0.95 },
          { offset: s + 0.115, transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
          { offset: s + 0.12, transform: 'translate(0px, 0px)', opacity: 0 },
        ])));
      }

      // The holder brightens a touch while it has the leash.
      const hand = root.querySelector<SVGRectElement>(`rect[data-few="${i}"]`);
      if (hand) {
        hand.setAttribute('style', 'transform-box: fill-box; transform-origin: center');
        anims.push(loop(hand, hold([
          { offset: 0, transform: 'scale(1)' },
          { offset: s, transform: 'scale(1)', easing: EASE_OUT },
          { offset: s + 0.02, transform: 'scale(1.25)' },
          { offset: s + SLOT - 0.01, transform: 'scale(1.25)', easing: EASE_IN_OUT },
          { offset: s + SLOT + 0.01, transform: 'scale(1)' },
        ])));
      }
    });

    // Unheld: the ring appears and the mind drifts off on its own, then returns.
    const mind = root.querySelector<SVGGElement>('g[data-mind]');
    if (mind) {
      anims.push(loop(mind, hold([
        { offset: 0, transform: 'translate(0px, 0px)' },
        { offset: 0.55, transform: 'translate(0px, 0px)', easing: EASE_IN_OUT },
        { offset: 0.64, transform: `translate(${DRIFT}px, -40px)` },
        { offset: 0.68, transform: `translate(${DRIFT}px, -40px)`, easing: EASE_IN_OUT },
        { offset: 0.76, transform: 'translate(0px, 0px)' },
      ])));
    }
    const ring = root.querySelector<SVGCircleElement>('circle[data-ring]');
    if (ring) {
      anims.push(loop(ring, hold([
        { offset: 0, opacity: 0 },
        { offset: 0.53, opacity: 0, easing: EASE_IN_OUT },
        { offset: 0.58, opacity: 1 },
        { offset: 0.7, opacity: 1, easing: EASE_IN_OUT },
        { offset: 0.76, opacity: 0 },
      ])));
    }

    // The many dim while nobody holds it.
    q<SVGRectElement>(root, 'rect[data-many]').forEach((r) => {
      anims.push(loop(r, hold([
        { offset: 0, opacity: 1 },
        { offset: 0.53, opacity: 1, easing: EASE_IN_OUT },
        { offset: 0.58, opacity: 0.4 },
        { offset: 0.72, opacity: 0.4, easing: EASE_IN_OUT },
        { offset: 0.78, opacity: 1 },
      ])));
    });

    return anims;
  },
};

export default cover;
