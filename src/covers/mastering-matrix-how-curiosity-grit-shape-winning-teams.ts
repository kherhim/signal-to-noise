/* FIG. 22 · TRAITS, DURABLE
   Two hairlines cross at centre making four quadrants, short ticks along
   each axis. One circle per quadrant: top-right solid cream and largest;
   top-left outlined; bottom-right outlined, smaller; bottom-left dashed.
   Nothing names the axes.

   Motion: the loop opens with all four clustered at the crossing, faint.
   They separate along the diagonals to their quadrants; the solid one
   brightens as it goes, the outlines settle, the dashed one loses stroke
   opacity en route. Hold. Rest: the still. */
import {
  type Cover, CREAM, ASH_DIM, EASE_IN_OUT,
  svg, circle, dashedCircle, line, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const C = { x: 1200, y: 690 };
const HX = [420, 1980], VY = [230, 1150];
const TICK = 130, TL = 12;
const DASH_REST = 0.6;

/* quadrant circles: kind 1 solid, 2 outline, 3 dashed */
const Q = [
  { x: 1600, y: 450, r: 120, kind: 1 },
  { x: 800,  y: 450, r: 84,  kind: 2 },
  { x: 1600, y: 930, r: 62,  kind: 2 },
  { x: 800,  y: 930, r: 62,  kind: 3 },
];

const cover: Cover = {
  slug: 'mastering-matrix-how-curiosity-grit-shape-winning-teams',
  fig: '22',
  caption: 'TRAITS, DURABLE',

  still(alt) {
    const axes: string[] = [
      line({ x1: HX[0], y1: C.y, x2: HX[1], y2: C.y }),
      line({ x1: C.x, y1: VY[0], x2: C.x, y2: VY[1] }),
    ];
    for (let x = C.x + TICK; x < HX[1]; x += TICK) axes.push(line({ x1: x, y1: C.y - TL, x2: x, y2: C.y + TL }));
    for (let x = C.x - TICK; x > HX[0]; x -= TICK) axes.push(line({ x1: x, y1: C.y - TL, x2: x, y2: C.y + TL }));
    for (let y = C.y + TICK; y < VY[1]; y += TICK) axes.push(line({ x1: C.x - TL, y1: y, x2: C.x + TL, y2: y }));
    for (let y = C.y - TICK; y > VY[0]; y -= TICK) axes.push(line({ x1: C.x - TL, y1: y, x2: C.x + TL, y2: y }));

    const circles = Q.map((c, i) => {
      const d = { 'data-q': i, 'data-dx': C.x - c.x, 'data-dy': C.y - c.y, cx: c.x, cy: c.y, r: c.r };
      if (c.kind === 1) return circle({ ...d, fill: CREAM });
      if (c.kind === 2) return circle({ ...d, fill: 'none', stroke: CREAM, 'stroke-width': 3 });
      return dashedCircle({ ...d, 'data-dashed': '', 'stroke-opacity': DASH_REST });
    });

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(axes, { stroke: ASH_DIM, 'stroke-width': 2, fill: 'none' }),
      g(circles),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const T0 = 0.1, T1 = 0.56;
    q<SVGCircleElement>(root, '[data-q]').forEach((el) => {
      const dx = Number(el.dataset.dx), dy = Number(el.dataset.dy);
      const dashed = 'dashed' in el.dataset;
      const from = `translate(${dx}px, ${dy}px)`;
      anims.push(loop(el, hold([
        { offset: 0, transform: from, opacity: 0.25 },
        { offset: T0, transform: from, opacity: 0.25, easing: EASE_IN_OUT },
        { offset: T1, transform: 'translate(0px, 0px)', opacity: 1 },
      ])));
      if (dashed) {
        anims.push(loop(el, hold([
          { offset: 0, strokeOpacity: 1 },
          { offset: T0, strokeOpacity: 1, easing: EASE_IN_OUT },
          { offset: T1, strokeOpacity: DASH_REST },
        ])));
      }
    });
    return anims;
  },
};

export default cover;
