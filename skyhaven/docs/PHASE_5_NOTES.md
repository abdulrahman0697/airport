# Phase 5 — Routes, hubs, regions

## Status

✅ Route demand factor, hub creation + leveling with network revenue
bonus, 9 cash-gated regions with strict gating on `openRoute`, and the
**route-arc layer renders on the world map** — great-circle paths in
the tail color with an animated dot tracking each aircraft's leg.

Acceptance target per BRD §19 row 5: hub bonus applies; pricing changes
load factor.

## What landed

### Data

- **`data/regions.ts`** — 9 regions with cash-unlock costs ($250K → $100M).
  Europe (region 3) is the free starter; the rest cash-gate the network.

### Engine (pure)

- **`engine/hubs.ts`** — `HUB_BONUS_PER_LEVEL = 0.05`, `MAX_HUB_LEVEL = 10`,
  cost helpers (size-tier base × 1.7 per level), `networkBonusForRoute`
  (sums level × bonus across both endpoints), `routesAtAirport`.
- **`engine/economy.ts`** — `legRevenue` now multiplies by:
  - `demandMul = 0.85 + 0.30 × routeDemand` (thin routes ~0.85×, busy
    ~1.15× — `routeDemand` derived from `(originSize + destSize) / 8`)
  - `networkMul = 1 + sum(hub.level × HUB_BONUS_PER_LEVEL)` across
    routes that touch any hub.
- **`engine/actions.ts`**:
  - `openRoute` now gates on `unlockedRegions` for **both** endpoints
    (throws `REGION_LOCKED`).
  - Three new actions: `unlockRegion(id)`, `createHub(iata)` (requires
    ≥ 2 connected routes), `upgradeHub(iata)` (escalating cost).
- **`engine/tick.ts`** — passes the current hub list into `legRevenue`
  so the network bonus shows up on every credit.

### State

- Store exposes the new actions and adds `selectHubs`,
  `selectUnlockedRegions`.

### World layer

- **`world/geo.ts`** — great-circle slerp on the unit sphere with
  longitude continuity (antimeridian crossings folded so the polyline
  doesn't dash across the map). `pointAlongPath(path, t)` for the dot.
- **`world/Arcs.ts`** — Pixi `Container` that diffs the route list by
  ID and incrementally creates / updates / removes `Graphics`. Each
  arc renders as a wide low-alpha halo plus a sharp core stroke, both
  in the tail color. The animated dot inherits direction and progress
  from the route's `legProgress` + `legDirection`.
- **`world/WorldStage.ts`** — adds the arcs container between clouds
  and pins, plus `setRoutes()` / `setTailColor()` methods.
- **`ui/components/WorldView.tsx`** — subscribes to the store and pushes
  routes and tail-color updates into the stage on every change. The
  stage rebuilds only when the route id-set changes; per-tick progress
  updates re-draw just the dot.

### UI

- **`ui/panels/RoutesPanel.tsx`** — three-tab layout:
  - **Routes** — existing per-route cards, now with a HUB badge when
    either endpoint is a hub.
  - **Hubs** — Active hubs (with upgrade button) + Eligible airports
    (any IATA carrying ≥ 2 routes that isn't a hub yet).
  - **Regions** — all 9 regions with unlocked / cost / unlock CTA.
  - "+ New route" modal now filters the airport dropdowns to unlocked
    regions only.

## Tests

| File | Tests |
|---|---|
| `engine/hubs.test.ts` | 13 — route counting, hub creation gates, upgrade level + max, network bonus math, hub bonus lifts leg revenue, region gate blocks + opens after unlock, creation cost by size tier |
| (Phases 0–4 carry-over) | 72 |

**Total: 85 / 85 passing.**

## Bundle

| Chunk | Gzipped | Delta |
|---|---|---|
| `index` (main) | 138 KB | +1 KB (hub helpers, regions data) |
| `RoutesPanel` (lazy) | 3.8 KB | +1.1 KB (hubs + regions tabs) |
| `WorldStage` (lazy) | 3.6 KB | +1 KB (arcs + geo) |
| Others | unchanged | |

## Owner test for Phase 5

Wait ~3-5 min for CI, **uninstall the previous build first**, install
new APK on Pixel 8 Pro. Then:

1. **Map** — your existing starter route now renders as a curved cyan
   arc between the two airports. A small white dot moves along the
   arc as the aircraft flies its current leg, reversing direction at
   each endpoint.
2. **Top bar** — tap the airline name (currently does nothing); cash
   continues to roll; the arc visibly traces the same aircraft you've
   been earning from.
3. **Routes → Routes tab** — same per-route cards as Phase 3.
4. **Routes → Regions tab** — only Europe shows "Unlocked"; others
   show their unlock cost in gold. Tap "Unlock North America"
   ($250K) — cash deducts, the region flips to Unlocked.
5. **Try to open a route into a locked region** — go to "+ New route".
   Until you unlock e.g. Middle East, no Middle-Eastern airports appear
   in the destination dropdown.
6. **Hubs** — open ≥ 2 routes that share the same endpoint (any
   airport with 2+ routes touching it qualifies). Then Routes → Hubs
   tab shows that airport under "Eligible airports" with a "Promote
   to hub" button. Tap it — $10K-$50K depending on size tier — the
   route cards for that endpoint gain a **HUB** badge and the cash/sec
   visibly climbs (+5% per hub level on touching routes).
7. **Upgrade hub** — back to Hubs tab; tap "Upgrade hub" → +5% to all
   touching routes, escalating cost.
8. **Pricing toggle** still works — switch a hub-connected route to
   Premium; load factor drops but yield rises; the route's cash/sec
   reflects both pricing and hub bonus.

## Notes for Phase 6

- Crew tab is still "Coming soon". Phase 6 wires the 6 managers
  per hub (hired from the Hubs tab — the hub-managers UI grows there)
  plus the event system and roaming collectibles.
- The arc dot is a single sprite per route; Phase 10 polish swaps in
  the traveling-light-pulse treatment for the arc itself.
- Antimeridian-crossing arcs (e.g. LAX↔NRT) render as a continuous line
  that runs off the eastern edge of the visible world. Splitting at
  ±180° is a small follow-up; not blocking.
