/**
 * Purchase validation client (Phase 15).
 *
 * Calls the `validatePurchase` Cloud Function with the Play Billing
 * `{ productId, purchaseToken }` so a purchase is server-verified before
 * the app grants the entitlement. Best-effort: returns false on any
 * error (the caller then declines to grant).
 *
 * Wire into the native Play Billing flow once that plugin is added:
 *   const { productId, purchaseToken } = await billing.purchase(id);
 *   if (await validatePurchase(productId, purchaseToken)) grant();
 */
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from './firebase';

export async function validatePurchase(productId: string, purchaseToken: string): Promise<boolean> {
  try {
    const fn = httpsCallable<{ productId: string; purchaseToken: string }, { ok?: boolean }>(
      getFirebaseFunctions(),
      'validatePurchase',
    );
    const res = await fn({ productId, purchaseToken });
    return res.data?.ok === true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] purchase validation failed', err);
    return false;
  }
}
