# Phase 13 (part) — Remote Config wiring

## Status

✅ Remote Config is fetched on startup and applied to the live economy.
The engine reads tunable knobs from `engine/tuning.ts` (pure, default =
previous hardcoded values), and `backend/remoteConfig.ts` fetches RC and
overrides them. Best-effort: a failed/absent fetch leaves in-code
defaults, so the game runs with zero backend.

## What landed

### Engine
- **`engine/tuning.ts`** — `TUNING` object + `applyEngineTuning()` /
  `resetEngineTuning()`. Defaults match the old constants exactly, so
  behaviour is unchanged until RC delivers an override. Only finite,
  non-negative numbers are accepted (a malformed payload can't zero the
  economy).

### Client RC (`backend/remoteConfig.ts`)
- Lazy `getRemoteConfig`, `defaultConfig` mirroring the in-code defaults,
  `minimumFetchIntervalMillis` = 0 in dev / 1h in prod.
- `initRemoteConfig()` → `fetchAndActivate` → parse all 17 params into a
  `ResolvedConfig` snapshot (`getResolvedConfig()`), and push the
  engine-consumed subset through `applyEngineTuning()`.
- Wired into `App.tsx` startup (lazy, non-blocking).

### Live (consumed) parameters
| RC key | Effect | Site |
|---|---|---|
| `econ_global_yield_mult` | scales all route revenue | `tick.ts` |
| `hub_bonus_per_level` | network bonus per hub level | `hubs.ts` |
| `condition_decay_rate` | per-leg condition wear multiplier | `tick.ts` |
| `fuel_demand_mult` | total fleet fuel demand multiplier | `fuel.ts` |
| `repair_cost_mult` | repair cost multiplier | `condition.ts` |

### Parsed but not yet consumed (reserved in `ResolvedConfig`)
`fuel_contract_cost_mult`, `fuel_capacity_cost_mult`, `offline_rate_pct`,
`offline_cap_hours`, `interstitial_min_interval_seconds`,
`rewarded_fuel_amount`, `min_supported_app_version`, the four
`feature_flag_*`, and `event_schedule`. These are fetched and exposed via
`getResolvedConfig()`; their consumer sites get wired in follow-ups.

## Decisions to confirm (owner)
- **Feature-flag defaults:** `remote-config.json` ships
  leaderboards/social/events = **false**, but those features are live in
  the app. Client `defaultConfig` here keeps them **true** to preserve
  shipped behaviour and we do **not** gate any UI on the flags yet. If
  you want RC to actually gate them, set the console values intentionally
  before we wire the gates.
- **Offline window:** RESOLVED → **1 hour**. `remote-config.json` now
  ships `offline_cap_hours = 1` to match the player-requested cap in
  `gameLoop.ts`. (Still not RC-consumed at runtime — the cap is the
  hardcoded 1h; the template just no longer disagrees.)

## Analytics ✅

`backend/analytics.ts` — best-effort Firebase Analytics wrapper. Native
(Android) routes through `@capacitor-firebase/analytics` (lazy import);
web has no GA measurementId in the Android config so it traces in dev and
no-ops otherwise. Never throws. All call sites go through the typed
`track.*` helpers (GA4-safe snake_case names).

Instrumented funnel:
- **Lifecycle:** `app_start`.
- **Progression:** `tier_unlocked`, `region_unlocked`, `achievement_unlocked`,
  `vintage_collected`.
- **Economy:** `aircraft_purchased`, `route_opened`, `route_closed`,
  `hub_created`, `hub_upgraded`, `manager_hired`, `fuel_contract_signed`.
- **Retention:** `daily_reward_claimed`, `offline_summary`, `offline_doubled`.
- **Ads (central in `ads.ts`):** `ad_offer_shown`, `ad_started`,
  `ad_rewarded`, `ad_dismissed` (per placement).
- **IAP (central in `iap.ts`):** `store_opened`, `iap_purchase_started`,
  `iap_purchase_success`, `iap_purchase_failed`, `vip_activated`.

## Owner steps (to make overrides take effect in production)
1. Functions/Firestore need the **Blaze** plan (also required for Phase 12).
2. Publish the Remote Config template (`remote-config.json`) in the
   Firebase console (or `firebase deploy --only remoteconfig`).
3. Editing a parameter in the console then takes effect on the next app
   launch (1h throttle in prod).
