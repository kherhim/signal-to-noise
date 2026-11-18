/* FIG. 58 · SUCCESSION, UNPLANNED
   Three seven-segment digits, the kind on an old digital clock, read CEO.
   Unlit segments stay faintly visible, as on a real display. An E and an F
   differ by a single segment, the bottom bar: one stroke between the two
   jobs. In the still that segment is unlit and the display reads CFO.

   Motion: the loop opens on CEO. After a beat the E's bottom segment
   flickers, comes loose and drops away, fading as it falls; the slot it
   leaves goes dark and the display reads CFO. Two-beat hold.
   Rest: the still. */
import {
  type Cover, CREAM, EASE_IN_OUT, STEP,
  svg, path, g, figMark, captionBlock, hold, loop, q, fmt,
} from './_lib.ts';

const DW = 300, DH = 560, T = 58, GAP = 9, PITCH = 430;
const X0 = (2400 - (2 * PITCH + DW)) / 2, Y0 = 330;
const DROP = 260;
const UNLIT = '#262624';

type Seg = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
const ALL: Seg[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

/* A bevelled segment: a hexagon pointed at both ends. */
function hSeg(x1: number, x2: number, yc: number): string {
  const h = T / 2;
  return `M${fmt(x1)} ${fmt(yc)}L${fmt(x1 + h)} ${fmt(yc - h)}L${fmt(x2 - h)} ${fmt(yc - h)}L${fmt(x2)} ${fmt(yc)}L${fmt(x2 - h)} ${fmt(yc + h)}L${fmt(x1 + h)} ${fmt(yc + h)}Z`;
}
function vSeg(xc: number, y1: number, y2: number): string {
  const h = T / 2;
  return `M${fmt(xc)} ${fmt(y1)}L${fmt(xc + h)} ${fmt(y1 + h)}L${fmt(xc + h)} ${fmt(y2 - h)}L${fmt(xc)} ${fmt(y2)}L${fmt(xc - h)} ${fmt(y2 - h)}L${fmt(xc - h)} ${fmt(y1 + h)}Z`;
}

function segD(x: number, s: Seg): string {
  const L = x + T / 2, R = x + DW - T / 2;
  const top = Y0 + T / 2, mid = Y0 + DH / 2, bot = Y0 + DH - T / 2;
  switch (s) {
    case 'a': return hSeg(L + GAP, R - GAP, top);
    case 'g': return hSeg(L + GAP, R - GAP, mid);
    case 'd': return hSeg(L + GAP, R - GAP, bot);
    case 'f': return vSeg(L, top + GAP, mid - GAP);
    case 'b': return vSeg(R, top + GAP, mid - GAP);
    case 'e': return vSeg(L, mid + GAP, bot - GAP);
    case 'c': return vSeg(R, mid + GAP, bot - GAP);
  }
}

function digit(x: number, lit: Seg[]): string[] {
  return ALL.map((s) => path({ d: segD(x, s), fill: lit.includes(s) ? CREAM : UNLIT }));
}

const xMid = X0 + PITCH;

const cover: Cover = {
  slug: 'nvidia-plan-b-was-its-cfo',
  fig: '58',
  caption: 'SUCCESSION, UNPLANNED',
  motionPx: DROP,

  still(alt) {
    // The loose segment is in the DOM for the motion but invisible in the still.
    const loose = path({ d: segD(xMid, 'd'), fill: CREAM, 'data-loose': 1, opacity: 0 });
    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g([
        ...digit(X0, ['a', 'd', 'e', 'f']),          // C
        ...digit(xMid, ['a', 'e', 'f', 'g']),        // F (an E with d unlit)
        ...digit(X0 + 2 * PITCH, ['a', 'b', 'c', 'd', 'e', 'f']), // O
        loose,
      ], { transform: 'skewX(-6) translate(70 0)' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const [loose] = q<SVGPathElement>(root, '[data-loose]');
    const flick = { easing: STEP };
    return [loop(loose, hold([
      { offset: 0, opacity: 1, transform: 'translateY(0px)', ...flick },
      { offset: 0.30, opacity: 0.25, transform: 'translateY(0px)', ...flick },
      { offset: 0.31, opacity: 1, transform: 'translateY(0px)', ...flick },
      { offset: 0.33, opacity: 0.25, transform: 'translateY(0px)', ...flick },
      { offset: 0.34, opacity: 1, transform: 'translateY(0px)', easing: EASE_IN_OUT },
      { offset: 0.58, opacity: 0, transform: `translateY(${DROP}px)` },
    ]))];
  },
};

export default cover;
