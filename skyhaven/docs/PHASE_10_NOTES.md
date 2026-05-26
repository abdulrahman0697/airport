# Phase 10 — Visual & motion polish

## Status

✅ Living-map polish (twinkling star field, country layer with locked/
unlocked tinting, energised arcs with directional pulses, plane glyph
oriented to flight direction, infinite horizontal world loop). Premium
intro splash, juice triads (visual + haptic), tier progress + tier
unlock hero moments, eco-rating badge, rolling cash + 4-digit sig-fig
formatting, per-minute revenue rate, route opening with estimated
revenue, lit-up tutorial with click-block spotlight, hub-first
gameplay (no auto-starter route), CEO Office dashboard.

Acceptance per BRD §19 row 10: High/Medium ≥50fps on the spec device;
Low stable 30fps. (Owner to verify on device.)

## What landed (cumulative across 7 polish passes)

### World layer

- **Pin layer** rebuilt around per-tier baked sprite textures + counter-
  scaling + LOD culling. Two textures (unlocked tail-color / locked dim
  grey). Major-pin subset (every 6th) bypasses culling so the world
  always shows landmarks.
- **Country layer** (`Countries.ts`) — Natural Earth ne_110m polygons
  shaded brighter when their region is unlocked.
- **Basemap** simplified to a deterministic star/city-light field (no
  graticule, no terminator — both read as noise).
- **Arcs**: route path, three energised pulses cycling along the great
  circle, and a plane glyph rotated to face the current flight
  direction (inbound legs sample the path backwards). Pulse phase
  inverts on the inbound leg.
- **Collectibles**: drifting cash / fuel orbs with deterministic spawn
  per save seed; bouncy reflective drift inside a 90-world-unit radius.
- **Camera** unclamped horizontally — `tx` wraps modulo `WORLD_WIDTH`
  so the player can pan east/west infinitely. Basemap, countries, pins,
  arcs, planes, pulses, and collectibles all tile at ±WORLD_WIDTH so
  the wrap is seamless.
- Camera `centerOn` + `zoomToRegion` so the first launch auto-zooms to
  the player's home region instead of staring at the whole globe.

### UI / motion

- **TopBar** is now an opaque section above the game (own bordered
  band, world view + events anchor below a new `--world-top` CSS
  variable). Brand button + explicit "CEO" pill both open the Office
  panel. Tier progress bar with a linear gradient (tail color →
  `#F4C75B`) and `T<n>` chevrons. Cash uses 4-sig-digit `formatCash`,
  cash/min uses `formatRate`.
- **CEO Office panel** — airline brand, lifetime earnings, current
  cash, tier + progress, fleet/routes/hub counts, eco standing.
- **Tutorial** — 8-beat playable walkthrough, no skip in release. Card
  is a brightly-lit panel against a click-blocking spotlight (4 dim
  panels around the highlighted target absorb stray taps so the
  player can only interact with the highlighted control). Step chain
  uses fall-through target keys so the spotlight follows the player
  into a panel / modal / specific input.
- **IntroSplash** — aurora drift, 80-particle deterministic twinkle,
  title-shimmer wordmark, tagline carousel.
- **HeroMoments** — confetti-burst card on tier unlock + region unlock,
  via a "seen set" so it never false-fires on first load.
- **HubPicker** — full-screen overlay shown on first launch (timezone-
  detected home region as default, with a starter-region dropdown so
  the player can pick any region) and after every region unlock.
  Countries collapse into accordions.
- **AddHubModal** + **NewRouteModal** — country accordion picker; the
  new-route destination picker collapses the moment the player picks
  an airport so the route summary + Open button are immediately
  visible.
- **GoalChainCard** ribbon hides whenever a panel is open.
- **FuelGauge** + **EventBanner** anchored below `--world-top`.

### Engine / state

- **Schema v6** — added `tutorialCompleted`, `tutorialStep`,
  `goalChainStep`, `pendingOfflineSummary`, `lastLoginDate`,
  `loginStreak`, `pendingDailyReward`, `pendingHubPickRegion`,
  `pendingVintageDrop`, `vintageMilestonesConsumed`, `ecoRating`,
  `activeEvents`, `collectibles`, `vintage`. Migrations chain through
  v1→v6 with time-aware seeding for scheduler fields.
- **`actions.chooseStartingRegion(regionId)`** — only valid when
  `hubs.length === 0`; swaps `unlockedRegions` to `[regionId]` and
  re-points the pending hub-pick prompt at the chosen region.
- **`actions.pickHub` / `dismissHubPick`** — first hub in a region is
  free, subsequent hubs cost. Routes must originate from owned hubs
  (`NOT_A_HUB` error).
- **Initial state** — `STARTER_CASH = 2,000,000` (TEMP for dev), no
  starter route, no starter hub; `pendingHubPickRegion = homeRegion`.
- **Daily login** deferred until tutorial completion so the streak
  modal doesn't crash the walkthrough.

### Data

- **`scripts/build-airports.mjs`** — `intl` flag now ORs a curated
  major-hub allow-list with the OurAirports name regex, so AMS, LHR,
  CDG, FRA, JFK, HND, ICN, SIN, BKK etc. all surface in the picker.
  Dataset regenerated (1104 airports, 896 international).
- **`ui/countryNames.ts`** — centralised country-name lookup with an
  override map (ISO `IL` → "Palestine").

## Tests

96 → 97 passing. Camera test updated to assert infinite horizontal
wrap + vertical clamp.

## Known limitations (carry to later phases)

- **Pin / arc / collectible tiling at ±WORLD_WIDTH** triples the sprite
  count (~3,300 pins). FPS on the spec device is the owner's
  acceptance gate; if it dips on Low, the wraparound tiles can be
  built lazily by camera region.
- **Cloud layer** is single-instance — its 0.18 alpha is gentle enough
  that gaps past the dateline aren't obvious, but a TilingSprite swap
  is a candidate polish item.
- **CONFIG override** for STARTER_CASH — currently $2M for dev; should
  drop back to ~$120K once Phase 11 economy tuning lands.

## Owner test for Phase 10

Already verified via the iterative polish loop (7 rounds). Last
verified deliverable: new-route destination accordion auto-collapses
on pick; tutorial card lit up brightly with dark text.

## Notes for Phase 11

- `src/backend/` is empty; Phase 11 will populate it with `firebase.ts`,
  `auth.ts`, `cloudSave.ts`.
- `google-services.json` is in place; project = `sky-haven-game`.
- Firestore rules (`firestore.rules`) already restrict `/players/{uid}`
  to the owner.
- Cloud save must mirror local save *without* blocking offline play —
  airplane-mode acceptance is a BRD §19 row.
