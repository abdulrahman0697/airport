/**
 * SkyHaven Tycoon — Cloud Functions (v2).
 * Phase 0: placeholder. Real functions land in:
 *  - Phase 11: deleteAccount (callable) — wipes player Firestore data.
 *  - Phase 12: submitLeaderboardScore (callable, plausibility-checked).
 *  - Phase 13: scheduleLiveEvent (scheduled), sendComebackPush (triggered).
 */
import { onCall } from 'firebase-functions/v2/https';

export const healthcheck = onCall({ region: 'us-central1' }, () => {
  return { ok: true, phase: 0, ts: Date.now() };
});
