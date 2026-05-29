# Phase 15 — Monetization

## Stage A — Rewarded ads ✅

Rewarded-ad placements wired end-to-end. The ad SDK itself is
**simulated** (`ui/monetize/ads.ts`) until AdMob is set up — every
placement is fully playable/testable now; wiring the real SDK is a
one-file change.

### Placements
| Reward | Trigger | Effect |
|---|---|---|
| 2× offline doubler | "Double it" on the Welcome-Back modal | credits the offline earnings again |
| Fuel fill | button in the Fuel panel + auto-prompt when the reserve runs dry | reserve → 100% |
| 15-minute income | popup every 5 min of play (odd marks) | grants 15 min of current effective income |
| 3-minute 2× speed-up | popup every 5 min of play (even marks) | 2× revenue for 3 minutes |

- Periodic offers alternate **cash → speed-up → cash → …**, one every
  5 minutes of *foreground* play, each a 15-second opt-in popup
  (`MonetizeOffers` + `RewardOfferPopup`). Backgrounding pauses the clock.
- Out-of-fuel prompt: `FuelEmptyOffer`, armed once per dry-out.
- **Interstitials:** intentionally OFF (placement vocabulary leaves room).
- **Banners:** not added.

### Engine / state
- `SaveState.speedUpUntilMs` + `vipUntilMs` (schema v10 → v11 migration,
  default 0). `vipUntilMs` is for Stage B but migrated now.
- `engine/yield.ts` — `globalYieldMultFor(state, nowMs)` centralises the
  revenue multiplier (Eco + Vintage + Remote Config + **2× speed-up** +
  **1.5× VIP**). VIP also gives +50% fuel supply in the tick.
- `engine/economy.ts` — `effectiveIncomePerSec()` sizes the timed grants.
- Pure actions: `grantCash`, `grantYieldSeconds`, `fillFuel`,
  `startSpeedUp` (+ store wiring). Tests in `engine/monetize.test.ts`.

## Stage B — IAP ✅

Direct-purchase store (no premium currency), billing **simulated**
(`ui/monetize/iap.ts`) until Play Billing is wired.

- **VIP Pass (7 days)** — `activateVip()`: sets `vipUntilMs` (extends
  from the later of existing/now) and pays a one-time 5-hour income
  bonus. Ongoing effects already live via `engine/yield.ts`: **+50%
  revenue** and **+50% fuel supply** while active.
- **6 cash packs** — 5 / 10 / 24 / 50 / 100 / 300 hours of yield, granted
  as cash via `grantYieldSeconds`. The hour count is a backend detail
  (product id); the store card shows only the resulting in-game cash,
  computed live from the player's effective income.
- **`StorePanel`** replaces the "Executive Deals" ComingSoon placeholder
  (wired in `PanelHost`); reachable via the in-game Store. Includes
  **Restore purchases**.
- No Remove-Ads product (no interstitials). No premium currency.
- Test: `activateVip` in `engine/monetize.test.ts`.

### Deferred
- **Server-side receipt validation Cloud Function** — intentionally not
  added yet: it needs real Play Billing + the Play Developer API +
  service account, all owner-gated, and isn't meaningfully testable
  while billing is simulated. The client grants entitlements locally for
  now (VIP persists in `SaveState` and cloud-syncs). Wire validation
  alongside the native Billing plugin.

## Owner setup (gates real ads/IAP; until then simulated)
- AdMob: account + app + rewarded unit ids + link to Firebase + app-ads.txt.
- Play Console: create the IAP product ids, billing, internal testing track.
