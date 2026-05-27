/**
 * Gift client SDK (BRD §12.3).
 *
 * Send / claim are callable wrappers; the inbox is a live snapshot of
 * `gifts` documents where the current uid is the recipient and
 * `claimedAt` is still null. The recipient applies the reward to
 * their local SaveState via the store's `creditGift` action — the
 * change rides cloud sync up like any other store mutation.
 */
import {
  collection,
  onSnapshot,
  query,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseFirestore } from './firebase';
import { currentUid } from './auth';

export type GiftKind = 'cash' | 'fuel';

export interface Gift {
  id: string;
  fromUid: string;
  toUid: string;
  kind: GiftKind;
  amount: number;
  sentAtMs: number;
  claimedAtMs: number | null;
}

function db(): Firestore { return getFirebaseFirestore(); }
function fns() { return getFunctions(undefined, 'us-central1'); }

function tsMs(v: unknown): number | null {
  if (v == null) return null;
  if (v && typeof v === 'object' && 'toMillis' in v) {
    const fn = (v as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn.call(v);
  }
  return typeof v === 'number' ? v : null;
}

export type SendGiftResult =
  | { ok: true; status: 'sent' | 'already-pending'; giftId: string; amount?: number }
  | { ok: false; code: string; message: string };

export async function sendGift(toUid: string, kind: GiftKind, amount: number): Promise<SendGiftResult> {
  try {
    const fn = httpsCallable<
      { toUid: string; kind: GiftKind; amount: number },
      { ok: true; status: 'sent' | 'already-pending'; giftId: string; amount?: number }
    >(fns(), 'sendGift');
    const out = await fn({ toUid, kind, amount });
    return out.data;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { ok: false, code: e?.code ?? 'unknown', message: e?.message ?? String(err) };
  }
}

export type ClaimGiftResult =
  | { ok: true; kind: GiftKind; amount: number }
  | { ok: false; code: string; message: string };

export async function claimGift(giftId: string): Promise<ClaimGiftResult> {
  try {
    const fn = httpsCallable<
      { giftId: string },
      { ok: true; reward: { kind: GiftKind; amount: number } }
    >(fns(), 'claimGift');
    const out = await fn({ giftId });
    return { ok: true, kind: out.data.reward.kind, amount: out.data.reward.amount };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return { ok: false, code: e?.code ?? 'unknown', message: e?.message ?? String(err) };
  }
}

/**
 * Subscribe to the recipient inbox — gifts addressed to the current
 * uid that haven't been claimed yet. Sorted newest-first.
 */
export function subscribeInbox(cb: (gifts: readonly Gift[]) => void): Unsubscribe | null {
  const uid = currentUid();
  if (!uid) { cb([]); return null; }
  const q = query(
    collection(db(), 'gifts'),
    where('toUid', '==', uid),
    where('claimedAt', '==', null),
  );
  return onSnapshot(
    q,
    (snap) => {
      const out: Gift[] = [];
      for (const doc of snap.docs) {
        const v = doc.data() as Partial<Gift> & {
          sentAt?: unknown;
          claimedAt?: unknown;
        };
        if (!v.fromUid || !v.toUid || !v.kind || typeof v.amount !== 'number') continue;
        out.push({
          id: doc.id,
          fromUid: v.fromUid,
          toUid: v.toUid,
          kind: v.kind,
          amount: v.amount,
          sentAtMs: tsMs(v.sentAt) ?? 0,
          claimedAtMs: tsMs(v.claimedAt),
        });
      }
      out.sort((a, b) => b.sentAtMs - a.sentAtMs);
      cb(out);
    },
    (err) => {
      // eslint-disable-next-line no-console
      console.warn('[skyhaven] subscribeInbox error', err);
      cb([]);
    },
  );
}
