/* FIG. 40 · LESSONS, LIVED
   Ten solid cream circles in a row across the middle third; a thin
   vertical hairline stands just right of the tenth. Above each circle a
   faint dashed ash ring remains as the ghost of what it was before it
   was learnt.

   Motion: every station begins as a dashed ring sitting where the circle
   will be. The hairline steps rightward one station per beat; each ring
   it passes fills solid as the dash-ring lifts to hang above it. Circles
   ahead of the line stay dashed, unknown. The line halts past the tenth
   and holds. */
import {
  type Cover, CREAM, ASH_DIM, STEP, EASE_OUT,
  svg, circle, dashedCircle, line, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const N = 10;
const X0 = 420;          // first station
const PITCH = 172;       // station spacing
const CY = 760;          // circle row
const R = 52;            // circle radius
const GHOST_Y = 520;     // resting height of the dashed ring
const LIFT = CY - GHOST_Y;
const LINE_X0 = X0 - PITCH * 0.5;                 // line starts left of station one
const LINE_X = X0 + (N - 1) * PITCH + PITCH * 0.5; // resting line, right of the tenth

const cover: Cover = {
  slug: 'leadership-lessons-i-wish-knew-earlier',
  fig: '40',
  caption: 'LESSONS, LIVED',

  still(alt) {
    const stations: string[] = [];
    for (let i = 0; i < N; i++) {
      const cx = X0 + i * PITCH;
      stations.push(dashedCircle({ cx, cy: GHOST_Y, r: R, 'data-ghost': i, 'stroke-dasharray': '14 12' }));
      stations.push(circle({ cx, cy: CY, r: R, fill: CREAM, 'data-lesson': i }));
    }
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(stations),
      line({ x1: LINE_X, y1: 330, x2: LINE_X, y2: 960, stroke: CREAM, 'stroke-width': 2, 'data-line': '' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const BEAT = 0.062;          // one station per beat
    const T0 = 0.06;             // the line waits, then walks
    const passAt = (i: number) => T0 + (i + 1) * BEAT;   // when the line clears station i

    const rule = root.querySelector<SVGLineElement>('[data-line]');
    if (rule) {
      // STEP easing on a frame holds its pose until the next frame, so the
      // line jumps station to station; the last frame (the still) has none.
      const frames: Keyframe[] = [{ offset: 0, transform: `translateX(${LINE_X0 - LINE_X}px)`, easing: STEP }];
      for (let i = 0; i < N; i++) {
        const x = i < N - 1 ? X0 + (i + 0.5) * PITCH : LINE_X;
        const f: Keyframe = { offset: passAt(i), transform: `translateX(${x - LINE_X}px)` };
        if (i < N - 1) f.easing = STEP;
        frames.push(f);
      }
      anims.push(loop(rule, hold(frames)));
    }

    q<SVGCircleElement>(root, '[data-lesson]').forEach((c) => {
      const i = Number(c.dataset.lesson);
      const at = passAt(i);
      anims.push(loop(c, hold([
        { offset: 0, opacity: 0 },
        { offset: at, opacity: 0, easing: EASE_OUT },
        { offset: at + 0.03, opacity: 1 },
      ])));
    });

    q<SVGCircleElement>(root, '[data-ghost]').forEach((c) => {
      const i = Number(c.dataset.ghost);
      const at = passAt(i);
      anims.push(loop(c, hold([
        { offset: 0, transform: `translateY(${LIFT}px)` },
        { offset: at, transform: `translateY(${LIFT}px)`, easing: EASE_OUT },
        { offset: at + 0.05, transform: 'translateY(0px)' },
      ])));
    });
    return anims;
  },
};

export default cover;
