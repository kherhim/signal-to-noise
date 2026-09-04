/* FIG. 23 · CONFIDENCE, QUIET
   Left, a large ring drawn as a thin cream outline, hollow and faint,
   slightly off centre: the loud certainty that is all surface. Right, a
   smaller solid cream disc, perfectly still, with a faint dashed circle
   held inside it: quiet confidence, holding its doubt.

   Motion: the ring flickers in opacity and drifts a few pixels, restless,
   never settling; the loop rests with it at its dimmest. The disc does
   not move. The dashed circle inside it breathes once every six seconds. */
import {
  type Cover, CREAM, ASH_DIM,
  svg, circle, dashedCircle, figMark, captionBlock, prng, hold, loop,
} from './_lib.ts';

const RING = { x: 800, y: 640, r: 280 };
const DISC = { x: 1660, y: 720, r: 170 };
const DOUBT_R = 90;
const DIM = 0.45;                 // the ring at rest

const cover: Cover = {
  slug: 'shadows-light-dance-self-doubt-self-confidence',
  fig: '23',
  caption: 'CONFIDENCE, QUIET',

  still(alt) {
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      circle({ 'data-ring': '', cx: RING.x, cy: RING.y, r: RING.r, fill: 'none', stroke: CREAM, 'stroke-width': 2, opacity: DIM }),
      circle({ cx: DISC.x, cy: DISC.y, r: DISC.r, fill: CREAM }),
      dashedCircle({ 'data-doubt': '', cx: DISC.x, cy: DISC.y, r: DOUBT_R, stroke: ASH_DIM, 'stroke-width': 2.4, 'stroke-dasharray': '14 12' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const ring = root.querySelector<SVGCircleElement>('[data-ring]');
    if (ring) {
      const rand = prng(23);
      const frames: Keyframe[] = [];
      let t = 0;
      while (t < 0.76) {
        const bright = rand() < 0.5;
        frames.push({
          offset: t,
          opacity: bright ? DIM + 0.25 + rand() * 0.4 : DIM + rand() * 0.12,
          transform: `translate(${((rand() - 0.5) * 16).toFixed(1)}px, ${((rand() - 0.5) * 16).toFixed(1)}px)`,
          easing: rand() < 0.4 ? 'steps(1, end)' : 'ease-in-out',
        });
        t += 0.012 + rand() * 0.04;
      }
      frames.push({ offset: 0.78, opacity: DIM, transform: 'translate(0px, 0px)' });
      anims.push(loop(ring, hold(frames)));
    }

    const doubt = root.querySelector<SVGCircleElement>('[data-doubt]');
    if (doubt) {
      doubt.setAttribute('style', `transform-box: view-box; transform-origin: ${DISC.x}px ${DISC.y}px`);
      const frames: Keyframe[] = [{ offset: 0, transform: 'scale(1)' }];
      // one breath every six seconds: a third of the period
      for (const at of [0.04, 0.373, 0.706]) {
        frames.push({ offset: at, transform: 'scale(1)', easing: 'ease-in-out' });
        frames.push({ offset: at + 0.035, transform: 'scale(1.14)', easing: 'ease-in-out' });
        frames.push({ offset: at + 0.08, transform: 'scale(1)' });
      }
      anims.push(loop(doubt, hold(frames)));
    }
    return anims;
  },
};

export default cover;
