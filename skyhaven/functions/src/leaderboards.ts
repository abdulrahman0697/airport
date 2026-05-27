/**
 * submitLeaderboardScore (BRD §12.4).
 *
 * Clients call this with their current score for a board. We do a
 * plausibility check (the only practical anti-cheat with a
 * client-authoritative economy) before writing the entry.
 *
 * The cap formulas err on the side of generous false-positives over
 * false-negatives — a power player who legitimately hits the cap will
 * be silently capped at the value rather than rejected. The intent is
 * to keep blatant editors off the top of the board, not to police
 * marginal cases.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const BOARD_IDS = ['lifetime', 'perMinute', 'eco', 'vintage'] as const;
type BoardId = typeof BOARD_IDS[number];

/** Per-board plausibility caps. Tweak in tandem with the BRD economy
 *  curve. Values represent the *absolute upper bound* — anything above
 *  is rejected as obviously cheated. */
const CAPS: Record<BoardId, { max: number; perSecMax?: number }> = {
  // ~$8K/sec across the whole session — well above any realistic peak,
  // which keeps legitimate top players in.
  lifetime: { max: 1e18, perSecMax: 8_000 },
  // Single-route Mega-Liner at +VIP +eco maxes around ~$500K/min;
  // round to $750K with headroom for events.
  perMinute: { max: 750_000 },
  // Eco rating is bounded by the economy itself.
  eco: { max: 100 },
  // 12 classics in the drop pool today; bump if BRD §8 grows.
  vintage: { max: 64 },
};

function isBoardId(s: unknown): s is BoardId {
  return typeof s === 'string' && (BOARD_IDS as readonly string[]).includes(s);
}

export const submitLeaderboardScore = onCall(
  { region: 'us-central1' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
    const data = req.data as {
      board?: unknown;
      score?: unknown;
      sessionTimeSec?: unknown;
      displayName?: unknown;
      photoUrl?: unknown;
    } | undefined;
    if (!data) throw new HttpsError('invalid-argument', 'Missing payload');

    const board = data.board;
    const score = data.score;
    const sessionTimeSec = typeof data.sessionTimeSec === 'number' ? data.sessionTimeSec : 0;
    const displayName = typeof data.displayName === 'string' ? data.displayName.slice(0, 40) : null;
    const photoUrl = typeof data.photoUrl === 'string' ? data.photoUrl.slice(0, 512) : null;

    if (!isBoardId(board)) throw new HttpsError('invalid-argument', 'Unknown board');
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
      throw new HttpsError('invalid-argument', 'Score must be a finite non-negative number');
    }

    const cap = CAPS[board];
    let effectiveScore = Math.min(score, cap.max);
    if (cap.perSecMax !== undefined && sessionTimeSec > 0) {
      const sessionCap = cap.perSecMax * Math.max(60, sessionTimeSec);
      effectiveScore = Math.min(effectiveScore, sessionCap);
    }
    if (effectiveScore <= 0) {
      throw new HttpsError('invalid-argument', 'Score must be positive');
    }

    const db = getFirestore();
    const docRef = db
      .collection('leaderboards')
      .doc(board)
      .collection('entries')
      .doc(uid);

    // Only overwrite if the new score is higher than what's already on
    // the board — leaderboards are monotonic.
    const existing = await docRef.get();
    const existingScore = (existing.data()?.score ?? 0) as number;
    if (effectiveScore <= existingScore) {
      return { ok: true, written: false, score: existingScore };
    }

    await docRef.set({
      uid,
      board,
      score: effectiveScore,
      displayName,
      photoUrl,
      submittedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, written: true, score: effectiveScore };
  },
);
