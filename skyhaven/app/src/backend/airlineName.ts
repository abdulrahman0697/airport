/**
 * Airline-name uniqueness client (leaderboard integrity).
 *
 * Names must be globally unique. Enforcement is server-side via the
 * `checkAirlineName` / `claimAirlineName` callables (see
 * functions/src/airlineName.ts), which use a transaction over the
 * `airlineNames/{normalized}` reservation collection.
 *
 * Both helpers FAIL SAFE: if Firebase is unreachable (offline play, the
 * functions not yet deployed, emulator off), `checkAirlineName` reports
 * "available" and `claimAirlineName` reports success — so onboarding is
 * never hard-blocked by a backend outage. True uniqueness only holds
 * once the functions are deployed, which is the intended production path.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ensureAnonymous } from './auth';

function fns() { return getFunctions(undefined, 'us-central1'); }

/** Normalize a display name to its uniqueness key. MUST match the
 *  server's normalizeAirlineName exactly. */
export function normalizeAirlineName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface NameAvailability {
  /** True if the name is free (or already held by this player). */
  available: boolean;
  /** True when the check actually reached the server. */
  checked: boolean;
}

/** Probe whether an airline name is free. Fails safe to available. */
export async function checkAirlineName(name: string): Promise<NameAvailability> {
  if (!normalizeAirlineName(name)) return { available: false, checked: true };
  try {
    await ensureAnonymous();
    const fn = httpsCallable<{ name: string }, { available: boolean }>(fns(), 'checkAirlineName');
    const out = await fn({ name });
    return { available: !!out.data.available, checked: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] checkAirlineName failed (allowing)', err);
    return { available: true, checked: false };
  }
}

export type ClaimNameResult =
  | { ok: true; name: string; checked: boolean }
  | { ok: false; code: 'taken' | 'invalid'; message: string };

/** Atomically reserve a name for this player. Fails safe to ok. */
export async function claimAirlineName(name: string): Promise<ClaimNameResult> {
  if (!normalizeAirlineName(name)) {
    return { ok: false, code: 'invalid', message: 'Enter an airline name' };
  }
  try {
    await ensureAnonymous();
    const fn = httpsCallable<{ name: string }, { name: string }>(fns(), 'claimAirlineName');
    const out = await fn({ name });
    return { ok: true, name: out.data.name, checked: true };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? '';
    if (code.includes('already-exists')) {
      return { ok: false, code: 'taken', message: 'That airline name is already taken' };
    }
    // Network / not-deployed / offline → don't block onboarding.
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] claimAirlineName failed (allowing)', err);
    return { ok: true, name: name.trim(), checked: false };
  }
}
