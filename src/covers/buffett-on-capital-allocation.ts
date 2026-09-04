/* FIG. 46 · DOLLAR, RETAINED
   One solid cream circle top-centre fans five hairlines down to five
   circles along the base: three solid, each as large as the source or
   larger; one thin outline, smaller; one dashed. The one-dollar test.

   Motion: the source brightens once, then a dot runs down each hairline in
   turn. Where the test is passed the node lights (fill opacity up); the
   outline and the dashed node stay as they are and the dot dies at their
   edge. Five paths, then a hold. Rest: every path resolved, the still. */
import {
  type Cover, CREAM, ASH, ASH_DIM, EASE_OUT, EASE_IN_OUT,
  svg, circle, dashedCircle, line, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const SRC = { x: 1200, y: 330, r: 72 };
const BASE_Y = 1000;
const GAP = 8; // hairlines stop short of the circle edges

/* kind: 1 solid, 2 thin outline, 3 dashed */
const NODES = [
  { x: 400,  r: 88,  kind: 1 },
  { x: 800,  r: 44,  kind: 2 },
  { x: 1200, r: 100, kind: 1 },
  { x: 1600, r: 56,  kind: 3 },
  { x: 2000, r: 76,  kind: 1 },
];

const cover: Cover = {
  slug: 'buffett-on-capital-allocation',
  fig: '46',
  caption: 'DOLLAR, RETAINED',

  still(alt) {
    const lines: string[] = [], nodes: string[] = [], dots: string[] = [];
    NODES.forEach((n, i) => {
      const dx = n.x - SRC.x, dy = BASE_Y - SRC.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const x1 = SRC.x + ux * (SRC.r + GAP), y1 = SRC.y + uy * (SRC.r + GAP);
      const x2 = n.x - ux * (n.r + GAP), y2 = BASE_Y - uy * (n.r + GAP);
      lines.push(line({ x1, y1, x2, y2 }));
      dots.push(circle({
        'data-dot': i, 'data-dx': (x2 - x1).toFixed(1), 'data-dy': (y2 - y1).toFixed(1),
        cx: x1, cy: y1, r: 11, fill: CREAM, opacity: 0,
      }));
      if (n.kind === 1) nodes.push(circle({ 'data-node': i, cx: n.x, cy: BASE_Y, r: n.r, fill: CREAM }));
      else if (n.kind === 2) nodes.push(circle({ cx: n.x, cy: BASE_Y, r: n.r, fill: 'none', stroke: ASH, 'stroke-width': 2 }));
      else nodes.push(dashedCircle({ cx: n.x, cy: BASE_Y, r: n.r }));
    });

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      g(lines, { stroke: ASH_DIM, 'stroke-width': 2, fill: 'none' }),
      g(nodes),
      circle({ 'data-src': '', cx: SRC.x, cy: SRC.y, r: SRC.r, fill: CREAM }),
      g(dots),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const T0 = 0.1, STEPT = 0.12, TRAVEL = 0.085;

    const src = root.querySelector<SVGCircleElement>('[data-src]');
    if (src) {
      anims.push(loop(src, hold([
        { offset: 0, fill: CREAM },
        { offset: 0.02, fill: CREAM, easing: EASE_OUT },
        { offset: 0.05, fill: '#ffffff', easing: EASE_IN_OUT },
        { offset: T0, fill: CREAM },
      ])));
    }

    q<SVGCircleElement>(root, '[data-dot]').forEach((dot) => {
      const i = Number(dot.dataset.dot);
      const s = T0 + i * STEPT;
      const dx = Number(dot.dataset.dx), dy = Number(dot.dataset.dy);
      anims.push(loop(dot, hold([
        { offset: 0, transform: 'translate(0px, 0px)', opacity: 0 },
        { offset: s, transform: 'translate(0px, 0px)', opacity: 0 },
        { offset: s + 0.008, transform: `translate(${dx * 0.02}px, ${dy * 0.02}px)`, opacity: 1, easing: EASE_IN_OUT },
        { offset: s + TRAVEL, transform: `translate(${dx}px, ${dy}px)`, opacity: 1 },
        { offset: s + TRAVEL + 0.012, transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
      ])));

      const node = root.querySelector<SVGCircleElement>(`[data-node="${i}"]`);
      if (node) {
        const arrive = s + TRAVEL;
        anims.push(loop(node, hold([
          { offset: 0, fillOpacity: 0.14 },
          { offset: arrive, fillOpacity: 0.14, easing: EASE_OUT },
          { offset: arrive + 0.04, fillOpacity: 1 },
        ])));
      }
    });
    return anims;
  },
};

export default cover;
