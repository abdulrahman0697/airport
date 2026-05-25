# Phase 4 — Fuel supply chain

## Status

✅ Three-quantity fuel model (demand / supply / reserve), strict route
gating, 8-tier fuel contracts + 8-tier capacity upgrades, HUD gauge,
Fuel/Supply panel, reserve evolution wired into the deterministic tick.

Acceptance target per BRD §19 row 4: expansion correctly gated by fuel
headroom. Verified via tests + on-device — opening a route that would
push demand past supply now throws `FUEL_LIMIT` and the UI surfaces the
shortfall.

## What landed

### Data

- **`data/fuelContracts.ts`** — 8 contract tiers, starter free, costs
  growing ~5–6× per tier; supply rates target whole-fleet burn at the
  relevant fleet tier.
- **`data/fuelCapacity.ts`** — 8 capacity tiers (Lv0 free, 1.5K → 2.5M
  fuel ceiling), helper `nextCapacityTier()` resolves the upgrade target
  from the current absolute value.

### Engine (pure)

- **`engine/fuel.ts`** — `aircraftBurnRate` (per real-second, with Fuel
  Eff applied), `totalDemand` (sum across assigned + alive fleet),
  `hasFuelHeadroom`, `withRecomputedDemand` (idempotent helper called
  by every action that changes which aircraft fly).
- **`engine/actions.ts`** — strict gate added to `openRoute`. Two new
  actions: `signFuelContract` (one-time cost, supply +=) and
  `upgradeFuelCapacity` (jumps to next tier). `closeRoute`, `sellAircraft`,
  and `applyUpgrade('fuelEff')` recompute demand after the mutation.
- **`engine/tick.ts`** — reserve evolves as
  `reserve += (supply − demand) × dt`, clamped to `[0, capacity]`. When
  reserve is empty *and* demand > supply, the entire fleet is treated as
  fuel-starved and earns nothing this tick. Under strict gating this
  only happens during Phase 6 fuel-price events.
- **`engine/initialState.ts`** — bootstraps the free starter contract
  (15 fuel/s), Lv0 capacity (1,500), reserve full.

### State

- **`state/store.ts`** — `signFuelContract(id)` and `upgradeFuelCapacity()`
  added with the same `ActionResult` envelope.

### UI

- **`ui/components/FuelGauge.tsx`** — floating right-side HUD pill. Shows
  reserve fill (vertical bar), net rate (color-coded: cyan filling,
  amber draining, red empty), and the raw fuel number. Tap → opens
  the Fuel panel. Smooth-lerps the displayed reserve so the bar doesn't
  jitter.
- **`ui/panels/FuelPanel.tsx`** — status card (reserve / capacity, net
  rate, supply vs demand, progress bar), full contract list with signed
  / available / affordability states, capacity upgrade card.

## Tests

| File | Tests |
|---|---|
| `engine/fuel.test.ts` | 12 — burn rate, total demand, fuelEff effect, zero-condition exclusion, strict gate blocks + allows after contract, sign + dedup, capacity upgrade, reserve fills toward capacity, grounded when empty+deficit, capacity cap, closeRoute recomputes demand |
| (Phases 0–3 carry-over) | 60 |

**Total: 72 / 72 passing.**

## Bundle

| Chunk | Gzipped | Note |
|---|---|---|
| `index` (main) | 137 KB | +2 KB for fuel data + engine + gauge |
| `FuelPanel` (lazy) | 1.7 KB | first opened |
| Others | unchanged | |

## Owner test for Phase 4

Wait ~3-5 min for CI on this commit, **uninstall the previous build**
(schema is unchanged but the seeded fuel state is new for fresh installs).

1. **HUD gauge** — fixed pill on the right under the top bar. Shows
   reserve bar (~100% on a fresh save), net rate (positive cyan), and
   a fuel count.
2. **Tap the gauge** → Fuel panel slides up. Status card shows reserve
   filling toward the 1,500 ceiling, supply 15.0/s, demand around 9/s
   (the starter turboprop's burn).
3. **Try to open a second route** without buying a contract — buy a
   second T1 aircraft, go to Routes → + New Route → select it. When
   you confirm, the action should error with **"Need X more fuel/sec
   — secure a new contract first"** (this is the strict gate).
4. **Sign a contract** — back to the Fuel panel, sign the **Local
   Refinery** ($8K, +30 fuel/s). Supply jumps to 45/s.
5. **Now open the route** — the second aircraft's route opens cleanly.
   Demand on the Fuel panel climbs to ~20/s. Reserve continues to fill.
6. **Capacity upgrade** — tap "Upgrade capacity" for Tier 1 ($3.5K) →
   ceiling jumps to 4,000.
7. **Fuel Eff upgrade** — go to Fleet → an active aircraft → buy Fuel
   Eff I. The Fuel panel's demand line should drop noticeably.

If anything misbehaves, `adb logcat | grep -i 'skyhaven\|chromium'`.

## Notes for Phase 5

- Fuel-price events (BRD §4.12) lay dormant — the math already supports
  draining reserves, but no event source flips the dial yet. Phase 6
  wires the event scheduler.
- Emergency rewarded-ad refill (BRD §4.6) waits for the ad SDK in
  Phase 15.
- Offline catch-up for fuel: under strict gating, supply ≥ demand always
  in normal play, so reserve only fills. The single-big-dt catch-up tick
  remains exact. When Phase 6 events introduce negative net rates, we'll
  need the analytic two-piece path; tests are pre-written for that case
  (grounding behaviour is already verified).
- HUD gauge tap-target is 44×40; minor accessibility nudge in Phase 16
  to reach the WCAG-AA 44×44 floor if we don't already.
