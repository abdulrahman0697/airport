/**
 * Leaderboard SDK (BRD §12).
 *
 * Reads live entries straight from Firestore (rules allow auth-only
 * reads on `leaderboards/{board}/entries/{uid}`); writes go through
 * the `submitLeaderboardScore` callable so the plausibility cap is
 * enforced server-side.
 *
 * `submitAllBoards` is fire-and-forget — failures are logged but
 * never surface to the player. Cloud sync of the local save is the
 * source of truth; the leaderboard is a public mirror.
 */
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseFirestore } from './firebase';
import { ensureAnonymous } from './auth';
import type { BoardId } from '../data/leaderboards';

export interface LeaderboardEntry {
  uid: string;
  displayName: string | null;
  photoUrl: string | null;
  score: number;
  submittedAt: number | null;
}

const TOP_LIMIT = 50;

function db(): Firestore {
  return getFirebaseFirestore();
}

export async function fetchBoard(board: BoardId): Promise<readonly LeaderboardEntry[]> {
  try {
    const ref = collection(db(), 'leaderboards', board, 'entries');
    const q = query(ref, orderBy('score', 'desc'), limit(TOP_LIMIT));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const v = d.data() as {
        uid?: string;
        displayName?: string | null;
        photoUrl?: string | null;
        score?: number;
        submittedAt?: { toMillis?: () => number } | number | null;
      };
      const submittedAt =
        typeof v.submittedAt === 'object' && v.submittedAt && typeof v.submittedAt.toMillis === 'function'
          ? v.submittedAt.toMillis()
          : typeof v.submittedAt === 'number'
            ? v.submittedAt
            : null;
      return {
        uid: v.uid ?? d.id,
        displayName: v.displayName ?? null,
        photoUrl: v.photoUrl ?? null,
        score: v.score ?? 0,
        submittedAt,
      };
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] fetchBoard failed', { board, err });
    return [];
  }
}

interface SubmitInput {
  board: BoardId;
  score: number;
  sessionTimeSec: number;
  displayName: string | null;
  photoUrl: string | null;
}

export async function submitScore(input: SubmitInput): Promise<void> {
  // Make sure we have an identity before calling the function.
  await ensureAnonymous();
  try {
    const fn = httpsCallable(getFunctions(undefined, 'us-central1'), 'submitLeaderboardScore');
    await fn(input);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] submitScore failed', { board: input.board, err });
  }
}

export async function submitAllBoards(
  entries: readonly { board: BoardId; score: number }[],
  meta: { sessionTimeSec: number; displayName: string | null; photoUrl: string | null },
): Promise<void> {
  await Promise.all(
    entries
      .filter((e) => e.score > 0)
      .map((e) => submitScore({ ...e, ...meta })),
  );
}
