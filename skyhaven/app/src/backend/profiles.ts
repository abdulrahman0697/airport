/**
 * Public profile mirror (Phase 12.2).
 *
 * Each player has a `profiles/{uid}` document with the bits other
 * players are allowed to see: airline name, tail color, current tier,
 * lifetime earnings, friend code. This is the source the friends
 * panel pulls when listing your accepted friendships.
 *
 * `pushProfile` is called from cloudSync alongside the save mirror so
 * the profile stays in step with the local state. Failures are
 * swallowed — profile freshness is best-effort.
 */
import {
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';
import { currentUid } from './auth';
import type { SaveState } from '../engine/types';

export interface PublicProfile {
  uid: string;
  airlineName: string;
  tailColor: string;
  tier: number;
  lifetimeEarnings: number;
  friendCode: string | null;
  updatedAtMs: number;
}

function db(): Firestore { return getFirebaseFirestore(); }

export async function pushProfile(state: SaveState): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  try {
    await setDoc(
      doc(db(), 'profiles', uid),
      {
        uid,
        airlineName: state.airlineName,
        tailColor: state.tailColor,
        tier: state.tierUnlocked,
        lifetimeEarnings: state.lifetimeEarnings,
        updatedAtMs: Date.now(),
      },
      { merge: true },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] pushProfile failed', err);
  }
}

export async function fetchProfile(uid: string): Promise<PublicProfile | null> {
  try {
    const snap = await getDoc(doc(db(), 'profiles', uid));
    if (!snap.exists()) return null;
    const d = snap.data() as Partial<PublicProfile>;
    return {
      uid,
      airlineName: d.airlineName ?? '—',
      tailColor: d.tailColor ?? '#5AC8FA',
      tier: d.tier ?? 1,
      lifetimeEarnings: d.lifetimeEarnings ?? 0,
      friendCode: d.friendCode ?? null,
      updatedAtMs: d.updatedAtMs ?? 0,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] fetchProfile failed', { uid, err });
    return null;
  }
}
