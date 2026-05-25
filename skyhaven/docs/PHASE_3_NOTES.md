# Phase 3 — Economy & fleet (T1–4)

## Status

✅ 20 aircraft across Tiers 1–4, per-aircraft upgrades, condition decay
and repair, cumulative-earnings tier-unlock gates, Fleet + Routes panels
with bottom nav, rolling cash counter.

Acceptance target per BRD §19 row 3: grow $25K → $10M without grinding.
The Phase-2 economy already gave a positive cash rate; Phase 3 adds the
levers (buy bigger aircraft, open more routes, upgrade) that compound it.

## What landed

### Engine (pure, deterministic)

- **`data/aircraft.ts`** — 20 defs (5 per tier × 4 tiers). Manufacturer
  type names only, no liveries or trademarks (BRD §4.2 clean-room rule).
  All numbers are seed defaults; Remote Config tunes at runtime.
- **`engine/upgrades.ts`** — four upgrade lines (Engine, Cabin, Fuel Eff,
  Brand Marketing) with the BRD §4.7 cost curve `base × 1.15^n`.
  `baseFraction` ties cost to the aircraft's purchase price so upgrades
  scale with the tier the player is on.
- **`engine/condition.ts`** — band classifier (normal / degraded /
  critical at 70% / 40% thresholds) and `repairCost` (10% of purchase
  price at fully decayed, scaled linearly to degradation).
- **`engine/tierUnlocks.ts`** — `$50K / $500K / $5M` thresholds for
  Tiers 2 / 3 / 4. Checked in the tick on every revenue credit.
- **`engine/actions.ts`** — pure state transitions: `buyAircraft`,
  `sellAircraft`, `openRoute`, `closeRoute`, `setRoutePricing`,
  `applyUpgrade`, `repairAircraft`. Each throws a typed `ActionError`
  with a code on invalid state; the store wraps them and surfaces the
  message to the UI.
- **`engine/tick.ts`** — applies condition decay per leg, accumulates
  flight-hours in game-time, bumps `tierUnlocked` from cumulative
  earnings, refuses to fly aircraft at 0% condition.

### State

- **`state/store.ts`** — Zustand store gains action methods that return
  an `ActionResult` envelope (`{ ok: true } | { ok: false, code, message }`)
  so React code never has to try/catch.

### UI

- **`ui/components/BottomTabs.tsx`** — fixed 5-tab nav (Map · Routes ·
  Fleet · Crew · Store), Crew + Store stubbed as "Coming soon", "needs
  attention" badge on Fleet when any aircraft is below 70% condition.
- **`ui/components/PanelHost.tsx`** — Framer Motion sliding bottom-sheet
  shell with lazy-imported panel content. Esc closes.
- **`ui/components/RollingCash.tsx`** — smooth-rolling cash counter
  (critically-damped lerp, 8% per frame). Honours `prefers-reduced-motion`.
  Full per-digit odometer treatment lands in Phase 10's visual polish.
- **`ui/panels/FleetPanel.tsx`** — Owned / Buy tabs.
  - Owned: per-aircraft card with condition pill, 4 upgrade buttons
    (live cost, disabled past max), repair button when below 100%.
  - Buy: every aircraft definition with tier-locked pills and the
    current cash-affordability state on the CTA.
- **`ui/panels/RoutesPanel.tsx`** — per-route card with pricing toggle
  (economy / balanced / premium), cash/sec, condition + load-factor
  readout, close-route. "+ New route" modal with aircraft picker plus
  origin and destination dropdowns (destination filtered by range
  from origin).

### Airport dataset fix

The Phase 1 build script alphabetically truncated `airports.top.json` at
500 entries and silently dropped late-letter hubs (LHR, LAX, MAD, MAN, …)
— Phase 3 needed those for sane route-picking. Fixed: ship every
`large_airport` with scheduled service (1,104 after dedup). Top-tier
bundle grew from 59 KB → 130 KB, still inside budget.

## Tests

| File | Tests |
|---|---|
| `engine/actions.test.ts` | 10 — buy/sell, openRoute incl. range/cash gates, closeRoute, setPricing, applyUpgrade incl. max-level + marketing→load, repair |
| `engine/condition.test.ts` | 6 |
| `engine/upgrades.test.ts` | 5 |
| `engine/tierUnlocks.test.ts` | 5 |
| `engine/tick.test.ts` | 9 — adds condition-decay and tier-unlock checks |
| (Phases 0–2 carry-over) | 24 |

**Total: 59 / 59 passing.**

## Bundle

| Chunk | Gzipped | Note |
|---|---|---|
| `index` (main) | 135 KB | engine + state + 1,104 airports + framer-motion + UI shell |
| `react` | 4.2 KB | |
| `FleetPanel` (lazy) | 2.1 KB | |
| `RoutesPanel` (lazy) | 2.7 KB | |
| `WorldStage` (lazy) | 2.5 KB | |
| `pixi` (lazy) | 135 KB | only on map mount |

Initial transfer at first paint ≈ 140 KB gzipped. Pixi + world chunk
lazy-loads when the map mounts. Well inside BRD §2.7 1 MB budget.

## Owner test for Phase 3

Wait for CI on this commit (~3-5 min), download the new `skyhaven-debug-apk`,
**uninstall the previous build first** so the schema-versioned save
restarts clean. Then on the Pixel 8 Pro emulator:

1. **Top bar** — `T1 unlocked` pill under the wordmark; cash rolls
   smoothly instead of snapping when revenue lands.
2. **Bottom nav** — tap Routes / Fleet — the bottom-sheet slides up
   with spring physics. Tap Map (or the × in the top-right of the
   panel) to dismiss.
3. **Fleet → Owned** — your starter ATR 42 shows condition 100%, with
   four upgrade buttons (Engine / Cabin / Fuel Eff / Brand Mktg).
   - Buy a few upgrades; cash deducts, level Roman numerals tick up.
   - Engine upgrade should visibly raise revenue rate (legs complete faster).
   - Marketing upgrade should visibly raise the load-factor readout
     on the starter route in the Routes panel.
4. **Fleet → Buy aircraft** — Tier-1 picks are available; Tier 2–4
   show "Unlock at T2/3/4". After lifetime earnings cross $50K, the
   T2 lockout should drop (top-bar tier pill updates to `T2 unlocked`).
5. **Routes → + New route** — pick the second idle aircraft (after
   buying one), select origin / destination, confirm. Watch the new
   route start earning, and the cash-per-second in the top bar climb.
6. **Pricing toggle** — switch a route to Premium → load factor drops
   visibly (70% of base) but per-leg revenue rises (1.4× yield); switch
   to Economy → opposite.
7. **Condition decay** — let a single route run for ~30 real-minutes.
   The aircraft's condition % should fall into the orange band; let it
   run further and revenue per leg drops noticeably. Tap **Repair**
   and condition snaps back to 100% (with cash deducted proportional
   to how degraded it was).
8. **Force-kill** — close + relaunch; everything restored including
   upgrade levels, condition, cash, all routes.

If anything misbehaves, `adb logcat | grep -i 'skyhaven\|chromium'` and
paste — the ErrorBoundary catches uncaught throws and offers a
"Reset progress" recovery.

## Notes for Phase 4

- Routes don't render as arcs on the map yet — that's the route-arc
  layer in `src/world/` and arrives with Phase 5 (route demand + hubs)
  since it cross-pollinates with the airport-database overhaul.
- Fuel is still fully stubbed (1000 supply, no demand). Phase 4 wires
  the supply chain, gating new routes by fuel headroom.
- The Crew tab opens a "Coming soon" — managers arrive Phase 6.
