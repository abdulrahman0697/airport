/**
 * AdMob configuration (Phase 15).
 *
 * Currently Google's official **test** ad units — these serve real test
 * ads with no account approval, so the full rewarded flow is exercisable
 * today. When the AdMob account is confirmed:
 *   1. Replace each unit id below with your live rewarded unit id.
 *   2. Set ADMOB_USING_TEST_IDS = false.
 *   3. Replace the APPLICATION_ID meta-data in
 *      android/app/src/main/AndroidManifest.xml with the real app id.
 */
import type { RewardedPlacement } from './ads';

/** Google sample app id (also hard-coded in AndroidManifest until live). */
export const ADMOB_APP_ID_TEST = 'ca-app-pub-3940256099942544~3347511713';

/** Google sample rewarded unit. */
const TEST_REWARDED = 'ca-app-pub-3940256099942544/5224354917';

export const ADMOB_USING_TEST_IDS = true;

/** Rewarded ad unit id per placement (all on the test unit for now). */
export const REWARDED_AD_UNITS: Record<RewardedPlacement, string> = {
  offline_double: TEST_REWARDED,
  fuel_fill: TEST_REWARDED,
  instant_yield: TEST_REWARDED,
  speed_up: TEST_REWARDED,
};
