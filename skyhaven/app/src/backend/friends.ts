/**
 * Friend graph client SDK (BRD §12.2 / §12.3).
 *
 * The Cloud Functions own atomic create paths (code-claim,
 * send-request). Accept / decline / unfriend go through plain Firestore
 * writes that the rules allow for participants.
 *
 * `subscribeFriendships` exposes a real-time stream of friendship docs
 * involving the current uid so the UI can render incoming requests
 * and the accepted-friends list without polling.
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  or,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseFirestore } from './firebase';
import { currentUid, ensureAnonymous } from './auth';

export interface Friendship {
  id: string;
  aUid: string;
  bUid: string;
  /** The other participant from the current player's perspective. */
  otherUid: string;
  status: 'pending' | 'accepted';
  requestedByUid: string;
  createdAtMs: number;
  updatedAtMs: number;
}

function db(): Firestore { return getFirebaseFirestore(); }
function fns() { return getFunctions(undefined, 'us-central1'); }

export async function claimFriendCode(): Promise<string | null> {
  await ensureAnonymous();
  try {
    const fn = httpsCallable<unknown, { code: string }>(fns(), 'claimFriendCode');
    const out = await fn({});
    return out.data.code;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] claimFriendCode failed', err);
    return null;
  }
}

export type SendFriendRequestResult =
  | { ok: true; status: 'sent' | 'already-pending' | 'already-friends'; friendshipId: string }
  | { ok: false; code: string; message: string };

export async function sendFriendRequest(code: string): Promise<SendFriendRequestResult> {
  await ensureAnonymous();
  try {
    const fn = httpsCallable<{ code: string }, {
      status: 'sent' | 'already-pending' | 'already-friends';
      friendshipId: string;
    }>(fns(), 'sendFriendRequest');
    const out = await fn({ code });
    return { ok: true, ...out.data };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { ok: false, code: e?.code ?? 'unknown', message: e?.message ?? String(err) };
  }
}

export async function acceptFriendRequest(friendshipId: string): Promise<boolean> {
  try {
    await updateDoc(doc(db(), 'friendships', friendshipId), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] acceptFriendRequest failed', err);
    return false;
  }
}

export async function declineFriendRequest(friendshipId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db(), 'friendships', friendshipId));
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] declineFriendRequest failed', err);
    return false;
  }
}

export const unfriend = declineFriendRequest;

function tsMs(v: unknown): number {
  if (v && typeof v === 'object' && 'toMillis' in v && typeof (v as { toMillis?: () => number }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return typeof v === 'number' ? v : 0;
}

/**
 * Subscribe to every friendship involving the current uid. Returns the
 * unsubscribe handle; pass null to the callback if signed out.
 */
export function subscribeFriendships(
  cb: (friendships: readonly Friendship[]) => void,
): Unsubscribe | null {
  const uid = currentUid();
  if (!uid) { cb([]); return null; }
  const ref = collection(db(), 'friendships');
  const q = query(ref, or(where('aUid', '==', uid), where('bUid', '==', uid)));
  return onSnapshot(
    q,
    (snap) => {
      const out: Friendship[] = [];
      for (const docSnap of snap.docs) {
        const v = docSnap.data() as {
          aUid?: string;
          bUid?: string;
          status?: 'pending' | 'accepted';
          requestedByUid?: string;
          createdAt?: unknown;
          updatedAt?: unknown;
        };
        if (!v.aUid || !v.bUid) continue;
        const otherUid = v.aUid === uid ? v.bUid : v.aUid;
        out.push({
          id: docSnap.id,
          aUid: v.aUid,
          bUid: v.bUid,
          otherUid,
          status: v.status ?? 'pending',
          requestedByUid: v.requestedByUid ?? '',
          createdAtMs: tsMs(v.createdAt),
          updatedAtMs: tsMs(v.updatedAt),
        });
      }
      out.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      cb(out);
    },
    (err) => {
      // eslint-disable-next-line no-console
      console.warn('[skyhaven] subscribeFriendships error', err);
      cb([]);
    },
  );
}
