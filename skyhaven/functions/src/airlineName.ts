/**
 * Airline-name uniqueness (leaderboard integrity).
 *
 * Every player's airline name must be globally unique so the
 * leaderboard reads as a roster of distinct airlines. Uniqueness is
 * enforced server-side via a `airlineNames/{normalized}` reservation
 * collection + a Firestore transaction — the same pattern as
 * `claimFriendCode`. The document id is the *normalized* name (lower-
 * cased, trimmed, internal whitespace collapsed) so 'SkyHaven Air' and
 * 'skyhaven  air' collide.
 *
 * Two callables:
 *  - checkAirlineName: read-only availability probe (for live UI).
 *  - claimAirlineName: atomically reserves the name for the caller,
 *    releasing any name they previously held. Returns the stored
 *    display form. Throws 'already-exists' if another uid owns it.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/** Normalize a display name to its uniqueness key. Must match the
 *  client's normalizeAirlineName exactly. */
export function normalizeAirlineName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

const MAX_NAME_LEN = 20;

export const checkAirlineName = onCall(
  { region: 'us-central1' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
    const raw = typeof req.data?.name === 'string' ? req.data.name : '';
    const key = normalizeAirlineName(raw);
    if (!key) return { available: false, reason: 'empty' };
    if (key.length > MAX_NAME_LEN) return { available: false, reason: 'too-long' };

    const db = getFirestore();
    const snap = await db.collection('airlineNames').doc(key).get();
    // Available if unclaimed, or already held by this same player.
    const owner = snap.exists ? (snap.data()?.uid as string | undefined) : undefined;
    const available = !snap.exists || owner === uid;
    return { available };
  },
);

export const claimAirlineName = onCall(
  { region: 'us-central1' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
    const raw = typeof req.data?.name === 'string' ? req.data.name : '';
    const display = raw.trim().slice(0, MAX_NAME_LEN);
    const key = normalizeAirlineName(display);
    if (!key) throw new HttpsError('invalid-argument', 'Name is empty');

    const db = getFirestore();
    const nameRef = db.collection('airlineNames').doc(key);
    const profileRef = db.collection('profiles').doc(uid);

    const claimed = await db.runTransaction(async (tx) => {
      const nameSnap = await tx.get(nameRef);
      if (nameSnap.exists && (nameSnap.data()?.uid as string | undefined) !== uid) {
        return false; // owned by someone else
      }
      // Release the player's previous name reservation, if any and different.
      const profileSnap = await tx.get(profileRef);
      const prevKey = profileSnap.data()?.airlineNameKey as string | undefined;
      if (prevKey && prevKey !== key) {
        tx.delete(db.collection('airlineNames').doc(prevKey));
      }
      tx.set(nameRef, { uid, name: display, createdAt: FieldValue.serverTimestamp() });
      tx.set(
        profileRef,
        { uid, airlineName: display, airlineNameKey: key, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return true;
    });

    if (!claimed) throw new HttpsError('already-exists', 'That airline name is taken');
    return { name: display };
  },
);
