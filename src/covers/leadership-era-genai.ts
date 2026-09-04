/* FIG. 15 · JUDGEMENT, AUGMENTED
   A dense fan of ash hairlines enters from the left edge and converges on
   one solid cream circle just right of centre. A single cream hairline
   leaves the circle and runs level to the right edge.

   Motion: the fan flickers at machine tempo, lines blinking out and back
   on a deterministic pseudo-random schedule; the circle pulses once every
   six seconds; the exit line never moves. Rest: fan lit, circle bright. */
import {
  type Cover, CREAM, ASH, STEP,
  svg, circle, line, g, figMark, captionBlock, prng, hold, loop, q,
} from './_lib.ts';

const HUB = { x: 1420, y: 675, r: 110 };
const FAN = 30;

const cover: Cover = {
  slug: 'leadership-era-genai',
  fig: '15',
  caption: 'JUDGEMENT, AUGMENTED',

  still(alt) {
    const fan: string[] = [];
    for (let i = 0; i < FAN; i++) {
      const y = 215 + (i / (FAN - 1)) * (1135 - 215);
      fan.push(line({ 'data-fan': i, x1: 160, y1: y, x2: HUB.x, y2: HUB.y }));
    }
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(fan, { stroke: ASH, 'stroke-width': 1.5, fill: 'none' }),
      line({ x1: HUB.x, y1: HUB.y, x2: 2240, y2: HUB.y, stroke: CREAM, 'stroke-width': 2 }),
      circle({ 'data-hub': '', cx: HUB.x, cy: HUB.y, r: HUB.r, fill: CREAM }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const rand = prng(15);

    /* Each line blinks out for a few frames at ~7 random moments before
       the rest beat; offsets are sorted so they stay monotonic. */
    q<SVGLineElement>(root, 'line[data-fan]').forEach((ln) => {
      const n = 5 + Math.floor(rand() * 4);
      const starts: number[] = [];
      for (let k = 0; k < n; k++) starts.push(0.01 + rand() * 0.72);
      starts.sort((a, b) => a - b);
      const frames: Keyframe[] = [{ offset: 0, strokeOpacity: 1, easing: STEP }];
      let last = 0;
      for (const s of starts) {
        if (s <= last + 0.004) continue;
        const off = Math.min(s + 0.012, 0.76);
        frames.push({ offset: s, strokeOpacity: 0.08, easing: STEP });
        frames.push({ offset: off, strokeOpacity: 1, easing: STEP });
        last = off;
      }
      frames.push({ offset: 0.78, strokeOpacity: 1 });
      anims.push(loop(ln, hold(frames)));
    });

    const hub = root.querySelector<SVGCircleElement>('circle[data-hub]');
    if (hub) {
      hub.setAttribute('style', 'transform-box: fill-box; transform-origin: center');
      const frames: Keyframe[] = [];
      for (const t of [0, 1 / 3, 2 / 3]) {
        frames.push({ offset: t, transform: 'scale(1)', easing: 'cubic-bezier(0.3, 0, 0.5, 1)' });
        frames.push({ offset: t + 0.04, transform: 'scale(1.12)', easing: 'cubic-bezier(0.5, 0, 0.7, 1)' });
        frames.push({ offset: t + 0.1, transform: 'scale(1)' });
      }
      anims.push(loop(hub, hold(frames)));
    }
    return anims;
  },
};

export default cover;
