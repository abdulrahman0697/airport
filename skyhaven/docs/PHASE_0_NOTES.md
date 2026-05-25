# Phase 0 — Scaffold + CI

## Status

✅ Repo scaffolded. Next step: owner provides Firebase + GitHub secrets, then I generate
the Capacitor Android project locally (`npx cap add android`) and ship the first installable
debug AAB.

## What landed

- `skyhaven/` monorepo root with `app/` (web), `functions/` (Cloud Functions v2),
  `firestore.rules`, `remote-config.json`, `firebase.json`, `capacitor.config.ts`.
- Web stack: **Vite 6 + React 19 + TypeScript 5 (strict + `noUncheckedIndexedAccess`) +
  PixiJS 8 + Zustand 5 + Framer Motion 11 + Vitest 2**.
- Capacitor 7 with plugins: `app`, `device`, `haptics`, `keyboard`, `local-notifications`,
  `network`, `preferences`, `screen-orientation`, `splash-screen`, `status-bar`, plus
  `@capacitor-firebase/analytics` and `/crashlytics`.
- `index.html` ships the **pre-React watchdog** (BRD §2.6) — 10s timeout, 3-attempt cap via
  `sessionStorage`, cancelled by `window.__cancelPreReactWatchdog()` after `createRoot`.
- Splash background `#0B1120`, status bar dark, portrait lock will be enforced via
  `@capacitor/screen-orientation` in Phase 1 once the world renders.
- React `App` mounts and shows the wordmark. `ErrorBoundary` is wired with **Reload** /
  **Reset progress** recovery (BRD §14).
- Engine stub `src/engine/tick.ts` defines `TICK_HZ = 10` (BRD §2.4) and a basic Vitest
  to prove the test pipeline runs.
- Design tokens land in `src/ui/global.css` (palette from BRD §9.7, plus my proposed
  Eco-tier hex values).
- Firestore rules baseline scoped per-uid; leaderboard writes locked to Cloud Functions only.
- Remote Config defaults populated with every key from BRD §13.3 (feature flags default off
  for backend-dependent systems).
- **CI** (`.github/workflows/ci.yml`): typecheck + test + web build on every push;
  debug AAB build job runs when `skyhaven/android/gradlew` exists.
- **Firebase deploy** (`.github/workflows/deploy-firebase.yml`): on tag push, deploys
  Firestore rules + Remote Config + Functions — guarded so it no-ops without secrets.
- `CLAUDE.md` at repo root documents working agreements.

## What I still need from you (blocks Phase 1)

1. **Firebase project** — create at console.firebase.google.com. Add Android app with
   package `com.skyhaven.tycoon`. Download `google-services.json` and add it as a GitHub
   secret (or paste contents — I'll wire it into the Android build).
2. **GitHub Actions secrets** to add:
   - `FIREBASE_PROJECT_ID` — e.g. `skyhaven-tycoon-prod`.
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — full JSON of a Firebase Admin service account
     (Firebase Console → Project Settings → Service Accounts → Generate new private key).
   - `ADMOB_APP_ID_ANDROID` — placeholder OK for now; we'll fill in Phase 15.
3. **Confirm Node 20 vs 22** — the environment runs Node 22; `.nvmrc` is pinned to 20 LTS for
   CI parity. Either is fine; tell me if you'd rather match the runtime.
4. **Spec device** — confirm Snapdragon 7-gen / 6 GB target (BRD §20.12) or share your test
   device so I can tune the quality-tier thresholds.

## Owner test for Phase 0

I can't generate the Capacitor Android project from this remote container without your
Android SDK / `local.properties`. Once you confirm the items above I'll do one of:

- **Option A (preferred)** — you run `npx cap add android` from `skyhaven/` on your machine,
  then push. CI will then produce the debug AAB on every push.
- **Option B** — I add the `android/` folder remotely and stub `local.properties`; you wire
  the SDK path locally before your first build.

Either way, **acceptance test**: install the debug AAB on your test device, splash shows
for ≤2.5s, the wordmark screen renders, no crash. Then we proceed to Phase 1.

## Tech-stack deltas from BRD §2.1

| BRD | Installed | Why |
|---|---|---|
| React 18.x | React 19 | Current stable; no breaking changes for our usage |
| Vite 5.x | Vite 6 | Current stable |
| Zustand 4.x | Zustand 5 | Current stable; React 19 compatible |

All other versions match BRD §2.1. Floors only — these can rev later without re-planning.

## Open BRD inconsistencies (tracked in plan file)

Logged in the planning doc: aircraft count, fuel gate, Logistics Director scoping, paid
classics, offline catch-up performance, airport-data slicing, age rating, schema gaps, Eco
color tokens, install budget, fuel-during-tutorial, leaderboard plausibility. None block
Phase 0; each has a resolution in the plan.
