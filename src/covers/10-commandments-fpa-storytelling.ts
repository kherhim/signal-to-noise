/* FIG. 36 · STORY, DISTILLED
   One solid cream circle, centred, slightly above the midline. Around it
   the faint ash ghost of a twelve-by-twelve grid of tiny squares: the
   cells nearest the circle wholly gone, the outer ring barely there.

   Motion: the grid begins complete and cream, the circle dim among it.
   Squares fade out in rings from the centre outward, slowly, each ring a
   beat longer than the last, and the circle brightens as its
   surroundings clear. The outermost ring settles to faint ash and
   holds. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, EASE_IN_OUT,
  svg, circle, square, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const N = 12, PITCH = 76, SZ = 40;
const CX = 1200, CY = 660;
const X0 = CX - (N - 1) * PITCH / 2, Y0 = CY - (N - 1) * PITCH / 2;
const CORE_R = 150;
/* Resting opacity by ring (0 = innermost of six): the nearest rings are
   gone, the outer ones a fading ash ghost. */
const REST = [0, 0, 0, 0.12, 0.24, 0.4];

const cover: Cover = {
  slug: '10-commandments-fpa-storytelling',
  fig: '36',
  caption: 'STORY, DISTILLED',

  still(alt) {
    const cells: string[] = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const ring = Math.max(Math.abs(c - 5.5), Math.abs(r - 5.5)) - 0.5;
        cells.push(square({
          cx: X0 + c * PITCH, cy: Y0 + r * PITCH, s: SZ,
          fill: ASH, opacity: REST[ring], 'data-ring': ring,
        }));
      }
    }
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(cells),
      circle({ cx: CX, cy: CY, r: CORE_R, fill: CREAM, 'data-core': '' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    // Ring k fades from START[k] to END[k]; each ring takes a beat longer.
    const START = [0.04, 0.10, 0.18, 0.28, 0.40, 0.54];
    const END = [0.10, 0.18, 0.28, 0.40, 0.54, 0.72];

    q<SVGRectElement>(root, '[data-ring]').forEach((el) => {
      const k = Number(el.dataset.ring);
      anims.push(loop(el, hold([
        { offset: 0, fill: CREAM, opacity: 1 },
        { offset: START[k], fill: CREAM, opacity: 1, easing: EASE_IN_OUT },
        { offset: END[k], fill: ASH, opacity: REST[k] },
      ])));
    });

    const core = root.querySelector<SVGCircleElement>('[data-core]');
    if (core) {
      anims.push(loop(core, hold([
        { offset: 0, fill: CREAM_DIM, opacity: 0.55, easing: EASE_IN_OUT },
        { offset: 0.72, fill: CREAM, opacity: 1 },
      ])));
    }
    return anims;
  },
};

export default cover;
