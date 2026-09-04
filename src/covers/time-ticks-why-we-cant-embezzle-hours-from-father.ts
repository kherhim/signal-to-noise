/* FIG. 12 · TIME, IRREVERSIBLE
   A ruler of hairline ticks runs the full width at mid-height, a taller
   tick every fifth. One solid cream circle sits on the tick at centre;
   every tick to its left is ash, every tick to its right cream.

   Motion: the scale slides left beneath the fixed circle one tick per
   beat, stepping not gliding, five ticks per loop. Each tick that passes
   under the circle fades from cream to ash and never returns. The ruler
   group starts shifted right by five ticks and steps back to identity, so
   the rest pose is the still and the restart is seamless (five extra
   ticks are drawn off the left edge; a clip keeps the slide inside the
   frame). Ticks are thin rects so their fill can animate. */
import {
  type Cover, CREAM, ASH, ASH_DIM, STEP, EASE_OUT,
  svg, rect, circle, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const Y = 675;
const X0 = 160, X1 = 2240;
const STEP_X = 52;
const PER_LOOP = 5;
const CENTRE_I = 20;           // 160 + 20 × 52 = 1200
const MINOR = 44, MAJOR = 92;
const TICK_W = 3;

const cover: Cover = {
  slug: 'time-ticks-why-we-cant-embezzle-hours-from-father',
  fig: '12',
  caption: 'TIME, IRREVERSIBLE',

  still(alt) {
    const ticks: string[] = [];
    for (let i = -PER_LOOP; i <= 40; i++) {
      const x = X0 + i * STEP_X;
      const major = ((i % 5) + 5) % 5 === 0;
      const passing = i >= CENTRE_I - PER_LOOP && i < CENTRE_I;
      ticks.push(rect({
        x: x - TICK_W / 2, y: Y, w: TICK_W, h: major ? MAJOR : MINOR,
        fill: i < CENTRE_I ? ASH : CREAM,
        'data-pass': passing ? i - (CENTRE_I - PER_LOOP) : undefined,
      }));
    }
    return svg(cover.slug, alt, [
      `<defs><clipPath id="time-ticks-frame">${rect({ x: X0 - 1, y: 0, w: X1 - X0 + 2, h: 1350 })}</clipPath></defs>`,
      figMark(cover.fig),
      // The clip sits on a static outer group: a clip-path on the moving
      // group itself would slide along with it.
      g(g([
        rect({ x: X0 - PER_LOOP * STEP_X - 20, y: Y - 1, w: X1 - X0 + PER_LOOP * STEP_X + 40, h: 2, fill: ASH_DIM }),
        ...ticks,
      ], { 'data-scale': '' }), { 'clip-path': 'url(#time-ticks-frame)' }),
      circle({ cx: X0 + CENTRE_I * STEP_X, cy: Y, r: 72, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const BEAT = 0.13;
    const scale = root.querySelector<SVGGElement>('[data-scale]');
    if (scale) {
      const frames: Keyframe[] = [];
      for (let k = 0; k <= PER_LOOP; k++) {
        frames.push({
          offset: k * BEAT,
          transform: `translateX(${(PER_LOOP - k) * STEP_X}px)`,
          easing: STEP,
        });
      }
      frames.push({ offset: PER_LOOP * BEAT + 0.001, transform: 'translateX(0px)' });
      anims.push(loop(scale, hold(frames)));
    }
    q<SVGRectElement>(root, 'rect[data-pass]').forEach((t) => {
      const j = Number(t.dataset.pass);           // 0 … 4, first to pass
      const at = (j + 1) * BEAT;
      anims.push(loop(t, hold([
        { offset: 0, fill: CREAM },
        { offset: at, fill: CREAM, easing: EASE_OUT },
        { offset: at + 0.05, fill: ASH },
      ])));
    });
    return anims;
  },
};

export default cover;
