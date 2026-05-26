/**
 * Cloud save mirror (BRD §11.3).
 *
 * The canonical save is local — Capacitor Preferences (see
 * `state/persistence.ts`). The cloud layer is a *mirror* for
 * cross-device sync. Writes are throttled and best-effort; reads
 * only happen on auth changes (e.g. fresh install → Google sign-in).
 *
 * Conflict resolution is **progress-favouring** per BRD §11.3:
 *  - If the cloud's `lifetimeEarnings` is strictly greater, the cloud
 *    state replaces local.
 *  - If equal, the newer `updatedAtMs` wins (tie-break).
 *  - Otherwise local wins and we push it up.
 *
 * `chooseWinner` and `mergeStates` are pure functions so they're
 * unit-tested in isolation.
 */
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import type { SaveState } from '../engine/types';
import { currentUid } from './auth';
import { getFirebaseFirestore } from './firebase';

/** Wire format: SaveState wrapped with a server-friendly timestamp. */
export interface CloudSaveDoc {
  state: SaveState;
  /** Wall-clock at the time of write, ms since epoch. */
  updatedAtMs: number;
  /** Schema migration hint — read-side may need to upgrade. */
  schemaVersion: number;
}

export interface SyncDecision {
  /** Final state to apply locally and (if `push`) push to the cloud. */
  state: SaveState;
  /** True iff the local store should accept this as the new state. */
  applyLocal: boolean;
  /** True iff this state should be written to the cloud. */
  push: boolean;
  /** Human-readable reason (for logs). */
  reason: 'no-cloud' | 'cloud-newer' | 'local-newer' | 'identical';
}

/**
 * Pure conflict resolver. Returns the action to take given the local
 * state and the cloud's last write.
 */
export function chooseWinner(
  local: SaveState,
  localUpdatedAtMs: number,
  cloud: CloudSaveDoc | null,
): SyncDecision {
  if (!cloud) return { state: local, applyLocal: false, push: true, reason: 'no-cloud' };
  const lEarn = local.lifetimeEarnings ?? 0;
  const cEarn = cloud.state.lifetimeEarnings ?? 0;
  if (cEarn > lEarn) {
    return { state: cloud.state, applyLocal: true, push: false, reason: 'cloud-newer' };
  }
  if (lEarn > cEarn) {
    return { state: local, applyLocal: false, push: true, reason: 'local-newer' };
  }
  // Tied — pick the more recent write.
  if (cloud.updatedAtMs > localUpdatedAtMs) {
    return { state: cloud.state, applyLocal: true, push: false, reason: 'cloud-newer' };
  }
  if (localUpdatedAtMs > cloud.updatedAtMs) {
    return { state: local, applyLocal: false, push: true, reason: 'local-newer' };
  }
  return { state: local, applyLocal: false, push: false, reason: 'identical' };
}

function db(): Firestore {
  return getFirebaseFirestore();
}

/**
 * Push the local state to /players/{uid}. No-op if not signed in.
 * Failures are swallowed — the Firestore client queues offline writes
 * automatically (BRD §11.3 airplane-mode acceptance).
 */
export async function pushSave(state: SaveState, nowMs: number): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  const payload: CloudSaveDoc = {
    state,
    updatedAtMs: nowMs,
    schemaVersion: state.schemaVersion,
  };
  try {
    await setDoc(doc(db(), 'players', uid), payload, { merge: false });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] cloud push failed (will retry on next throttle window)', err);
  }
}

/**
 * Fetch the cloud copy. Returns null when signed out, on network
 * error, or when the document doesn't exist yet.
 */
export async function pullSave(): Promise<CloudSaveDoc | null> {
  const uid = currentUid();
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db(), 'players', uid));
    if (!snap.exists()) return null;
    return snap.data() as CloudSaveDoc;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] cloud pull failed', err);
    return null;
  }
}

/**
 * Throttle a push so we don't hammer Firestore — same shape as the
 * local-save throttle in `state/persistence.ts`. Call `schedule()` on
 * every state change; the wrapped function runs at most once per
 * `intervalMs` (and on `flush()`).
 */
export function createCloudPushThrottle(
  fn: (state: SaveState, nowMs: number) => Promise<void>,
  intervalMs: number,
): { schedule: (s: SaveState) => void; flush: () => Promise<void> } {
  let pending: SaveState | null = null;
  let lastFireMs = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fire = async (): Promise<void> => {
    if (!pending) return;
    const toSave = pending;
    pending = null;
    lastFireMs = Date.now();
    if (timer) { clearTimeout(timer); timer = null; }
    await fn(toSave, lastFireMs);
  };

  return {
    schedule(s: SaveState): void {
      pending = s;
      const sinceLast = Date.now() - lastFireMs;
      if (sinceLast >= intervalMs) {
        void fire();
      } else if (!timer) {
        timer = setTimeout(() => void fire(), intervalMs - sinceLast);
      }
    },
    async flush(): Promise<void> {
      await fire();
    },
  };
}
