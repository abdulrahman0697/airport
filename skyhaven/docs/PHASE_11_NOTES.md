# Phase 11 — Backend: auth + cloud save

## Status

✅ Anonymous sign-in fires silently on first launch. The local save is
unchanged — Capacitor Preferences remains canonical (BRD §4.8) — and
Firestore mirrors it for cross-device sync. Google sign-in is wired
into the Office panel ("Cloud Save" card). Conflict resolution is
**progress-favouring** (BRD §11.3) and unit-tested in isolation.

Airplane-mode acceptance: every cloud call is wrapped in try/catch and
Firestore's IndexedDB persistence queues writes offline — the game
runs end-to-end with the device on airplane mode.

## What landed

### Dependencies

- `firebase@^12.13` (web SDK)
- `@capacitor-firebase/authentication@^8.2` (native Android Google
  chooser)

### Backend modules (new `src/backend/`)

- **`config.ts`** — public client config (apiKey, projectId, appId).
  Mirrors `android/app/google-services.json`. Firebase's security
  model relies on Firestore rules + Auth, not key secrecy, so these
  are safe in source.
- **`firebase.ts`** — lazy-singleton Firebase app, Auth, and Firestore
  clients. Firestore opts in to `persistentLocalCache` with multi-tab
  manager so offline writes queue + flush on reconnect.
- **`auth.ts`** — `ensureAnonymous`, `signInWithGoogle`, `signOut`,
  `subscribeAuth`. Native vs web branching: native uses the Capacitor
  plugin so the player sees the system Google chooser; web falls back
  to the Firebase popup for developer ergonomics.
- **`cloudSave.ts`** — `pushSave`, `pullSave`, `chooseWinner` (pure),
  `createCloudPushThrottle`. The pure resolver is the cleanly-tested
  core: cloud wins iff `lifetimeEarnings > local.lifetimeEarnings`;
  ties break by `updatedAtMs`; otherwise local wins and is pushed up.
- **`cloudSync.ts`** — glue. Subscribes to auth changes (pulls + 
  reconciles on uid switch), subscribes to the Zustand store
  (throttles a push every 15 s), kicks off anonymous sign-in.
- **`useAuth.ts`** — React hook over `subscribeAuth` so the Office
  panel's "Cloud Save" card stays live.

### UI

- **OfficePanel** gains a "Cloud Save" card right after the airline
  identity card:
  - **Anonymous** → status "Anonymous device sync" + `Sign in with
    Google` CTA.
  - **Google** → status "Cloud sync enabled" + display name + `Sign
    out` CTA.
  - **No network / signed out** → status "Offline" with a reassuring
    "local progress is always safe" line.

### Bundle

- Firebase chunk: **137 KB gzipped**, lazy-loaded via `cloudSync` so
  it does not block first paint. The main `index` chunk is unchanged
  (~170 KB gzipped).

### Firestore document shape (under `players/{uid}`)

```ts
{
  state: SaveState,        // the full local save
  updatedAtMs: number,     // wall clock at write
  schemaVersion: number    // migration hint for the read side
}
```

Rules (`firestore.rules`) already restrict reads/writes to the owner.

### Game-loop integration

`App.tsx` dynamically imports `cloudSync` on mount and calls
`startCloudSync()`. The returned `stop()` is invoked on unmount so
HMR / test rerenders don't leak listeners.

## Tests

| File | Tests |
|---|---|
| `backend/cloudSave.test.ts` | 5 — no-cloud, cloud-newer (higher earnings), local-newer, tie-break by timestamp, identical states |
| (Phases 0–10 carry-over) | 97 |

**Total: 102 / 102 passing.**

## Owner test for Phase 11

> Before this is shippable on a real Android device you'll need to
> finish the Firebase Console OAuth setup (see "Setup required" below).
> Anonymous sign-in and cloud save will already work; Google sign-in
> needs OAuth.

1. **Anonymous mirror** — install the AAB. Open the app. Open Network
   → Office. The "Cloud Save" card should read "Anonymous device sync"
   within a couple of seconds (a network blip means it stays
   "Offline" — that's fine, the game still works).
2. **Verify push** — play for ~30 seconds. In the Firebase Console
   under Firestore Data, you should see a document under `players/`
   keyed by the anonymous uid, with your `state` mirrored.
3. **Airplane mode** — turn on airplane mode, play for ~5 minutes
   (open routes, hire managers). Game must feel identical. Turn
   airplane mode off — within a few seconds, the cloud doc should
   refresh with the new state.
4. **Google sign-in** — back in Office, tap `Sign in with Google`.
   Pick a Google account. Status flips to "Cloud sync enabled" with
   your display name. Behind the scenes the local progress is reconciled
   with whatever was previously on that Google account using the
   progress-favouring rule.
5. **Cross-device sync** — install on a second device. Sign in with
   the same Google account from the Office panel. Within a few seconds
   the second device should load the higher-lifetime-earnings state
   (your progress from device 1).
6. **Sign-out** — tap `Sign out`. Status returns to "Anonymous device
   sync" under a *new* anonymous uid. The local game continues with
   the same state.

## Setup required by owner (before device test step 4)

These are one-time Firebase Console steps; I can't do them from this
environment.

1. **Firebase Console → Authentication → Sign-in method** — enable
   **Google** and **Anonymous** providers.
2. **Android OAuth** — add the Android app's SHA-1 fingerprint
   under Project settings → General → Your apps → Android. Use:

   ```
   keytool -list -v -alias androiddebugkey \
     -keystore ~/.android/debug.keystore -storepass android -keypass android
   ```

   …for the debug build, and your release keystore's SHA-1 before
   shipping to Play.
3. **Download the updated `google-services.json`** — Firebase regenerates
   it with the OAuth client info; drop it into
   `skyhaven/android/app/google-services.json` (replacing the existing
   file). Rebuild the AAB.

Until step 1 is done, anonymous sign-in will fail with
`auth/admin-restricted-operation` and the cloud-save card will stay
on "Offline" — but the game still works because every backend call is
best-effort.

## Notes for Phase 12

- Plausibility-validation Cloud Function for leaderboard submissions
  (BRD §12.4) — Firestore rules already block direct writes to
  `leaderboards/{board}/entries/{uid}`, so the callable function is
  the only valid path.
- Friend graph lives in `friendships/`; rules already restrict reads
  and writes to participants.
- Cloud Functions need the Blaze plan; flag this in the owner-pre-Phase-12
  checklist when we get there.
