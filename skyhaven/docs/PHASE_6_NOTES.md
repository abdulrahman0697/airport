# Phase 6 — Crew, events, roaming collectibles

## Status

✅ Six managers per hub with hub-scoped effects, three live events
(deterministically scheduled and applied to revenue + load + fuel),
roaming collectibles drifting on the map with tap-to-claim.

Acceptance per BRD §19 row 6 — **"Logistics Director cuts hub fuel
use 25%"** — verified by a test on the demand-recompute path.

## What landed

### Data

- **`data/managers.ts`** — 6 manager defs (Hub Director, Maintenance
  Chief, Logistics Director, Fleet Engineer, Marketing Lead, Crisis
  Manager) with original flavour bios. `managerCost(kind, hubLevel)`
  = `baseCost × hub.level`.
- **`data/events.ts`** — 3 event defs: Tourism Boom (regional revenue
  +25%, 3 min), Holiday Rush (global load +20%, 2 min), Fuel Price
  Spike (supply ×0.7, 90 s, mitigated by Crisis Manager).

### Engine (pure, deterministic)

- **Schema v2** — `activeEvents`, `collectibles`, `nextEventCheckMs`,
  `nextCollectibleSpawnMs` added to `SaveState`. Migration v1→v2 in
  `migrations.ts` defaults them to empty arrays / 0.
- **`engine/managers.ts`** — effect helpers:
  - `LOGISTICS_DIRECTOR_FUEL_MULT = 0.75`
  - `MARKETING_LEAD_LOAD_BONUS = 0.05`
  - `CRISIS_MANAGER_MITIGATION = 0.5` (halves negative-event impact)
  - `MAINTENANCE_CHIEF_THRESHOLD = 50` (% condition trigger)
  - `routeHasMarketingLead(...)`, `routeHasCrisisManager(...)`,
    `aircraftHasLogisticsDirector(...)` — pure boolean checks
- **`engine/events.ts`** — deterministic xorshift `nextSeed`, `rollEvent`
  (40% spawn chance per check window), `expireEvents`,
  `routeRevenueEventMultiplier`, `routeLoadFactorEventBonus`,
  `fuelSupplyEventMultiplier`. Crisis Manager mitigation applied per-
  route in the consumer, so a single spike can affect different routes
  differently depending on which hubs have one.
- **`engine/fuel.ts`** — `aircraftBurnRate` is now manager-agnostic;
  `aircraftEffectiveBurn` applies the Logistics Director's 25% cut.
  `totalDemand` uses the effective rate. The strict gate (`openRoute`)
  now uses the effective rate too, so a Logistics Director makes
  previously-blocked routes openable.
- **`engine/economy.ts`** — new `effectiveLoadFactor(route, hubs, events)`
  applies Marketing Lead + event load bonus. `legRevenue` multiplies
  by the event revenue modifier. `cashPerSecond` likewise.
- **`engine/actions.ts`** — `hireManager(iata, kind)` and
  `claimCollectible(id)` actions. Manager hiring recomputes demand
  when Logistics Director changes status.
- **`engine/tick.ts`** — schedules event rolls, expires old events,
  spawns / expires collectibles, applies event fuel multiplier to the
  supply rate during reserve evolution, runs Maintenance Chief
  auto-repair after route advancement (any hub aircraft below 50%
  gets a one-shot heal if cash permits).

### State

- Store gains `hireManager`, `claimCollectible`, plus
  `selectActiveEvents`, `selectCollectibles`.

### World layer

- **`world/Collectibles.ts`** — Pixi container that diffs by ID, with
  a per-tier baked icon (cash gold + fuel cyan). Sprites are
  `eventMode: 'static'` so Pixi delivers pointer taps. Pulse animation
  driven by the world ticker.
- **`world/WorldStage.ts`** — registers the collectibles layer between
  pins and the foreground; exposes `setCollectibles()` and
  `setCollectibleTapHandler()`.
