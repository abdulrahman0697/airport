/**
 * Analytics (BRD §13). Thin, best-effort wrapper over Firebase Analytics.
 *
 * On native (Android) events go through `@capacitor-firebase/analytics`
 * (lazy-imported, like push). On web there's no GA measurementId in the
 * Android Firebase config, so we just trace in dev and no-op otherwise.
 * Never throws — telemetry must never break the game.
 *
 * Event + param names follow GA4 rules: snake_case, no reserved
 * (`firebase_`/`google_`/`ga_`) prefixes. The `track` helpers below are
 * the only sanctioned call surface so names/params stay consistent.
 */
import { Capacitor } from '@capacitor/core';

type Params = Record<string, string | number | boolean>;

const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false;

export function logEvent(name: string, params?: Params): void {
  if (!Capacitor.isNativePlatform()) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug('[analytics]', name, params ?? {});
    }
    return;
  }
  void (async () => {
    try {
      const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
      await FirebaseAnalytics.logEvent({ name, params: params ?? {} });
    } catch {
      /* best-effort */
    }
  })();
}

/** Sanctioned event vocabulary. Keep params small + low-cardinality. */
export const track = {
  appStart: (): void => logEvent('app_start'),

  // Progression milestones
  tierUnlocked: (tier: number): void => logEvent('tier_unlocked', { tier }),
  regionUnlocked: (regionId: number): void => logEvent('region_unlocked', { region_id: regionId }),
  achievementUnlocked: (id: string): void => logEvent('achievement_unlocked', { id }),
  vintageCollected: (id: string): void => logEvent('vintage_collected', { id }),

  // Economy actions
  aircraftPurchased: (defId: string, tier: number): void =>
    logEvent('aircraft_purchased', { def_id: defId, tier }),
  routeOpened: (): void => logEvent('route_opened'),
  routeClosed: (): void => logEvent('route_closed'),
  hubCreated: (): void => logEvent('hub_created'),
  hubUpgraded: (level: number): void => logEvent('hub_upgraded', { level }),
  managerHired: (kind: string): void => logEvent('manager_hired', { kind }),
  fuelContractSigned: (tier: number): void => logEvent('fuel_contract_signed', { tier }),

  // Retention
  dailyRewardClaimed: (day: number): void => logEvent('daily_reward_claimed', { day }),
  offlineSummary: (elapsedMs: number, earnings: number): void =>
    logEvent('offline_summary', { minutes: Math.round(elapsedMs / 60000), earnings: Math.round(earnings) }),
  offlineDoubled: (): void => logEvent('offline_doubled'),

  // Ads
  adOffer: (placement: string): void => logEvent('ad_offer_shown', { placement }),
  adStarted: (placement: string): void => logEvent('ad_started', { placement }),
  adRewarded: (placement: string): void => logEvent('ad_rewarded', { placement }),
  adDismissed: (placement: string): void => logEvent('ad_dismissed', { placement }),

  // IAP
  storeOpened: (): void => logEvent('store_opened'),
  iapStarted: (productId: string): void => logEvent('iap_purchase_started', { product_id: productId }),
  iapSuccess: (productId: string): void => logEvent('iap_purchase_success', { product_id: productId }),
  iapFailed: (productId: string): void => logEvent('iap_purchase_failed', { product_id: productId }),
  vipActivated: (): void => logEvent('vip_activated'),
};
