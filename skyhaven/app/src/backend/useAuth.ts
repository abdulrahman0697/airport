/**
 * React hook over the auth subscription. Re-renders on sign-in /
 * sign-out so the Office panel's cloud-account card stays live.
 */
import { useEffect, useState } from 'react';
import { subscribeAuth, waitForAuthReady, type AuthUser } from './auth';

export function useAuth(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => subscribeAuth(setUser), []);
  return user;
}

/**
 * Like {@link useAuth} but also reports whether Firebase has finished
 * restoring a persisted session. `ready` stays false until the first
 * auth emission, so the UI can show a neutral "checking…" state instead
 * of flashing the signed-out prompt on every cold start.
 */
export function useAuthState(): { user: AuthUser | null; ready: boolean } {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = subscribeAuth(setUser);
    let active = true;
    void waitForAuthReady().then(() => { if (active) setReady(true); });
    return () => { active = false; unsub(); };
  }, []);
  return { user, ready };
}
