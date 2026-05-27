/**
 * SkyHaven Tycoon — Cloud Functions entry (v2 only per CLAUDE.md).
 *
 * Functions are split into per-feature files; this index just wires up
 * Firebase Admin once and re-exports them at the deployment names
 * Firebase reads from the build output (`lib/index.js`).
 */
import { initializeApp } from 'firebase-admin/app';
import { onCall } from 'firebase-functions/v2/https';

initializeApp();

export { submitLeaderboardScore } from './leaderboards';
export { deleteAccount } from './deleteAccount';
export {
  claimFriendCode,
  sendFriendRequest,
  expireOldFriendRequests,
} from './friends';
export { sendGift, claimGift } from './gifts';

/** Liveness probe — useful from the Firebase emulator + cold-start
 *  warm-up. Returns the deployment phase so we can confirm what's
 *  running without parsing release notes. */
export const healthcheck = onCall({ region: 'us-central1' }, () => {
  return { ok: true, phase: 12, ts: Date.now() };
});
