/**
 * deleteAccount (BRD §16.2 — Play Store data deletion requirement).
 *
 * Wipes everything tied to the caller's uid:
 *  - players/{uid}                       (cloud save mirror)
 *  - leaderboards/{board}/entries/{uid}  (all four boards)
 *  - friendships/* documents where the uid appears
 *  - gifts/* documents where the uid is sender or recipient
 *
 * The caller is also signed out of Firebase Auth from the client side
 * after this returns. The client is responsible for clearing its own
 * local save via the in-app reset flow if the player wants a clean
 * slate beyond the cloud wipe.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const BOARD_IDS = ['lifetime', 'perMinute', 'eco', 'vintage'] as const;

export const deleteAccount = onCall(
  { region: 'us-central1' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');

    const db = getFirestore();
    const batch = db.batch();

    batch.delete(db.collection('players').doc(uid));

    for (const board of BOARD_IDS) {
      batch.delete(db.collection('leaderboards').doc(board).collection('entries').doc(uid));
    }

    // Friendships are double-keyed (aUid/bUid). Two queries cover
    // both directions.
    const friendshipsA = await db.collection('friendships').where('aUid', '==', uid).get();
    const friendshipsB = await db.collection('friendships').where('bUid', '==', uid).get();
    for (const doc of friendshipsA.docs) batch.delete(doc.ref);
    for (const doc of friendshipsB.docs) batch.delete(doc.ref);

    const giftsFrom = await db.collection('gifts').where('fromUid', '==', uid).get();
    const giftsTo = await db.collection('gifts').where('toUid', '==', uid).get();
    for (const doc of giftsFrom.docs) batch.delete(doc.ref);
    for (const doc of giftsTo.docs) batch.delete(doc.ref);

    await batch.commit();

    // Tear down the auth identity last so the writes above are
    // authorised at the moment they happen.
    try {
      await getAuth().deleteUser(uid);
    } catch (err) {
      // Non-fatal — Firestore is wiped, auth user can be GC'd later.
      // eslint-disable-next-line no-console
      console.warn('[deleteAccount] auth deleteUser failed', err);
    }

    return { ok: true };
  },
);
