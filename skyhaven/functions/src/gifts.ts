/**
 * Gift callables (BRD §12 — social / monetisation soft loop).
 *
 * Friends can send a small cash or fuel gift to each other; the
 * recipient claims it from their inbox. The reward is delivered as
 * the callable's return payload — the client then dispatches a local
 * store action and cloud-syncs the updated state.
 *
 * Rate limits (per BRD §12 sketch — values tuned for an indie idle):
 *  - At most one **pending** gift between any pair at a time. Sending
 *    again before the recipient claims is a no-op.
 *  - At most 10 sends per sender per rolling 24h window.
 *  - At most 25 active pending gifts in the recipient's inbox.
 *
 * Friendship must be accepted before either side can send.
 */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const GIFT_KINDS = ['cash', 'fuel'] as const;
type GiftKind = typeof GIFT_KINDS[number];

const CASH_GIFT_MIN = 1_000;
const CASH_GIFT_MAX = 10_000;
const FUEL_GIFT_MIN = 100;
const FUEL_GIFT_MAX = 500;
const SEND_PER_24H_LIMIT = 10;
const INBOX_PENDING_LIMIT = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

function friendshipId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function clampAmount(kind: GiftKind, raw: number): number {
  const min = kind === 'cash' ? CASH_GIFT_MIN : FUEL_GIFT_MIN;
  const max = kind === 'cash' ? CASH_GIFT_MAX : FUEL_GIFT_MAX;
  return Math.max(min, Math.min(max, Math.floor(raw)));
}

export const sendGift = onCall(
  { region: 'us-central1' },
  async (req) => {
    try {
      return await sendGiftImpl(req);
    } catch (err) {
      // Surface anything we didn't categorise as a real HttpsError so
      // the client sees a useful message instead of "internal". This
      // most commonly catches Firestore "failed-precondition: missing
      // index" errors which would otherwise look opaque from the
      // device.
      if (err instanceof HttpsError) throw err;
      const e = err as { code?: string; message?: string };
      logger.error('[sendGift] unexpected', { code: e?.code, message: e?.message, err });
      throw new HttpsError('internal', e?.message ?? 'Unknown error');
    }
  },
);

async function sendGiftImpl(req: CallableRequest) {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
    const data = req.data as { toUid?: unknown; kind?: unknown; amount?: unknown } | undefined;
    const toUid = typeof data?.toUid === 'string' ? data.toUid : '';
    const kind = data?.kind;
    const amount = typeof data?.amount === 'number' ? data.amount : 0;
    if (!toUid || toUid === uid) {
      throw new HttpsError('invalid-argument', 'Recipient required');
    }
    if (typeof kind !== 'string' || !(GIFT_KINDS as readonly string[]).includes(kind)) {
      throw new HttpsError('invalid-argument', 'Gift kind must be cash or fuel');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpsError('invalid-argument', 'Amount must be positive');
    }
    const clamped = clampAmount(kind as GiftKind, amount);

    const db = getFirestore();

    // Friendship gate.
    const fSnap = await db.collection('friendships').doc(friendshipId(uid, toUid)).get();
    const f = fSnap.data() as { status?: string } | undefined;
    if (!f || f.status !== 'accepted') {
      throw new HttpsError('failed-precondition', 'You must be friends to send a gift');
    }

    // Rate limit: sender's recent sends.
    const since = Timestamp.fromMillis(Date.now() - DAY_MS);
    const recent = await db.collection('gifts')
      .where('fromUid', '==', uid)
      .where('sentAt', '>=', since)
      .count()
      .get();
    if (recent.data().count >= SEND_PER_24H_LIMIT) {
      throw new HttpsError('resource-exhausted', `Send limit reached (${SEND_PER_24H_LIMIT}/day)`);
    }

    // Recipient inbox cap (only counts pending).
    const inboxPending = await db.collection('gifts')
      .where('toUid', '==', toUid)
      .where('claimedAt', '==', null)
      .count()
      .get();
    if (inboxPending.data().count >= INBOX_PENDING_LIMIT) {
      throw new HttpsError('resource-exhausted', 'Recipient\'s inbox is full');
    }

    // One pending gift per pair at a time.
    const existing = await db.collection('gifts')
      .where('fromUid', '==', uid)
      .where('toUid', '==', toUid)
      .where('claimedAt', '==', null)
      .limit(1)
      .get();
    if (!existing.empty) {
      return { ok: true, status: 'already-pending' as const, giftId: existing.docs[0]!.id };
    }

    const ref = db.collection('gifts').doc();
    await ref.set({
      fromUid: uid,
      toUid,
      kind,
      amount: clamped,
      sentAt: FieldValue.serverTimestamp(),
      claimedAt: null,
    });
    return { ok: true, status: 'sent' as const, giftId: ref.id, amount: clamped };
}

export const claimGift = onCall(
  { region: 'us-central1' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
    const data = req.data as { giftId?: unknown } | undefined;
    const giftId = typeof data?.giftId === 'string' ? data.giftId : '';
    if (!giftId) throw new HttpsError('invalid-argument', 'Gift id required');

    const db = getFirestore();
    const ref = db.collection('gifts').doc(giftId);
    const reward = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'Gift not found');
      const g = snap.data() as {
        toUid?: string;
        kind?: GiftKind;
        amount?: number;
        claimedAt?: unknown;
      };
      if (g.toUid !== uid) throw new HttpsError('permission-denied', 'Not your gift');
      if (g.claimedAt) throw new HttpsError('failed-precondition', 'Gift already claimed');
      if (!g.kind || typeof g.amount !== 'number') {
        throw new HttpsError('internal', 'Malformed gift');
      }
      tx.update(ref, { claimedAt: FieldValue.serverTimestamp() });
      return { kind: g.kind, amount: g.amount };
    });
    return { ok: true, reward };
  },
);
