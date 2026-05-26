/**
 * React hook over the auth subscription. Re-renders on sign-in /
 * sign-out so the Office panel's cloud-account card stays live.
 */
import { useEffect, useState } from 'react';
import { subscribeAuth, type AuthUser } from './auth';

export function useAuth(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => subscribeAuth(setUser), []);
  return user;
}
