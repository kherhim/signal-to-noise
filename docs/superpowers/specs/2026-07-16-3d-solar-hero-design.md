# 3D Solar System Hero — Design

**Date:** 2026-07-16
**Status:** Approved
**Scope:** `src/components/Hero.astro` (canvas script block only)

## Goal

Make the landing-page hero orbital genuinely three-dimensional while keeping
everything that makes it special: real planets at their real current positions
(JPL Keplerian elements, Standish table), canvas 2D rendering, zero new
dependencies, near-zero payload change.

The rest of the page — star field, layout, copy — is unchanged.

## Concept

The current implementation computes full 3D heliocentric positions and then
drops the z-coordinate to draw a flat top-down view. This design keeps z and
projects the scene through a simple 3D camera tilted ~55–65° from the ecliptic
pole. Orbits render as foreshortened ellipses; planets genuinely pass in front
of and behind the sun.

## Projection

- `helioPos()` returns full `[x, y, z]`. The ecliptic-inclination rotation
  terms already exist in the code; only the z row is currently discarded.
- The existing log-radius compression (fits Mercury–Neptune on one canvas)
  is applied to the 3D position's radial distance **before** projection,
  preserving the current scale relationships.
- A camera transform rotates the world by azimuth θ (drift) and elevation φ
  (tilt), then applies a mild perspective divide. Tilt angle and perspective
  strength are two named constants, tuned visually.
- Orbit paths are sampled through the same projection (8 planets × 120
  points). Because azimuth changes each frame, paths are rebuilt whenever the
  camera moves — trivial cost at this point count.

## Depth cues

1. **Size:** planet dot radius scales ~±25% with distance from camera.
2. **Brightness:** alpha falls slightly for planets on the far side of the
   sun's plane.
3. **Occlusion:** painter's algorithm — draw farthest-first so near planets
   pass in front of the sun's glow.
4. **(Optional)** orbit-line alpha gradient, nearer arc slightly brighter;
   keep only if it reads well, otherwise uniform.

## Camera & interaction

- **Drift:** azimuth advances continuously, one revolution ≈ 90 s.
- **Mouse tilt:** pointer movement over the hero eases elevation/azimuth a
  few degrees toward the cursor with critically-damped smoothing (no snap).
- **Touch devices:** drift only.
- **`prefers-reduced-motion`:** a single static tilted frame, matching the
  current static-fallback behavior.
- Existing lifecycle is untouched: IntersectionObserver pause when offscreen,
  `astro:page-load` setup/cleanup, resize handling.

## Performance & risk

- Still one canvas, one rAF loop, ~9 bodies; added math is a handful of
  sin/cos per planet per frame. No measurable payload change.
- **Main visual risk:** log-compressed radii may look odd under perspective
  (inner planets crowding). Mitigation: tune the tilt-angle and
  perspective-strength constants; both are single numbers.

## Testing

Visual verification in `astro dev`:

- default drift animation
- mouse-tilt response and smoothing
- reduced-motion static frame
- mobile viewport (drift only, no pointer handlers firing)
- sanity check that planet positions still match reality (e.g. Earth's
  heliocentric longitude for today's date against a published ephemeris)

## Out of scope

- Star-field parallax or any depth treatment outside the hero canvas
- WebGL / Three.js
- Changes to hero copy, layout, or other components
