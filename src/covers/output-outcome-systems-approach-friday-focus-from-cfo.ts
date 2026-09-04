/* FIG. 31 · SUCCESS, REPEATABLE
   Centre, a solid cream circle. Above it a short row of five small
   squares, the head of the row feeding the circle by a single hairline.
   Enclosing both, a large outlined ring with one small solid marker
   resting at its top: the engine.

   Motion: the marker travels the ring clockwise, three laps in the
   motion window (about 4 s a lap, so the rest fifth holds). Each time it
   passes the top, the head square drops down the hairline into the
   circle, which pulses once; the row shifts along and a fresh square
   steps in at the tail. Rest: the marker at twelve, five squares in the
   row. Three squares that have dropped are drawn at opacity 0; the row
   at rest is two of the original squares and three fresh ones. */
import {
  type Cover, CREAM, CREAM_DIM, ASH, ASH_DIM, EASE_IN_OUT, EASE_OUT,
  svg, circle, line, square, g, figMark, captionBlock, hold, loop, q,
} from './_lib.ts';

const C = { x: 1200, y: 690 };        // ring centre
const RING_R = 430;
const CORE = { x: 1200, y: 800, r: 130 };
const ROW_Y = 480, ROW_X0 = 1200, PITCH = 84, SZ = 46;   // slot 0 is the head, over the hairline
const SLOTS = 5;
const DROP = CORE.y - ROW_Y;          // the head square falls to the circle's centre
const MARKER_R = 22;

