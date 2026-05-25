# Phase 1 — World layer

## Status

✅ Pixi world renders with 500 airport pins, pan / pinch / wheel zoom with
momentum, parallax cloud layer, FPS HUD, WebGL context-loss recovery.

## What landed

- **Airport dataset pipeline** (`scripts/build-airports.mjs`) — derives
  `airports.top.json` (500, bundled in the WorldStage lazy chunk) and
  `airports.full.json` (3,947, dynamic-imported on demand) from the
  OurAirports CC0 source. Distribution across the 9 BRD regions:
  `NA 51, LATAM 59, EU 129, ME 38, AF 84, S.Asia 43, E.Asia 48, SE.Asia 35, Oceania 13`.
  The raw CSV is gitignored; the licence is recorded in `scripts/data/LICENSES.md`.
- **Projection** (`src/world/projection.ts`) — equirectangular plate-carrée
  into a 4096×2048 virtual world. Trivially invertible (unit-tested).
- **Camera** (`src/world/Camera.ts`) — pan / zoom in screen space, fitted
  initial view, clamping so the viewport never leaves the world, momentum
  decay (`exp(-4.5 · dt)`), pinch-zoom anchored at the gesture midpoint.
  Unit-tested for clamping, anchor preservation, and momentum convergence.
- **Basemap** (`src/world/Basemap.ts`) — Phase 1 placeholder: deep-navy
  ground, 30° graticule, equator/meridian accent, soft equatorial vignette.
  Stylised night-Earth land/ocean shapes arrive in Phase 10.
- **Airport pins** (`src/world/AirportPins.ts`) — single batched Graphics
  with a halo + core per pin; styling encodes size tier (color, radius,
  alpha). 500 pins = 1,000 draw primitives, GPU-trivial.
- **Cloud layer** (`src/world/Clouds.ts`) — deterministic xorshift-seeded
  cloud puffs drifting east, parented to a parallax-factor 0.55 container.
- **WorldStage** (`src/world/WorldStage.ts`) — orchestrator. Owns the
  Pixi `Application`, ResizeObserver, pointer/wheel/pinch input, ticker
  loop, and `webglcontextlost`/`restored` handlers (BRD §2.6, §14).
  Honours `prefers-reduced-motion` (no momentum, no cloud drift).
- **React mount** (`src/ui/components/WorldView.tsx`) — lazy-imports the
  Pixi module so PixiJS only ships when the map is needed. FPS badge in
  the corner, error overlay if init fails.
- **Top bar** placeholder (`src/ui/App.tsx`) — wordmark + subtitle,
  `pointer-events: none` so taps fall through to the map.

## Bundle profile

| Chunk | Size | Gzipped | Notes |
|---|---|---|---|
| `index.html` | 2.6 KB | 1.2 KB | pre-React watchdog inline |
| `react` | 11.7 KB | 4.2 KB | React 19 runtime |
| `index` (app shell) | 186 KB | 59 KB | UI + ErrorBoundary + data accessors |
| `WorldStage` (lazy) | 66 KB | 15 KB | basemap + camera + pins + clouds + top-500 airports |
| `pixi` (lazy) | 474 KB | 135 KB | PixiJS 8 — only loaded when the map mounts |

Initial transfer at first paint (before WorldView lazy-import) ≈ 64 KB
gzipped. Well under the BRD §2.7 1 MB budget.

## Tests

- `tick.test.ts` — engine constants (1)
- `projection.test.ts` — corner mapping, invertibility (3)
- `Camera.test.ts` — clamping, zoom anchor invariance, momentum decay (4)

Total: **8 / 8 passing**.

## Owner test for Phase 1

1. Pull `claude/affectionate-bell-aXP0U`, wait for CI to produce the new
   `skyhaven-debug-apk` artifact (commit will be `Phase 1: world layer`).
2. Drag-drop the APK onto the Pixel 8 Pro emulator, launch SkyHaven.
3. **Verify:**
   - The map is visible immediately under a dark navy background.
   - 500 cyan/gold pins are scattered across the world, denser in
     Europe / North America / East Asia.
   - Drag the map — it pans smoothly and flicks with momentum.
   - Pinch — it zooms about the pinch centre (or use `Ctrl+scroll`
     in the emulator).
   - The FPS badge in the top-right reads close to 60.
   - Toggle airplane mode on the emulator — the map still works.
4. **Reduced-motion check** — enable "Remove animations" in the
   emulator's accessibility settings, relaunch — momentum and cloud
   drift should stop; pan/zoom still work but feel direct.

## Notes for Phase 2

- The world layer publishes nothing to the engine yet. Phase 2 lands
  the deterministic sim store; we'll add a `routeArcs` and an
  `activeAircraft` layer to WorldStage that subscribes to the engine.
- Oceania has only 13 pins because OurAirports has few large_airports
  with scheduled service there. When Phase 5 makes regions mechanically
  active we'll widen Oceania's size-tier threshold to top it up.
- The placeholder basemap is intentionally flat. Phase 10's living-map
  upgrade (day/night terminator, twinkling city lights, ambient NPC
  traffic) is a drop-in replacement for `Basemap.ts`.
