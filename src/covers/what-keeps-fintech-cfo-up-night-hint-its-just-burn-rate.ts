/* FIG. 35 · SURFACE, WIDENED
   Centre, a solid cream circle. Around it five concentric outlined rings
   at widening intervals, each thinner and greyer than the last, the
   outermost barely visible. Small ash squares sit on the outer rings'
   circumferences where the edge is exposed.

   Motion: rings are born from the solid circle one every 2.3 s (five in
   the motion window), each drifting outward and thinning as it goes, its
   squares riding the circumference; the centre never moves. At rest
   five rings hang at their widest, the outermost nearly lost. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, ASH_DIM, EASE_OUT, STEP,
  svg, circle, square, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const C = { x: 1200, y: 680 };
const CORE_R = 120;
const RINGS = [
  { r: 175, w: 3,   stroke: CREAM_DIM, o: 0.9 },
  { r: 235, w: 2.6, stroke: CREAM_DIM, o: 0.7 },
  { r: 305, w: 2.2, stroke: ASH,       o: 0.8 },
  { r: 385, w: 1.8, stroke: ASH,       o: 0.6 },
  { r: 475, w: 1.4, stroke: ASH_DIM,   o: 0.8 },
];
/* Squares on the outer rings: [ring index, angle in degrees, clockwise from three o'clock]. */
const SQUARES: [number, number][] = [
  [2, -70], [2, 150], [3, 20], [3, -125], [3, 105], [4, -35], [4, 160], [4, 65], [4, -160],
];
const SQ = 30;

const cover: Cover = {
  slug: 'what-keeps-fintech-cfo-up-night-hint-its-just-burn-rate',
  fig: '35',
  caption: 'SURFACE, WIDENED',

  still(alt) {
    const rings = RINGS.map((k, i) => circle({
      cx: C.x, cy: C.y, r: k.r, fill: 'none', stroke: k.stroke, 'stroke-width': k.w, 'stroke-opacity': k.o,
      'vector-effect': 'non-scaling-stroke', 'data-ring': i,
    }));
    const squares = SQUARES.map(([i, deg]) => {
      const a = (deg * Math.PI) / 180;
      return square({
        cx: C.x + RINGS[i].r * Math.cos(a), cy: C.y + RINGS[i].r * Math.sin(a), s: SQ,
        fill: ASH, opacity: RINGS[i].o, 'data-sq': i, 'data-a': deg,
      });
    });
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(rings),
      g(squares),
      circle({ cx: C.x, cy: C.y, r: CORE_R, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const BORN = 0.03, EVERY = 0.13, TRAVEL = 0.22;   // 2.3 s between births
    const bornAt = (i: number) => BORN + i * EVERY;    // last ring: 0.55 → 0.77

    q<SVGCircleElement>(root, '[data-ring]').forEach((el) => {
      const i = Number(el.dataset.ring);
      const k = RINGS[i];
      const at = bornAt(i);
      el.setAttribute('style', `transform-box: view-box; transform-origin: ${C.x}px ${C.y}px`);
      anims.push(loop(el, hold([
        { offset: 0, transform: `scale(${CORE_R / k.r})`, strokeOpacity: 0, easing: STEP },
        { offset: at, transform: `scale(${CORE_R / k.r})`, strokeOpacity: 1, easing: EASE_OUT },
        { offset: at + TRAVEL, transform: 'scale(1)', strokeOpacity: k.o },
      ])));
    });

    q<SVGRectElement>(root, '[data-sq]').forEach((el) => {
      const i = Number(el.dataset.sq);
      const a = (Number(el.dataset.a) * Math.PI) / 180;
      const d = CORE_R - RINGS[i].r;                   // back along the radius to the core's edge
      const at = bornAt(i);
      const start = `translate(${(d * Math.cos(a)).toFixed(2)}px, ${(d * Math.sin(a)).toFixed(2)}px)`;
      anims.push(loop(el, hold([
        { offset: 0, transform: start, opacity: 0, easing: STEP },
        { offset: at, transform: start, opacity: 1, easing: EASE_OUT },
        { offset: at + TRAVEL, transform: 'translate(0px, 0px)', opacity: RINGS[i].o },
      ])));
    });
    return anims;
  },
};

export default cover;
