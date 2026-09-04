/* FIG. 32 · INSIGHT, COMPOUNDED
   A large outlined ring, centred. On its circumference twelve small solid
   circles, evenly spaced like hours. From each a hairline runs inward to
   one solid cream circle at the centre, larger than any on the rim.

   Motion: rim circles appear clockwise from the top, one per second,
   each extending its hairline inward as it lands; the centre circle grows
   a step with every spoke that reaches it. After the twelfth it holds at
   full size. Rest: the still. */
import {
  type Cover, CREAM, ASH_DIM, EASE_OUT, STEP,
  svg, circle, path, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const C = { x: 1200, y: 675 };
const RING_R = 430;
const RIM_R = 20;
const CORE_R = 120;
const N = 12;
const START_SCALE = 0.25;

const rad = (deg: number) => (deg * Math.PI) / 180;

const cover: Cover = {
  slug: 'reflecting-year-insights-final-thoughts-2024',
  fig: '32',
  caption: 'INSIGHT, COMPOUNDED',

  still(alt) {
    const spokes: string[] = [], dots: string[] = [];
    for (let i = 0; i < N; i++) {
      const a = rad(-90 + i * (360 / N));           // clockwise from the top
      const x = C.x + RING_R * Math.cos(a), y = C.y + RING_R * Math.sin(a);
      spokes.push(path({ 'data-spoke': i, d: `M${x.toFixed(2)},${y.toFixed(2)} L${C.x},${C.y}` }));
      dots.push(circle({ 'data-rim': i, cx: x, cy: y, r: RIM_R }));
    }
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      circle({ cx: C.x, cy: C.y, r: RING_R, fill: 'none', stroke: CREAM, 'stroke-width': 3 }),
      g(spokes, { stroke: ASH_DIM, 'stroke-width': 2, fill: 'none' }),
      g(dots, { fill: CREAM }),
      circle({ 'data-core': '', cx: C.x, cy: C.y, r: CORE_R, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const T0 = 0.04;
    const BEAT = 1000 / 18000;   // one second of an 18 s loop
    const DRAW = 0.045;
    const arrive = (i: number) => T0 + i * BEAT + DRAW;

    q<SVGCircleElement>(root, '[data-rim]').forEach((dot) => {
      const i = Number(dot.dataset.rim);
      const s = T0 + i * BEAT;
      anims.push(loop(dot, hold([
        { offset: 0, opacity: 0 },
        { offset: s, opacity: 0, easing: STEP },
        { offset: s + 0.004, opacity: 1 },
      ])));
    });

    q<SVGPathElement>(root, '[data-spoke]').forEach((p) => {
      const i = Number(p.dataset.spoke);
      const L = p.getTotalLength();
      p.style.strokeDasharray = `${L}`;
      const s = T0 + i * BEAT;
      anims.push(loop(p, hold([
        { offset: 0, strokeDashoffset: L },
        { offset: s, strokeDashoffset: L, easing: EASE_OUT },
        { offset: s + DRAW, strokeDashoffset: 0 },
      ])));
    });

    const core = root.querySelector<SVGCircleElement>('[data-core]');
    if (core) {
      core.setAttribute('style', `transform-box: view-box; transform-origin: ${C.x}px ${C.y}px`);
      const frames: Keyframe[] = [{ offset: 0, transform: `scale(${START_SCALE})` }];
      for (let k = 0; k < N; k++) {
        const from = START_SCALE + ((1 - START_SCALE) * k) / N;
        const to = START_SCALE + ((1 - START_SCALE) * (k + 1)) / N;
        frames.push({ offset: arrive(k), transform: `scale(${from.toFixed(4)})`, easing: EASE_OUT });
        frames.push({ offset: arrive(k) + 0.018, transform: `scale(${to.toFixed(4)})` });
      }
      frames[frames.length - 1] = { offset: arrive(N - 1) + 0.018, transform: 'scale(1)' };
      anims.push(loop(core, hold(frames)));
    }
    return anims;
  },
};

export default cover;
