/**
 * Rewarded-ad service (Phase 15).
 *
 * Native (Android): real Google AdMob rewarded video via
 * `@capacitor-community/admob` (lazy-imported, native-only). Web/dev:
 * a simulated watch so the flow stays exercisable in the browser.
 *
 * Ad unit ids live in `adsConfig.ts` — currently Google's TEST units
 * (real test ads, no account approval), swappable for live ids later.
 * Interstitials are intentionally not implemented (kept off); the
 * placement vocabulary leaves room to add them.
 */
import { Capacitor } from '@capacitor/core';
import { track } from '../../backend/analytics';
import { ADMOB_USING_TEST_IDS, REWARDED_AD_UNITS } from './adsConfig';

export type RewardedPlacement =
  | 'offline_double'
  | 'fuel_fill'
  | 'instant_yield'
  | 'speed_up';

let showing = false;
let initPromise: Promise<void> | null = null;

async function ensureAdMobInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const { AdMob } = await import('@capacitor-community/admob');
      await AdMob.initialize({ initializeForTesting: ADMOB_USING_TEST_IDS });
    })();
  }
  return initPromise;
}

async function showNativeRewarded(placement: RewardedPlacement): Promise<boolean> {
  const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');
  await ensureAdMobInit();
  let rewarded = false;
  const handle = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
    rewarded = true;
  });
  try {
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_UNITS[placement] });
    await AdMob.showRewardVideoAd();
  } finally {
    await handle.remove();
  }
  return rewarded;
}

/**
 * Show a rewarded ad for `placement`. Resolves true if the player earned
 * the reward (watched to completion), false if dismissed/failed.
 */
export async function showRewardedAd(placement: RewardedPlacement): Promise<boolean> {
  if (showing) return false; // never stack ads
  showing = true;
  track.adStarted(placement);
  try {
    const rewarded = Capacitor.isNativePlatform()
      ? await showNativeRewarded(placement)
      : await new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 700)); // web/dev sim
    if (rewarded) track.adRewarded(placement);
    else track.adDismissed(placement);
    return rewarded;
  } catch {
    track.adDismissed(placement);
    return false;
  } finally {
    showing = false;
  }
}
