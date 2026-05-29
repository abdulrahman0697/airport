/**
 * validatePurchase (BRD §11.4) — server-side Google Play receipt check.
 *
 * The client (Play Billing) sends `{ productId, purchaseToken }` after a
 * purchase; we verify it against the Play Developer API before the app
 * grants the entitlement, so a forged/replayed purchase can't unlock
 * VIP or a cash pack. Consumables are acknowledged here; the client
 * consumes them via Billing so they can be re-bought.
 *
 * Owner setup (one-time): enable the Google Play Android Developer API
 * on the project, and grant this function's runtime service account
 * "View financial data / manage orders" access in the Play Console
 * (Users & permissions). Until then the function returns a clear
 * `failed-precondition` and the client keeps the purchase un-granted.
 *
 * The economy is client-authoritative (see leaderboards.ts), so this is
 * an anti-fraud gate on *whether a real purchase happened*, not a
 * server-side balance — the cash amount for packs is still computed
 * client-side from the player's live income.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { google } from 'googleapis';

const PACKAGE_NAME = 'com.skyhaven.tycoon';

/** Must match the Play Console product ids + client `iap.ts` catalogue. */
const VALID_PRODUCTS = new Set<string>([
  'vip_pass_7d',
  'cash_pack_5h',
  'cash_pack_10h',
  'cash_pack_24h',
  'cash_pack_50h',
  'cash_pack_100h',
  'cash_pack_300h',
]);

export const validatePurchase = onCall({ region: 'us-central1' }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');

  const data = req.data as { productId?: unknown; purchaseToken?: unknown } | undefined;
  const productId = typeof data?.productId === 'string' ? data.productId : '';
  const purchaseToken = typeof data?.purchaseToken === 'string' ? data.purchaseToken : '';
  if (!VALID_PRODUCTS.has(productId)) throw new HttpsError('invalid-argument', 'Unknown product');
  if (!purchaseToken) throw new HttpsError('invalid-argument', 'Missing purchaseToken');

  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const publisher = google.androidpublisher({ version: 'v3', auth });
    const res = await publisher.purchases.products.get({
      packageName: PACKAGE_NAME,
      productId,
      token: purchaseToken,
    });
    const p = res.data;

    // purchaseState: 0 = purchased, 1 = canceled, 2 = pending.
    if (p.purchaseState !== 0) {
      throw new HttpsError('failed-precondition', 'Purchase is not in the purchased state');
    }
    // Acknowledge once (acknowledgementState: 0 = not yet acknowledged).
    if (p.acknowledgementState === 0) {
      await publisher.purchases.products.acknowledge({
        packageName: PACKAGE_NAME,
        productId,
        token: purchaseToken,
        requestBody: {},
      });
    }
    return { ok: true, productId, orderId: p.orderId ?? null };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    // eslint-disable-next-line no-console
    console.error('[validatePurchase] verification failed', err);
    throw new HttpsError(
      'failed-precondition',
      'Could not verify the purchase (Play Developer API not configured yet?)',
    );
  }
});
