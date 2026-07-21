# 3D Solar System Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the landing-page hero orbital genuinely 3D — tilted camera, perspective, depth cues, mouse sway — per `docs/superpowers/specs/2026-07-16-3d-solar-hero-design.md`.

**Architecture:** The current code already computes full 3D heliocentric positions and discards z. We keep z, log-compress the 3D radial distance (preserving current scale relationships), then project through a camera defined by azimuth (drifting) + elevation (tilt from the ecliptic pole) + a mild perspective divide. Orbit paths are precomputed as compressed 3D point lists and re-projected every frame. Depth cues: perspective size, far-side dimming, painter's-algorithm draw order including the sun. Mouse sway uses a critically-damped spring.

**Tech Stack:** Astro component, vanilla TypeScript in an inline `<script>`, Canvas 2D. No test framework exists in this repo — verification is a node one-off math check plus visual checks in `astro dev` (the spec's own testing section).

## Global Constraints

- Scope: `src/components/Hero.astro` **canvas script block only** — no changes to hero copy, layout, star field, or other components
- Zero new dependencies; Canvas 2D only (no WebGL/Three.js)
- Real planet positions preserved: JPL Keplerian elements (Standish table) evaluated at the real current date — do not alter `PLANETS` data or `keplerE`
- Existing lifecycle untouched: IntersectionObserver pause, `astro:page-load` setup/cleanup, resize handling
- `prefers-reduced-motion: reduce` → single static **tilted** frame, no animation
- Touch devices: drift only, no pointer handlers
- Camera drift: one azimuth revolution ≈ 90 s
- Tilt and perspective strength are single named constants, tuned visually

---

### Task 1: 3D projection core — tilted camera with drift

**Files:**
- Modify: `src/components/Hero.astro` (script block, currently lines 68–229)

**Interfaces:**
- Consumes: existing `PLANETS`, `keplerE`, `rPx`, lifecycle code
- Produces (used by Tasks 2–3):
  - `helioPos(p, jd): [number, number, number]` — heliocentric ecliptic AU, now 3-component
  - `compress(pos: number[]): number[]` — 3D AU → 3D canvas px (log-compressed radial distance)
  - `project(pos: number[], az: number, el: number): [sx, sy, depth, pScale]` — depth > 0 is nearer the camera; `pScale` is the perspective scale factor
  - `camera(now: number): [az, el]` — current camera angles
  - `draw(now: number)` — draw signature changes from `draw(jd)` to `draw(now)` (performance.now()-based timestamp)
  - Constants `TILT`, `CAM_DIST`, `DRIFT_PERIOD`, module-scope `maxR`

- [ ] **Step 1: Make `helioPos` return z**

The x/y rows of the perihelion→node→ecliptic rotation already exist; add the z row (`sinω·sinI·xp + cosω·sinI·yp`). Replace the function body and its comment:

```ts
  // Heliocentric ecliptic [x, y, z] in AU
  function helioPos(p: (typeof PLANETS)[number], jd: number) {
    const T = (jd - 2451545.0) / 36525;
    const a = p.el[0] + p.rate[0] * T, e = p.el[1] + p.rate[1] * T, I = (p.el[2] + p.rate[2] * T) * DEG;
    const L = (p.el[3] + p.rate[3] * T) * DEG, lp = (p.el[4] + p.rate[4] * T) * DEG, node = (p.el[5] + p.rate[5] * T) * DEG;
    const w = lp - node;
    const E = keplerE(L - lp, e);
    const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cn = Math.cos(node), sn = Math.sin(node), ci = Math.cos(I), si = Math.sin(I);
    return [
      (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
      (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
      (sw * si) * xp + (cw * si) * yp,
    ];
  }
```

- [ ] **Step 2: Add camera constants**

Directly below `const SIM_DAYS_PER_SEC = 3; …`:

```ts
  // 3D camera. TILT is elevation from the ecliptic pole (0 = the old
  // top-down view); CAM_DIST is camera distance in units of the outermost
  // orbit radius — smaller means stronger perspective. Both tuned visually.
  const TILT = 58 * DEG;
  const CAM_DIST = 4.5;
  const DRIFT_PERIOD = 90; // seconds per full azimuth revolution
```

- [ ] **Step 3: Replace `toScreen` with `compress` + `project`, add `maxR`**

In `setupSolar()`, change the state line `let W = 0, scale = 1, paths: Path2D[] = [];` to:

```ts
    let W = 0, scale = 1, maxR = 0;
    let orbits: number[][][] = []; // per planet: 121 compressed 3D points, px
```

Keep `rPx` unchanged. Delete `toScreen` and add:

```ts
    // log-compress a 3D heliocentric position (AU) into canvas px,
    // preserving its direction — same radial mapping as the old flat view
    function compress(pos: number[]) {
      const r = Math.hypot(pos[0], pos[1], pos[2]) || 1e-9;
      const s = rPx(r) / r;
      return [pos[0] * s, pos[1] * s, pos[2] * s];
    }

    // Rotate a compressed point by camera azimuth + tilt, then apply a mild
    // perspective divide. Returns [sx, sy, depth, pScale]; depth > 0 is
    // nearer the camera (screen-bottom side of the tilted plane).
    function project(pos: number[], az: number, el: number): [number, number, number, number] {
      const ca = Math.cos(az), sa = Math.sin(az);
      const x = pos[0] * ca - pos[1] * sa;
      const y = pos[0] * sa + pos[1] * ca;
      const ce = Math.cos(el), se = Math.sin(el);
      const yt = y * ce + pos[2] * se; // screen-vertical after tilt
      const d = pos[2] * ce - y * se;  // toward-camera component
      const ps = CAM_DIST / (CAM_DIST - d / (maxR || 1));
      return [W / 2 + x * ps, W / 2 - yt * ps, d, ps];
    }
```

(Sanity: at `el = 0` this reduces exactly to the old top-down view — `yt = y`, and the y-flip on screen is preserved.)

- [ ] **Step 4: Add the camera function**

Below `project`:

```ts
    function camera(now: number): [number, number] {
      const az = reduced ? 0.6 : ((now - t0) / 1000 / DRIFT_PERIOD) * 2 * Math.PI;
      return [az, TILT];
    }
```

(`0.6` rad gives reduced-motion users a fixed, pleasantly asymmetric tilted frame.)

- [ ] **Step 5: Rework `layout` to precompute compressed 3D orbit points**

Replace the `paths = PLANETS.map(…)` block and the trailing `draw(…)` call inside `layout()`:

```ts
    function layout() {
      const dpr = window.devicePixelRatio || 1;
      W = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.width = canvas.height = W;
      scale = W / 420;
      maxR = W * 0.47;
      // orbit paths: one analytic period each, compressed to 3D px points;
      // they get re-projected every frame as the camera drifts
      orbits = PLANETS.map((p) => {
        const period = 365.25 * Math.pow(p.el[0], 1.5);
        const pts: number[][] = [];
        for (let i = 0; i <= 120; i++) pts.push(compress(helioPos(p, jd0 + (i / 120) * period)));
        return pts;
      });
      draw(performance.now());
    }
```

- [ ] **Step 6: Rework `draw` to project through the camera**

`draw` now takes a `now` timestamp (it needs it for the camera) and computes `jd` itself. Orbit strokes and planet positions go through `project`; the sun stays at `[W/2, W/2]` (origin projects to center, `pScale = 1`). Planet draw order/size/alpha unchanged in this task:

```ts
    function draw(now: number) {
      const jd = jd0 + ((now - t0) / 1000) * SIM_DAYS_PER_SEC;
      const [az, el] = camera(now);
      ctx.clearRect(0, 0, W, W);

      ctx.lineWidth = Math.max(0.6, 0.6 * scale);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      for (const pts of orbits) {
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const [sx, sy] = project(pts[i], az, el);
          i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
        }
        ctx.closePath();
        ctx.stroke();
      }

      const cx = W / 2;
      const glow = ctx.createRadialGradient(cx, cx, 0, cx, cx, 46 * scale);
      glow.addColorStop(0, 'rgba(255, 224, 150, 0.75)');
      glow.addColorStop(0.25, 'rgba(255, 190, 90, 0.14)');
      glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cx, 46 * scale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3d0';
      ctx.beginPath(); ctx.arc(cx, cx, 5 * scale, 0, Math.PI * 2); ctx.fill();

      ctx.shadowBlur = 7 * scale;
      for (let i = 0; i < PLANETS.length; i++) {
        const p = PLANETS[i];
        const [sx, sy] = project(compress(helioPos(p, jd)), az, el);
        const r = p.dot * scale;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        if (p.ring) {
          ctx.strokeStyle = 'rgba(227, 207, 155, 0.6)';
          ctx.lineWidth = 0.9 * scale;
          ctx.beginPath(); ctx.ellipse(sx, sy, r * 2.1, r * 0.8, -0.5, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
    }
```

- [ ] **Step 7: Update the loop to pass the rAF timestamp**

```ts
    function loop(now: number) {
      if (!visible) { running = false; return; }
      draw(now);
      raf = requestAnimationFrame(loop);
    }
```

(`requestAnimationFrame` already passes a `performance.now()`-compatible timestamp; `start()` needs no change.)

- [ ] **Step 8: Verify in dev**

Run: `npx astro dev` and open `http://localhost:4321/`.
Expected: hero orbital renders as a tilted 3D scene — orbits are foreshortened ellipses, the whole scene slowly rotates (full revolution ≈ 90 s), planets still glow in their colors, no console errors. Resize the window: canvas re-lays-out without distortion.

- [ ] **Step 9: Commit**

```bash
git add src/components/Hero.astro
git commit -m "Hero: project solar system through a tilted 3D drifting camera"
```

---

### Task 2: Depth cues — perspective size, far-side dimming, occlusion order

**Files:**
- Modify: `src/components/Hero.astro` (the `draw` function from Task 1)

**Interfaces:**
- Consumes: `project` returning `[sx, sy, depth, pScale]`, `compress`, `helioPos`, `maxR`
- Produces: final body-drawing block used unchanged by Task 3

- [ ] **Step 1: Replace the sun + planet drawing section of `draw`**

Everything from `const cx = W / 2;` to the final `ctx.shadowBlur = 0;` inside `draw` becomes:

```ts
      // Depth cues: perspective scale (pScale) sizes the dots ~±25%, planets
      // behind the sun's plane dim slightly, and painter's algorithm —
      // farthest first, sun at depth 0 — lets near planets cross in front
      // of the glow.
      const bodies = PLANETS.map((p) => {
        const [sx, sy, d, ps] = project(compress(helioPos(p, jd)), az, el);
        return { p, sx, sy, d, ps };
      }).concat([{ p: null as (typeof PLANETS)[number] | null, sx: W / 2, sy: W / 2, d: 0, ps: 1 }]);
      bodies.sort((a, b) => a.d - b.d);

      for (const b of bodies) {
        if (!b.p) {
          const cx = W / 2;
          const glow = ctx.createRadialGradient(cx, cx, 0, cx, cx, 46 * scale);
          glow.addColorStop(0, 'rgba(255, 224, 150, 0.75)');
          glow.addColorStop(0.25, 'rgba(255, 190, 90, 0.14)');
          glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(cx, cx, 46 * scale, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff3d0';
          ctx.beginPath(); ctx.arc(cx, cx, 5 * scale, 0, Math.PI * 2); ctx.fill();
          continue;
        }
        const r = b.p.dot * scale * b.ps;
        ctx.globalAlpha = b.d < 0 ? Math.max(0.55, 1 + (0.35 * b.d) / maxR) : 1;
        ctx.shadowBlur = 7 * scale;
        ctx.shadowColor = b.p.color;
        ctx.fillStyle = b.p.color;
        ctx.beginPath(); ctx.arc(b.sx, b.sy, r, 0, Math.PI * 2); ctx.fill();
        if (b.p.ring) {
          ctx.strokeStyle = 'rgba(227, 207, 155, 0.6)';
          ctx.lineWidth = 0.9 * scale;
          ctx.beginPath(); ctx.ellipse(b.sx, b.sy, r * 2.1, r * 0.8, -0.5, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
```

(The spec's optional orbit-line alpha gradient is deliberately skipped — orbit strokes stay uniform per the spec's "otherwise uniform" default. Note the planet loop no longer keeps `shadowBlur` set across iterations; the sun's glow must not inherit a shadow, hence reset inside the loop.)

- [ ] **Step 2: Verify in dev**

Run: `npx astro dev`, open `http://localhost:4321/`.
Expected: planets on the near (lower) side of the tilted plane render slightly larger and pass **in front of** the sun's glow; far-side planets are slightly smaller and dimmer, passing behind. Watch Mercury (~30 s per lap) do a full circuit to confirm both states. No flicker in draw order.

- [ ] **Step 3: Commit**

```bash
git add src/components/Hero.astro
git commit -m "Hero: depth cues — perspective size, far-side dimming, painter's order"
```

---

### Task 3: Mouse tilt with critically-damped easing

**Files:**
- Modify: `src/components/Hero.astro` (script block: `setupSolar` state, `camera`, `loop`, listeners, cleanup)

**Interfaces:**
- Consumes: `camera(now)` and `loop(now)` from Task 1
- Produces: `sway` spring state `{ az: {p,v,t}, el: {p,v,t} }`, `damp(s, dt)`, hover-gated `onMove`/`onLeave` listeners

- [ ] **Step 1: Add sway constants**

Below `DRIFT_PERIOD` at module scope:

```ts
  const SWAY = 5 * DEG;  // max mouse-tilt deflection
  const SPRING = 4;      // critically-damped spring rate, 1/s
```

- [ ] **Step 2: Add spring state and hover gate in `setupSolar`**

Below the `reduced` line:

```ts
    const hoverFine = matchMedia('(hover: hover) and (pointer: fine)').matches;
```

Below the `let raf = 0, …` line:

```ts
    // mouse sway: two critically-damped springs (position, velocity, target)
    const sway = {
      az: { p: 0, v: 0, t: 0 },
      el: { p: 0, v: 0, t: 0 },
    };
    let lastT = t0;

    function damp(s: { p: number; v: number; t: number }, dt: number) {
      const x = s.p - s.t, tmp = (s.v + SPRING * x) * dt, decay = Math.exp(-SPRING * dt);
      s.p = s.t + (x + tmp) * decay;
      s.v = (s.v - SPRING * tmp) * decay;
    }
```

- [ ] **Step 3: Fold sway into `camera`**

```ts
    function camera(now: number): [number, number] {
      const az = (reduced ? 0.6 : ((now - t0) / 1000 / DRIFT_PERIOD) * 2 * Math.PI) + sway.az.p;
      return [az, TILT + sway.el.p];
    }
```

- [ ] **Step 4: Advance the springs in `loop`**

```ts
    function loop(now: number) {
      if (!visible) { running = false; return; }
      const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
      lastT = now;
      damp(sway.az, dt);
      damp(sway.el, dt);
      draw(now);
      raf = requestAnimationFrame(loop);
    }
```

And in `start()`, reset the clock so a pause offscreen doesn't produce a giant dt:

```ts
    function start() {
      if (running || reduced) return;
      running = true;
      lastT = performance.now();
      raf = requestAnimationFrame(loop);
    }
```

- [ ] **Step 5: Attach hover-gated listeners on the hero section**

Between `io.observe(canvas);` and `addEventListener('resize', layout);`:

```ts
    // Mouse tilt: ease the camera a few degrees toward the cursor anywhere
    // over the hero. Hover-gated — touch devices keep drift only.
    const hero = canvas.closest('section');
    function onMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      sway.az.t = (((e.clientX - rect.left) / rect.width) * 2 - 1) * SWAY;
      sway.el.t = (((e.clientY - rect.top) / rect.height) * 2 - 1) * SWAY;
    }
    function onLeave() { sway.az.t = 0; sway.el.t = 0; }
    if (hoverFine && !reduced && hero) {
      hero.addEventListener('mousemove', onMove);
      hero.addEventListener('mouseleave', onLeave);
    }
```

- [ ] **Step 6: Extend cleanup**

```ts
    cleanup = () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', layout);
      if (hero) {
        hero.removeEventListener('mousemove', onMove);
        hero.removeEventListener('mouseleave', onLeave);
      }
      io.disconnect();
    };
```

- [ ] **Step 7: Verify in dev**

Run: `npx astro dev`, open `http://localhost:4321/`.
Expected: moving the mouse over the hero tilts the scene a few degrees toward the cursor, smoothly with no snap or overshoot; leaving the hero eases it back. DevTools device emulation (touch): no tilt, drift only. DevTools rendering → emulate `prefers-reduced-motion: reduce`, reload: a single static tilted frame, no animation.

- [ ] **Step 8: Commit**

```bash
git add src/components/Hero.astro
git commit -m "Hero: mouse tilt with critically-damped easing, hover-gated"
```

---

### Task 4: Verification — ephemeris sanity check + full visual pass

**Files:**
- Create (scratchpad only, not committed): `<scratchpad>/earth-longitude-check.mjs`

**Interfaces:**
- Consumes: the `helioPos` math (replicated standalone) — verifies Earth's heliocentric ecliptic longitude for today against a published ephemeris

- [ ] **Step 1: Write the standalone ephemeris check**

```js
// earth-longitude-check.mjs — replicate Hero.astro's math for Earth, today
const el = [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0];
const rate = [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0];
const DEG = Math.PI / 180;
const jd = Date.now() / 86400000 + 2440587.5;
const T = (jd - 2451545.0) / 36525;
const a = el[0] + rate[0] * T, e = el[1] + rate[1] * T, I = (el[2] + rate[2] * T) * DEG;
const L = (el[3] + rate[3] * T) * DEG, lp = (el[4] + rate[4] * T) * DEG, node = (el[5] + rate[5] * T) * DEG;
const w = lp - node;
let M = ((L - lp) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
let E = M;
for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
const cw = Math.cos(w), sw = Math.sin(w), cn = Math.cos(node), sn = Math.sin(node), ci = Math.cos(I), si = Math.sin(I);
const x = (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp;
const y = (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp;
const z = (sw * si) * xp + (cw * si) * yp;
const lon = ((Math.atan2(y, x) / DEG) + 360) % 360;
console.log(`Earth heliocentric longitude: ${lon.toFixed(2)}° | z: ${z.toExponential(2)} AU | r: ${Math.hypot(x, y, z).toFixed(4)} AU`);
```

- [ ] **Step 2: Run it and check against a published value**

Run: `node <scratchpad>/earth-longitude-check.mjs`
Expected for 2026-07-21: longitude ≈ **298–299°** (Earth's heliocentric longitude = Sun's geocentric longitude + 180°; the Sun is at ~118.5° in late July). `z` must be tiny (≲ 1e-4 AU — Earth defines the ecliptic), `r` ≈ 1.016 AU (near aphelion). If longitude is off by more than ~1°, the z-row edit broke the rotation — stop and re-check Task 1 Step 1.

- [ ] **Step 3: Full visual checklist in dev**

Run: `npx astro dev`, open `http://localhost:4321/`. Verify every item from the spec's testing section:

- default drift animation (smooth, ~90 s revolution)
- mouse-tilt response and smoothing (no snap, eases back on leave)
- reduced-motion static tilted frame (DevTools rendering emulation)
- mobile viewport (DevTools device emulation — drift only)
- planets crowd acceptably under perspective; if inner planets clump, tune `TILT` down toward 50° and/or raise `CAM_DIST` toward 6 and re-check
- scroll the hero offscreen and back: animation pauses/resumes (IntersectionObserver intact)
- navigate to another page and back (`astro:page-load` re-setup, no double listeners)

- [ ] **Step 4: Build check**

Run: `npx astro build`
Expected: build succeeds with no TypeScript errors in the script block.

- [ ] **Step 5: Final commit (only if tuning changed constants)**

```bash
git add src/components/Hero.astro
git commit -m "Hero: tune 3D camera constants after visual pass"
```
