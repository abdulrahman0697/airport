# Claude instructions — abdulrahman0697/airport

This repository is **SkyHaven Tycoon — Wings of the World**, an Android-first idle/tycoon
game built per BRD v2.0 (uploaded by the owner). The build plan lives in the planning file
referenced from the session; phased delivery follows BRD §19.

## Working agreements

- All development happens in the `skyhaven/` subfolder. The repo root holds CI workflows
  and this file; everything else is inside `skyhaven/`.
- Development branch: `claude/affectionate-bell-aXP0U`. Commit and push at every phase
  boundary; never push to `main` without explicit permission.
- One phase at a time. Each phase ends with a runnable build, `skyhaven/docs/PHASE_N_NOTES.md`,
  and a pause for owner device test before starting the next.
- Tech stack is locked in `skyhaven/app/package.json`. Treat BRD §2.1 versions as floors —
  React 19 + Vite 6 + Pixi 8 are the current targets.
- TypeScript is `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. No `any`.
- The simulation engine (`src/engine/`) must remain **pure TypeScript** and deterministic.
  Anything touching `Math.random`, `Date.now`, or `performance.now` directly inside the engine
  is a bug — those flow in through `TickContext`.
- All economy/tuning constants live in `src/data/` and must be Remote-Config-overridable
  (BRD §4.13, §13.3).
- No tap-to-claim mechanic anywhere (BRD §3, §20.4). Revenue auto-collects.
- No premium currency. IAP sells directly (BRD §11.4).
- Honor `prefers-reduced-motion` as a hard accessibility switch.

## Decisions locked

| Topic | Decision |
|---|---|
| applicationId | `com.skyhaven.tycoon` (placeholder) |
| VIP Pass | +50% revenue (softened from BRD's 2×) |
| Vintage IAP | Only classics from the free drop pool |
| Tutorial skip | Production: none. Debug builds: via debug menu |
| Ad mediation | Google AdMob |
| Launch language | English only at launch; i18n architecture ready |
| Fuel gate | Strict — opening blocked if new demand > supply |
| Launch geo | Global day-one |

## Where things go

- Web app: `skyhaven/app/`
- Pure simulation engine: `skyhaven/app/src/engine/`
- Pixi world rendering: `skyhaven/app/src/world/`
- React UI: `skyhaven/app/src/ui/` (panels are lazy-loaded)
- Zustand state + persistence: `skyhaven/app/src/state/`
- Aircraft / airport / economy data: `skyhaven/app/src/data/`
- Firebase clients: `skyhaven/app/src/backend/`
- Cloud Functions: `skyhaven/functions/` (v2 API only)
- Firestore rules: `skyhaven/firestore.rules` (a first-class tested deliverable, BRD §18)
- Remote Config defaults: `skyhaven/remote-config.json`
- CI: `.github/workflows/`
- Per-phase notes: `skyhaven/docs/PHASE_N_NOTES.md`

## Running locally

```
cd skyhaven
npm install
npm run dev          # web in browser
npm test             # vitest
npm run typecheck
npm run android:build:debug   # requires android/ generated via `npx cap add android`
```

## Things to never do

- Never commit `google-services.json`, keystores, or `.env` secrets. `.gitignore` blocks them.
- Never use `Math.random` / `Date.now` inside `src/engine/` — break determinism.
- Never add a tap-to-claim button.
- Never gate progression behind payment.
- Never skip the pre-React watchdog in `index.html`.
- Never push to `main`.