- **`ui/components/WorldView.tsx`** — pushes the collectible list into
  the stage on every state change; tap handler dispatches the
  `claimCollectible` action.

### UI

- **`ui/panels/CrewPanel.tsx`** — per-hub blocks listing all six
  managers with bio + tagline + cost + Hire CTA. Hired managers carry
  a green pill. Empty state when no hubs yet.
- **`ui/components/EventBanner.tsx`** — fixed banner under the top bar.
  Stacks active events vertically, colour-coded positive (cyan) /
  negative (amber), with a region pill for regional events and a
  per-second countdown.
- **`PanelHost`** — Crew tab now wired to the real panel (was
  "Coming soon"). Store remains a stub.

## Tests

| File | Tests |
|---|---|
| `engine/managers.test.ts` | 6 — hire gates, double-hire refusal, cost × hub.level, **Logistics Director's 25% cut on hub aircraft**, no leak to non-hub routes, Marketing Lead load bonus math |
| `engine/migrations.test.ts` | +1 — v1→v2 migration defaults new fields |
| (Phases 0–5 carry-over) | 85 |

**Total: 92 / 92 passing.**

## Bundle

| Chunk | Gzipped | Delta |
|---|---|---|
| `index` (main) | 141 KB | +3 KB (managers + events engine, EventBanner) |
| `CrewPanel` (lazy) | 1.4 KB | new |
| `WorldStage` (lazy) | 4.5 KB | +0.6 KB (collectibles layer) |
| Others | unchanged | |

## Owner test for Phase 6

Wait ~3-5 min for CI on this commit. **You can keep your existing
save** — the v1→v2 migration upgrades it cleanly. New fields default
to empty / 0; the next tick fires the first event roll a minute later.
If you'd rather start fresh, uninstall first.

1. **Crew tab** — tap Crew in the bottom nav. If you have no hubs yet,
   you'll see the empty state pointing you back to Network → Hubs.
   Promote an airport to a hub (Network → Hubs → Promote), then Crew
   shows that hub's six manager cards.
2. **Hire Logistics Director** — should cost $40K × hub.level. After
   hiring, open the Fuel panel — **demand drops ~25%** for any aircraft
   on routes touching the hub. This is the BRD acceptance.
3. **Hire Marketing Lead** — load factor on touching routes goes up
   ~5% (visible in the Routes tab's load % readout). Cash/sec ticks up
   correspondingly.
4. **Maintenance Chief** — leave an aircraft on a hub route to degrade
   below 50% condition. The tick auto-repairs it (you'll see condition
   snap back to 100% and a cash deduction in the rolling counter).
5. **Wait ~60-120 seconds** — a Tourism Boom / Holiday Rush / Fuel
   Price Spike event spawns. A banner slides in under the top bar
   with the event name, region (if regional), description, and a
   per-second countdown.
6. **Fuel price spike** — supply rate drops in the Fuel panel; if you
   have a Crisis Manager at a relevant hub, the route-level impact
   should be halved (visible only in revenue math; HUD doesn't yet
   show per-event mitigation).
7. **Roaming collectibles** — every ~90 seconds a cyan or gold orb
   spawns near a random airport in an unlocked region. Tap it: cyan
   = fuel top-up, gold = cash bonus. Collectibles expire after 90s
   if untapped.

## Notes for Phase 7

- Hub Director and Fleet Engineer are stubbed engine-side (no
  auto-pricing or auto-upgrade yet). They display correctly in the
  UI but their effects don't apply. Phase 8 has a window to wire them
  once the achievement / collection systems land.
- The event banner shows global countdown without per-route Crisis
  Manager mitigation indication; that's a polish detail for Phase 10.
- Roaming collectible rewards are deterministic-random ($2K–$18K
  cash or 200–700 fuel). They scale up automatically with airline
  size in Phase 14 (retention) when achievements gate them.
- BRD §19 row 7 is next: Tiers 5–8 + Cargo lane.
