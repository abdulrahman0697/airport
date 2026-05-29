/**
 * In-app purchase service (Phase 15, Stage B).
 *
 * Single choke-point for the store. SIMULATED until Google Play Billing
 * is wired (product ids + Play Console listing are owner setup). The
 * simulated path resolves a purchase after a short delay so the store
 * is fully exercisable now; swapping in the native plugin is contained
 * to this file.
 *
 * No premium currency: each product grants directly. Cash packs are
 * sized in *hours of yield* (a backend detail) — the store surfaces the
 * resulting in-game cash, never the hour count.
 *
 * TODO(native): install the Play Billing Capacitor plugin, query real
 * localized prices (overriding `priceLabel`), and on a verified purchase
 * call the server-side validation Cloud Function before granting. Web
 * stays simulated.
 */
export type ProductKind = 'vip' | 'cash';

export interface IapProduct {
  id: string;
  kind: ProductKind;
  /** Cash packs only: hours of current yield to grant (backend detail). */
  hours?: number;
  /** Placeholder price; the real value comes from the store query. */
  priceLabel: string;
}

export const IAP_PRODUCTS: readonly IapProduct[] = [
  { id: 'vip_pass_7d', kind: 'vip', priceLabel: '$4.99' },
  { id: 'cash_pack_5h', kind: 'cash', hours: 5, priceLabel: '$0.99' },
  { id: 'cash_pack_10h', kind: 'cash', hours: 10, priceLabel: '$1.99' },
  { id: 'cash_pack_24h', kind: 'cash', hours: 24, priceLabel: '$3.99' },
  { id: 'cash_pack_50h', kind: 'cash', hours: 50, priceLabel: '$6.99' },
  { id: 'cash_pack_100h', kind: 'cash', hours: 100, priceLabel: '$11.99' },
  { id: 'cash_pack_300h', kind: 'cash', hours: 300, priceLabel: '$24.99' },
];

/** True while billing is the simulated stand-in (no native plugin yet). */
export const IAP_SIMULATED = true;

let busy = false;

/** Returns true if the purchase completed (and was server-validated, once wired). */
export async function purchaseProduct(_id: string): Promise<boolean> {
  if (busy) return false;
  busy = true;
  try {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return true;
  } catch {
    return false;
  } finally {
    busy = false;
  }
}

/** Restore previously-owned non-consumables (VIP). Returns owned product ids. */
export async function restorePurchases(): Promise<string[]> {
  // Native: query owned entitlements from Play and re-apply. Simulated: none.
  return [];
}