const cover: Cover = {
  slug: 'output-outcome-systems-approach-friday-focus-from-cfo',
  fig: '31',
  caption: 'SUCCESS, REPEATABLE',

  still(alt) {
    const slotX = (i: number) => ROW_X0 + i * PITCH;
    // The five squares at rest: originals 3 and 4 sit in slots 0 and 1,
    // fresh squares 1..3 in slots 2..4. Each carries its starting slot and
    // the lap it appears on (0 = from the start).
    const row = [
      square({ cx: slotX(0), cy: ROW_Y, s: SZ, fill: CREAM, 'data-sq': '', 'data-from': 3, 'data-born': 0 }),
      square({ cx: slotX(1), cy: ROW_Y, s: SZ, fill: CREAM, 'data-sq': '', 'data-from': 4, 'data-born': 0 }),
      square({ cx: slotX(2), cy: ROW_Y, s: SZ, fill: CREAM, 'data-sq': '', 'data-from': 4, 'data-born': 1 }),
      square({ cx: slotX(3), cy: ROW_Y, s: SZ, fill: CREAM, 'data-sq': '', 'data-born': 2, 'data-from': 4 }),
      square({ cx: slotX(4), cy: ROW_Y, s: SZ, fill: CREAM, 'data-sq': '', 'data-born': 3, 'data-from': 4 }),
    ];
    // Originals 0..2 start in slots 0..2 and drop on laps 1..3. At rest
    // they are gone, drawn at the head slot with opacity 0.
    const dropped = [0, 1, 2].map((i) =>
      square({ cx: slotX(0), cy: ROW_Y, s: SZ, fill: CREAM, opacity: 0, 'data-drop': i }));

    return svg(cover.slug, alt, [
      figMark(cover.fig),
      circle({ cx: C.x, cy: C.y, r: RING_R, fill: 'none', stroke: ASH, 'stroke-width': 2 }),
      line({ x1: ROW_X0, y1: ROW_Y + SZ / 2, x2: CORE.x, y2: CORE.y - CORE.r, stroke: ASH_DIM, 'stroke-width': 2 }),
      circle({ cx: CORE.x, cy: CORE.y, r: CORE.r, fill: CREAM, 'data-core': '' }),
      g(row),
      g(dropped),
      g(circle({ cx: C.x, cy: C.y - RING_R, r: MARKER_R, fill: CREAM_DIM }), { 'data-marker': '' }),
      captionBlock(cover.caption),
    ]);
  },

  motion(root) {
    const anims: Animation[] = [];
    const LAPS = 3;
    const LAP = 0.22;                        // 3.96 s a lap; the third drop settles by 0.78
    const topAt = (lap: number) => lap * LAP;  // marker crosses twelve at the end of each lap
    const SHIFT = 0.06;                      // how long a shift or drop takes

    const marker = root.querySelector<SVGGElement>('[data-marker]');
    if (marker) {
      marker.setAttribute('style', `transform-box: view-box; transform-origin: ${C.x}px ${C.y}px`);
      // Three full turns end at the same pose as the still.
      anims.push(loop(marker, hold([
        { offset: 0, transform: 'rotate(0deg)', easing: 'linear' },
        { offset: LAPS * LAP, transform: `rotate(${360 * LAPS}deg)` },
      ])));
    }

    const core = root.querySelector<SVGCircleElement>('[data-core]');
    if (core) {
      core.setAttribute('style', `transform-box: view-box; transform-origin: ${CORE.x}px ${CORE.y}px`);
      const frames: Keyframe[] = [{ offset: 0, transform: 'scale(1)' }];
      for (let lap = 1; lap <= LAPS; lap++) {
        const t = topAt(lap) + SHIFT;          // the square arrives
        frames.push({ offset: t, transform: 'scale(1)', easing: EASE_OUT });
        frames.push({ offset: t + 0.02, transform: 'scale(1.07)', easing: EASE_IN_OUT });
        frames.push({ offset: t + 0.06, transform: 'scale(1)' });
      }
      anims.push(loop(core, hold(frames)));
    }

    // Squares that survive to the rest pose: slide one slot left on each
    // lap after they are born, arriving at their resting slot.
    q<SVGRectElement>(root, '[data-sq]').forEach((el) => {
      const from = Number(el.dataset.from);
      const born = Number(el.dataset.born);
      const restSlot = Math.round((Number(el.getAttribute('x')) + SZ / 2 - ROW_X0) / PITCH);
      const frames: Keyframe[] = [];
      let slot = from;
      const dx = (s: number) => `translateX(${(s - restSlot) * PITCH}px)`;
      if (born === 0) {
        frames.push({ offset: 0, transform: dx(slot), opacity: 1 });
      } else {
        frames.push({ offset: 0, transform: dx(slot), opacity: 0 });
        frames.push({ offset: topAt(born) + SHIFT, transform: dx(slot), opacity: 0, easing: EASE_OUT });
        frames.push({ offset: topAt(born) + SHIFT * 2, transform: dx(slot), opacity: 1 });
      }
      for (let lap = born + 1; lap <= LAPS; lap++) {
        frames.push({ offset: topAt(lap), transform: dx(slot), opacity: 1, easing: EASE_IN_OUT });
        slot -= 1;
        frames.push({ offset: topAt(lap) + SHIFT, transform: dx(slot), opacity: 1 });
      }
      anims.push(loop(el, hold(frames)));
    });

    // Squares that drop: start in slot i, shift left each lap, then fall
    // down the hairline into the circle on lap i + 1 and vanish.
    q<SVGRectElement>(root, '[data-drop]').forEach((el) => {
      const i = Number(el.dataset.drop);
      const frames: Keyframe[] = [{ offset: 0, transform: `translate(${i * PITCH}px, 0px)`, opacity: 1 }];
      let slot = i;
      for (let lap = 1; lap <= i; lap++) {
        frames.push({ offset: topAt(lap), transform: `translate(${slot * PITCH}px, 0px)`, opacity: 1, easing: EASE_IN_OUT });
        slot -= 1;
        frames.push({ offset: topAt(lap) + SHIFT, transform: `translate(${slot * PITCH}px, 0px)`, opacity: 1 });
      }
      const fall = topAt(i + 1);
      frames.push({ offset: fall, transform: 'translate(0px, 0px)', opacity: 1, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)' });
      // cream on cream: once inside the circle the square is invisible, so
      // the fade to 0 is not seen.
      frames.push({ offset: fall + SHIFT, transform: `translate(0px, ${DROP}px)`, opacity: 1 });
      frames.push({ offset: fall + SHIFT + 0.01, transform: `translate(0px, ${DROP}px)`, opacity: 0 });
      anims.push(loop(el, hold(frames)));
    });
    return anims;
  },
};

export default cover;
