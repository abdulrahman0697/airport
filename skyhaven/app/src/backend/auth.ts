/**
 * Auth wrapper (BRD §11.2).
 *
 * Two sign-in paths:
 *  - **Anonymous**: invoked silently on first launch. The player gets
 *    a persistent uid without ever touching a sign-in screen. Used as
 *    the cloud-save mirror identity for the lifetime of the install
 *    unless they upgrade to Google.
 *  - **Google**: invoked from the Office panel. On native Android the
 *    `@capacitor-firebase/authentication` plugin opens the system
 *    Google chooser; on web it falls back to a Firebase web popup
 *    (developer ergonomics only — the production build is native).
 *
 * Linking: when an anonymous player upgrades to Google, we *do not*
 * `linkWithCredential` blindly because that would refuse the upgrade
 * if the Google identity already has a cloud save (the Google user
 * exists). Instead we sign in as the Google identity and let the
 * cloud-save layer reconcile progress (BRD §11.3 progress-favouring
 * conflict resolution).
 *
 * Network failures never throw to callers — sign-in is best-effort
 * and the local game keeps running on the local save.
 */
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

export type AuthListener = (user: AuthUser | null) => void;

export interface AuthUser {
  uid: string;
  /** Anonymous accounts have no provider id; Google has 'google.com'. */
  providerId: 'anonymous' | 'google.com' | 'other';
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
}

function toAuthUser(u: User | null): AuthUser | null {
  if (!u) return null;
  let providerId: AuthUser['providerId'] = 'other';
  if (u.isAnonymous) providerId = 'anonymous';
  else if (u.providerData.some((p) => p.providerId === 'google.com')) {
    providerId = 'google.com';
  }
  return {
    uid: u.uid,
    providerId,
    displayName: u.displayName,
    email: u.email,
    photoUrl: u.photoURL,
  };
}

/**
 * Subscribe to auth state. Returns an unsubscribe fn. The listener
 * fires immediately with the current user (or null).
 */
export function subscribeAuth(fn: AuthListener): () => void {
  return onAuthStateChanged(getFirebaseAuth(), (u) => fn(toAuthUser(u)));
}

/**
 * Get the current uid synchronously, or null if signed out.
 */
export function currentUid(): string | null {
  return getFirebaseAuth().currentUser?.uid ?? null;
}

/**
 * Best-effort anonymous sign-in. Idempotent: returns the existing uid
 * if already signed in (anonymous or otherwise). Failures are swallowed
 * so airplane-mode startup never breaks the local game.
 */
export async function ensureAnonymous(): Promise<AuthUser | null> {
  const auth = getFirebaseAuth();
  if (auth.currentUser) return toAuthUser(auth.currentUser);
  try {
    const cred = await signInAnonymously(auth);
    return toAuthUser(cred.user);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] anonymous sign-in failed', err);
    return null;
  }
}

/**
 * Sign in with Google. On native Android this goes through the
 * Capacitor plugin so the player gets the system Google chooser;
 * on web we use the Firebase popup for developer convenience.
 *
 * Returns the new auth user, or null if the player cancelled / no
 * network. Caller is responsible for handling the cloud-save merge.
 */
export async function signInWithGoogle(): Promise<AuthUser | null> {
  const auth = getFirebaseAuth();
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) return null;
      const credential = GoogleAuthProvider.credential(idToken);
      const out = await signInWithCredential(auth, credential);
      return toAuthUser(out.user);
    }
    const provider = new GoogleAuthProvider();
    const out = await signInWithPopup(auth, provider);
    return toAuthUser(out.user);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] Google sign-in failed', err);
    return null;
  }
}

/**
 * Sign out of the current account (Google) and immediately re-sign in
 * anonymously so cloud save keeps working under a fresh device uid.
 */
export async function signOut(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await FirebaseAuthentication.signOut();
    }
    await fbSignOut(getFirebaseAuth());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] sign-out failed', err);
  }
  // Re-create an anonymous identity so saves continue to mirror.
  await ensureAnonymous();
}
