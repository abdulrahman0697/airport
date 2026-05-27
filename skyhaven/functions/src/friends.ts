/**
 * Friend graph callables (BRD §12.2 / §12.3).
 *
 * Two endpoints:
 *  - `claimFriendCode`: idempotent — returns the caller's existing
 *    friend code, or generates one and persists it atomically.
 *  - `sendFriendRequest`: takes a friend code, resolves to a uid,
 *    creates a pending friendship document with a canonical sorted
 *    ID so duplicates self-merge.
 *
 * Acceptance / decline / unfriend are direct client writes — the
 * Firestore rules allow participants to update status to 'accepted'
 * (only the recipient, not the requester) or delete the doc.
 *
 * Friend codes use a 30-char alphabet excluding visually-ambiguous
 * glyphs (0/O, 1/I/L). 8 chars × 30^8 ≈ 6.5×10^11 — plenty of room
 * for the lifetime of this game, and collisions are caught by the
 * unique-doc constraint in the claim transaction.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const FRIEND_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const FRIEND_CODE_LEN = 8;
const FRIEND_CODE_MAX_ATTEMPTS = 5;

function generateFriendCode(): string {
  let out = '';
  for (let i = 0; i < FRIEND_CODE_LEN; i++) {
    out += FRIEND_CODE_ALPHABET[Math.floor(Math.random() * FRIEND_CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Canonical friendship doc id: the two uids sorted + joined by `_`.
 * Ensures only one document per pair regardless of who requested.
 */
function friendshipId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

export const claimFriendCode = onCall(
  { region: 'us-central1' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');

    const db = getFirestore();
    const profileRef = db.collection('profiles').doc(uid);

    // Reuse existing code if already claimed.
    const existing = await profileRef.get();
    const existingCode = existing.data()?.friendCode as string | undefined;
    if (existingCode) return { code: existingCode };

    // Otherwise roll codes until we find a free one. Collisions on an
    // 8-char alphabet-30 namespace are astronomically rare, but we
    // still cap retries so a buggy alphabet can't spin forever.
    for (let attempt = 0; attempt < FRIEND_CODE_MAX_ATTEMPTS; attempt++) {
      const candidate = generateFriendCode();
      const codeRef = db.collection('friendCodes').doc(candidate);
      const claimed = await db.runTransaction(async (tx) => {
        const codeSnap = await tx.get(codeRef);
        if (codeSnap.exists) return false;
        tx.set(codeRef, { uid, createdAt: FieldValue.serverTimestamp() });
        tx.set(
          profileRef,
          {
            uid,
            friendCode: candidate,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return true;
      });
      if (claimed) return { code: candidate };
    }
    throw new HttpsError('internal', 'Could not allocate a friend code, retry shortly');
  },
);

export const sendFriendRequest = onCall(
  { region: 'us-central1' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
    const data = req.data as { code?: unknown } | undefined;
    const raw = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
    if (!raw) throw new HttpsError('invalid-argument', 'Friend code required');
    if (!/^[A-Z0-9]{6,12}$/.test(raw)) {
      throw new HttpsError('invalid-argument', 'Friend code format invalid');
    }

    const db = getFirestore();
    const codeSnap = await db.collection('friendCodes').doc(raw).get();
    const targetUid = codeSnap.data()?.uid as string | undefined;
    if (!targetUid) throw new HttpsError('not-found', 'No player has that friend code');
    if (targetUid === uid) {
      throw new HttpsError('failed-precondition', 'You can\'t friend yourself');
    }

    const docId = friendshipId(uid, targetUid);
    const ref = db.collection('friendships').doc(docId);
    const result = await db.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      if (cur.exists) {
        const d = cur.data() as { status?: string } | undefined;
        if (d?.status === 'accepted') return { status: 'already-friends' as const };
        // Either side re-sending while pending: surface 'already-pending'.
        return { status: 'already-pending' as const };
      }
      const aUid = uid < targetUid ? uid : targetUid;
      const bUid = uid < targetUid ? targetUid : uid;
      tx.set(ref, {
        aUid,
        bUid,
        status: 'pending',
        requestedByUid: uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'sent' as const };
    });
    return { ...result, friendshipId: docId, targetUid };
  },
);

/**
 * Defensive expiry: pending requests older than 30 days are reaped on
 * a manual basis (callable so it can be wired to a UI 'cleanup' or to
 * a scheduled function later in Phase 13). Returns the number of
 * stale docs deleted that were addressed to the caller.
 */
export const expireOldFriendRequests = onCall(
  { region: 'us-central1' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
    const cutoff = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const db = getFirestore();
    const stale = await db.collection('friendships')
      .where('status', '==', 'pending')
      .where('updatedAt', '<', cutoff)
      .get();
    const batch = db.batch();
    let count = 0;
    for (const doc of stale.docs) {
      const d = doc.data() as { aUid?: string; bUid?: string };
      if (d.aUid === uid || d.bUid === uid) {
        batch.delete(doc.ref);
        count++;
      }
    }
    if (count > 0) await batch.commit();
    return { reaped: count };
  },
);
