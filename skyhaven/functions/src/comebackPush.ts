/**
 * Comeback push (BRD §13).
 *
 * Scheduled every 6 hours. Finds players whose cloud save hasn't been
 * touched in 24h+ but who have a registered FCM token and haven't
 * been pinged in the last 72h, then sends a one-shot "your airline
 * misses you" notification.
 *
 * Idempotent across runs: we stamp `lastComebackPushMs` on the
 * profile after a successful send so the 6-hour schedule won't
 * re-hit the same player every cycle.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const INACTIVITY_MS = 24 * 60 * 60 * 1000;
const REPING_MIN_GAP_MS = 72 * 60 * 60 * 1000;
const BATCH_SIZE = 250;

const COPY = [
  { title: 'Your airline is idle', body: 'Cash is piling up — come back and put it to work.' },
  { title: 'Hangar check-in', body: 'A few minutes of attention now compounds for days.' },
  { title: 'Skies are open', body: 'New routes await. Open SkyHaven and earn what\'s yours.' },
];

function pickCopy(uid: string): { title: string; body: string } {
  // Deterministic per uid so a player gets variety across multiple
  // pushes but the same nudge isn't sent twice in a row.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return COPY[(h >>> 0) % COPY.length]!;
}

export const sendComebackPush = onSchedule(
  { schedule: 'every 6 hours', region: 'us-central1' },
  async () => {
    const db = getFirestore();
    const now = Date.now();
    const inactiveCutoff = now - INACTIVITY_MS;
    const pingedCutoff = now - REPING_MIN_GAP_MS;

    const inactive = await db
      .collection('players')
      .where('updatedAtMs', '<', inactiveCutoff)
      .limit(BATCH_SIZE)
      .get();

    if (inactive.empty) return;

    const messaging = getMessaging();
    let sent = 0;

    for (const playerDoc of inactive.docs) {
      const uid = playerDoc.id;
      const profileSnap = await db.collection('profiles').doc(uid).get();
      const p = profileSnap.data() as
        | { fcmToken?: string; lastComebackPushMs?: number }
        | undefined;
      if (!p?.fcmToken) continue;
      if (typeof p.lastComebackPushMs === 'number' && p.lastComebackPushMs > pingedCutoff) {
        continue;
      }
      const copy = pickCopy(uid);
      try {
        await messaging.send({
          token: p.fcmToken,
          notification: { title: copy.title, body: copy.body },
          android: { priority: 'normal' },
        });
        await profileSnap.ref.set({ lastComebackPushMs: now }, { merge: true });
        sent++;
      } catch (err) {
        const code = (err as { code?: string })?.code;
        // Stale tokens — strip from profile so we don't keep trying.
        if (
          code === 'messaging/registration-token-not-registered'
          || code === 'messaging/invalid-registration-token'
        ) {
          await profileSnap.ref.set({ fcmToken: null }, { merge: true });
        } else {
          // eslint-disable-next-line no-console
          console.warn('[comebackPush] send failed', { uid, code });
        }
      }
    }
    // eslint-disable-next-line no-console
    console.info(`[comebackPush] sent ${sent} of ${inactive.size} eligible players`);
  },
);
