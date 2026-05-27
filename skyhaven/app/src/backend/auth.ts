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
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
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
 * Sign in with Google via the Firebase JS SDK.
 *
 * On the Android WebView `signInWithPopup` can't open a window, so we
 * fall back to `signInWithRedirect`. After redirect Firebase Auth
 * persists the result and re-emits the user via `onAuthStateChanged`
 * on next launch.
 *
 * Returns the new auth user (popup path) or null (redirect path —
 * resolution happens on the next launch).
 */
export async function signInWithGoogle(): Promise<AuthUser | null> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  try {
    const out = await signInWithPopup(auth, provider);
    return toAuthUser(out.user);
  } catch (err) {
    // Popup not supported (WebView) — fall back to redirect.
    try {
      await signInWithRedirect(auth, provider);
      return null;
    } catch (err2) {
      // eslint-disable-next-line no-console
      console.warn('[skyhaven] Google sign-in failed', err, err2);
      return null;
    }
  }
}

/**
 * Sign out of the current account and immediately re-sign in
 * anonymously so cloud save keeps working under a fresh device uid.
 */
export async function signOut(): Promise<void> {
  try {
    await fbSignOut(getFirebaseAuth());
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] sign-out failed', err);
  }
  // Re-create an anonymous identity so saves continue to mirror.
  await ensureAnonymous();
}
