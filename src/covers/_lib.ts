/* Shared vocabulary for the animated essay covers.

   Every cover is a module in this directory exporting a `Cover`:
     still(alt)  → the complete <svg> markup of the resting composition,
                   pure string building, no DOM. Rendered at build time by
                   AnimatedCover.astro and rasterised to public/img by
                   scripts/render-cover.mjs, so it must run in Node too.
     motion(svg) → attaches Web Animations API animations to the SVG the
                   browser has and returns them.

   The fabric: near-black canvas, cream shapes, ash-grey secondary, a
   monospace "FIG. NN" mark top-left, a rule and a spaced-capitals
   caption bottom-left. Coordinates are in a 2400×1350 viewBox.

   The loop: PERIOD milliseconds, and the last fifth of every loop is the
   still cover. `hold()` enforces that: pass keyframes that end on the
   rest pose at or before REST_AT and it pins that pose to the end. */

export const W = 2400;
export const H = 1350;

export const CANVAS = '#111111';
export const CREAM = '#efece2';
export const CREAM_DIM = '#d9d6cd';
export const ASH = '#8a8a86';
export const ASH_DIM = '#5a5a58';
export const HAIR = '#3a3a38';

export const PERIOD = 18000;
export const REST_AT = 0.8;

/* JetBrains Mono is loaded on the site; Menlo is what librsvg finds when
   the rasteriser runs on the Mac. Both are close enough in width. */
export const MONO = "'JetBrains Mono', Menlo, ui-monospace, monospace";

export interface Cover {
  slug: string;
  fig: string;
  caption: string;
  still(alt: string): string;
  motion(svg: SVGSVGElement): Animation[];
}

/* ---------- string builders ---------------------------------------- */

type Attrs = Record<string, string | number | boolean | undefined | null>;

export function attrs(a: Attrs): string {
  let out = '';
  for (const k in a) {
    const v = a[k];
    if (v === undefined || v === null || v === false) continue;
    out += v === true ? ` ${k}` : ` ${k}="${String(v)}"`;
  }
  return out;
}

export const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export function rect(a: Attrs & { x: number; y: number; w: number; h: number }): string {
  const { x, y, w, h, ...rest } = a;
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}"${attrs(rest)}/>`;
}

export function square(a: Attrs & { cx: number; cy: number; s: number }): string {
  const { cx, cy, s, ...rest } = a;
  return rect({ x: cx - s / 2, y: cy - s / 2, w: s, h: s, ...rest });
}

export function circle(a: Attrs & { cx: number; cy: number; r: number }): string {
  const { cx, cy, r, ...rest } = a;
  return `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}"${attrs(rest)}/>`;
}

/* The house mark for something absent: an outlined circle, dashed. */
export function dashedCircle(a: Attrs & { cx: number; cy: number; r: number }): string {
  return circle({ fill: 'none', stroke: ASH, 'stroke-width': 3, 'stroke-dasharray': '18 14', ...a });
}

export function line(a: Attrs & { x1: number; y1: number; x2: number; y2: number }): string {
  const { x1, y1, x2, y2, ...rest } = a;
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"${attrs(rest)}/>`;
}

export function path(a: Attrs & { d: string }): string {
  return `<path${attrs(a)}/>`;
}

export function g(children: string[] | string, a: Attrs = {}): string {
  const inner = Array.isArray(children) ? children.join('') : children;
  return `<g${attrs(a)}>${inner}</g>`;
}

export function text(str: string, a: Attrs & { x: number; y: number; size: number; spacing?: number }): string {
  const { x, y, size, spacing = 0, ...rest } = a;
  const esc = str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fmt(size)}" letter-spacing="${fmt(spacing)}" font-family="${MONO}"${attrs(rest)}>${esc}</text>`;
}

/* "FIG. 05" top-left. */
export function figMark(fig: string): string {
  return text(`FIG. ${fig}`, { x: 160, y: 150, size: 30, spacing: 4, fill: ASH });
}

/* Rule and caption along the bottom. */
export function captionBlock(caption: string): string {
  return (
    line({ x1: 160, y1: 1237, x2: 2240, y2: 1237, stroke: '#86847d', 'stroke-width': 2 }) +
    text(caption, { x: 160, y: 1302, size: 40, spacing: 9, fill: CREAM_DIM })
  );
}

/* A ticked scale. Ticks hang below the line; a major every `every` ticks. */
export function ruler(a: {
  x1: number; x2: number; y: number; step: number; every?: number;
  minor?: number; major?: number; stroke?: string; up?: boolean; attrs?: Attrs;
}): string {
  const { x1, x2, y, step, every = 8, minor = 10, major = 21, stroke = CREAM_DIM, up = false } = a;
  const dir = up ? -1 : 1;
  const ticks: string[] = [line({ x1, y1: y, x2, y2: y })];
  let i = 0;
  for (let x = x1; x <= x2 + 0.01; x += step, i++) {
    ticks.push(line({ x1: x, y1: y, x2: x, y2: y + dir * (i % every === 0 ? major : minor) }));
  }
  return g(ticks, { stroke, 'stroke-width': 2, fill: 'none', ...(a.attrs ?? {}) });
}

/* The outer <svg>. `slug` becomes data-cover, which the client bootstrap
   uses to find the right motion() module. */
export function svg(slug: string, alt: string, children: string[] | string, canvas = CANVAS): string {
  const inner = Array.isArray(children) ? children.join('') : children;
  const a = alt.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return (
    `<svg data-cover="${slug}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${a}" class="block w-full h-auto">` +
    rect({ x: 0, y: 0, w: W, h: H, fill: canvas }) +
    inner +
    `</svg>`
  );
}

/* Deterministic PRNG so a composition is identical across builds. */
export function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- motion helpers ------------------------------------------ */

/* Pin the final keyframe (the rest pose) to the end of the loop. The last
   frame you pass must sit at or before REST_AT and must equal the still. */
export function hold(frames: Keyframe[]): Keyframe[] {
  const last = frames[frames.length - 1];
  const rest: Keyframe = { ...last, offset: 1 };
  delete rest.easing;
  if ((last.offset as number) < REST_AT) {
    const atRest: Keyframe = { ...last, offset: REST_AT };
    delete atRest.easing;
    return [...frames, atRest, rest];
  }
  return [...frames, rest];
}

/* Start an infinite loop on the document timeline so every element in a
   cover, and every cover on a page, shares one clock. */
export function loop(el: Element, frames: Keyframe[]): Animation {
  const a = el.animate(frames, { duration: PERIOD, iterations: Infinity });
  a.startTime = 0;
  return a;
}

/* Evenly spaced start offsets for n things between `from` and `to`. */
export function stagger(i: number, n: number, from: number, to: number): number {
  return n <= 1 ? from : from + (i / (n - 1)) * (to - from);
}

export function q<T extends Element>(root: ParentNode, sel: string): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

export const EASE_OUT = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
export const EASE_IN_OUT = 'cubic-bezier(0.45, 0, 0.2, 1)';
export const STEP = 'steps(1, end)';
