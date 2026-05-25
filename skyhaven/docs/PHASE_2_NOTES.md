# Phase 2 — Sim core

## Status

✅ Deterministic 10 Hz tick, Zustand store, save / restore with `.bak`
fallback, starter airline (1 Tier-1 turboprop on 1 short European route),
cash + cash/sec readout in the top bar.

Force-kill acceptance test verified by construction: every state change
schedules a debounced 1s save; `visibilitychange → hidden` and `pagehide`
both call `flushNow()`. On reload, the loader tries the main slot, falls
through to `.bak` on parse failure, then migrates to the current schema.

## What landed

### Engine (`src/engine/`, pure TypeScript, deterministic)

- **`types.ts`** — full `SaveState` schema per BRD §17.2 *plus* the three
  fields I flagged in the plan:
  - `OwnedAircraft.flightHoursAccumulated` (deterministic condition decay)
  - `SaveState.seed` (deterministic random events, Phase 6)
  - Route gets `distanceKm` cached and `legProgress` / `legDirection` for
    the auto-cycling A→B→A→B loop.
- **`tick.ts`** — the pure `tick(state, ctx)` function. Advances every
  active route's leg progress by `dtMs / legDurationMs`. When progress
  crosses 1.0 it credits `legRevenue`, flips direction, and accumulates
  the aircraft's flight hours. Never touches `Date.now` or `Math.random`
  — all time enters via `TickContext`.
- **`economy.ts`** — Phase 2 economy:
  - `legDurationMs = (distanceKm / cruiseSpeed) × 3600 × 1000 / TIME_COMPRESSION`
  - `TIME_COMPRESSION = 120` (one game-hour = 30 real seconds)
  - `legRevenue = capacity × loadFactor × yield × pricingMod × distanceKm × conditionMul − LANDING_FEE`
  - Pricing mods, condition penalty curve (70% / 40% thresholds from BRD §4.2)
  - All constants will move behind Remote Config in Phase 13.
- **`distance.ts`** — haversine. Verified against the known LAX→JFK
  distance (~3,983 km, test allows 3950–4020).
- **`initialState.ts`** — bootstraps a starter airline: one Tier-1
  turboprop, deterministic pick of the shortest valid European hub
  pairing in the airport set (200–1500 km range), pricing balanced,
  load factor 0.6, $25K starting cash.
- **`migrations.ts`** — forward-only schema migration runner; refuses
  saves from a newer schema than the running app supports. The Phase 2
  baseline is `schemaVersion = 1`; the registry is empty until a real
  migration lands.

### State (`src/state/`)

- **`store.ts`** — Zustand store holding the single canonical `SaveState`.
  `applyTick(ctx)` invokes the pure engine function. Narrow selectors
  (`selectCash`, `selectAirlineName`, `selectTailColor`) keep React
  re-renders tight.
- **`persistence.ts`** — `@capacitor/preferences` save / load:
  - Atomic-ish write: `.bak` first, then main slot. If the process dies
    between, recovery reads `.bak`.
  - `createSaveScheduler()` exposes a 1s-debounced `schedule()` and a
    bypass `flushNow()` for the visibility-hidden / pagehide path.
- **`gameLoop.ts`** — owns the `setInterval(100ms)` tick, the visibility
  listener, and the catch-up on resume. The catch-up applies a single
  large-dt tick — Phase 2 economy is linear so this is exact; the analytic
  Web Worker arrives in Phase 9 when condition decay and fuel runout
  introduce nonlinearities.

### UI

- **`TopBar.tsx`** — fixed top bar with the airline wordmark, tail-color
  chip, gold tabular-numeral cash readout, green cash/sec subtext.
- **`format.ts`** — idle-game letter-suffix formatter per BRD §4.1
  (K, M, B, T, Qa…Dc, then aa, ab, …). Tabular numerals applied at the
  call site.
- **`App.tsx`** — boots the game loop on mount, tears it down on unmount.

## Tests

| File | Tests | Covers |
|---|---|---|
| `engine/tick.test.ts` | 6 | Determinism, zero-dt timestamp update, cash monotonicity, 200-small ≈ 1-big tick equivalence, leg-completion credits revenue |
| `engine/distance.test.ts` | 3 | Identity, known LAX→JFK distance, symmetry |
| `engine/migrations.test.ts` | 3 | Current-version passthrough, newer-version rejection, non-object rejection |
| `world/projection.test.ts` | 3 | Corner mapping, invertibility |
| `world/Camera.test.ts` | 4 | Initial fit, clamping, zoom anchor invariance, momentum decay |
| `ui/format.test.ts` | 4 | Sub-1000 raw, K/M/B/T suffixes, alpha roll, negatives |

**Total: 23 / 23 passing.**

## Bundle

| Chunk | Gzipped | Note |
|---|---|---|
| Initial (index) | 78 KB | engine + store + airports.top.json + UI |
| WorldStage (lazy) | 2.5 KB | shrank — airports.top.json moved to main since `initialState` references it |
| PixiJS (lazy) | 135 KB | unchanged |

Still inside BRD §2.7 budgets. The airport data lives in the main chunk
now because the engine boots from it; if this gets uncomfortable we move
the engine bootstrap to a lazy async setup.

## Owner test for Phase 2

Wait for CI to produce the new `skyhaven-debug-apk` on this commit, then
on the Pixel 8 Pro emulator:

1. **Fresh install** — uninstall the previous build first to reset
   `Preferences`. Launch → top bar shows `SKYHAVEN AIRLINES`, starting
   cash `$25K`, and a positive cash/sec rate. The map and pins behave
   as in Phase 1.
2. **Cash accrual** — wait 30 seconds; cash should climb steadily as
   the starter route completes legs.
3. **Force-kill mid-flight** — swipe up the recent-apps view, swipe the
   SkyHaven card away, wait 10 seconds, relaunch. Cash should be
   *higher* than where you left it (the offline catch-up kicked in)
   and the airline state otherwise intact.
4. **Backgrounding** — press Home, wait 30s, return. Cash should
   continue from where it was, advanced by the time you were away.

If any of those fail, grab `adb logcat | grep -i 'skyhaven\|chromium'`.

## Notes for Phase 3

- Cargo/fuel/repair are all stubbed but harmless (fuel reserve 1000,
  no demand, no contracts) — Phase 3 adds the rest of Tier 1–4 plus
  upgrades and condition decay.
- The starter route geometry doesn't yet render as an arc on the map.
  The route-arc layer lands as part of Phase 3 (it's tightly coupled
  to the visual upgrade and only really pays off once players can have
  more than one route).
- Cumulative-earnings tier-unlock gates land in Phase 3 (currently the
  player is locked at Tier 1 by `tierUnlocked: 1`).
