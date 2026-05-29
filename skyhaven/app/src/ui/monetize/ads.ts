/**
 * Rewarded-ad service (Phase 15).
 *
 * Single choke-point for showing a rewarded video. Returns whether the
 * player earned the reward (watched to completion) vs dismissed it.
 *
 * Currently SIMULATED: there's no native ad SDK wired yet (AdMob account
 * + unit IDs are an owner setup step). The simulated path resolves
 * `true` after a short "loading" delay so every placement is fully
 * playable and testable now. When the SDK lands this is the only file
 * that changes.
 *
 * TODO(native): install `@capacitor-community/admob`, configure the app
 * id + rewarded unit ids, and replace the simulated branch with
 * `AdMob.prepareRewardVideoAd()` + `AdMob.showRewardVideoAd()`, resolving
 * on the `adReward` event. Web/dev stays simulated. Interstitials are
 * intentionally NOT implemented (kept off per design); the placement
 * vocabulary leaves room to add them later.
 */
import { track } from '../../backend/analytics';

export type RewardedPlacement =
  | 'offline_double'
  | 'fuel_fill'
  | 'instant_yield'
  | 'speed_up';

/** True while real ads aren't wired — UI can show a subtle "demo" hint. */
export const ADS_SIMULATED = true;

let showing = false;

export async function showRewardedAd(placement: RewardedPlacement): Promise<boolean> {
  if (showing) return false; // never stack ads
  showing = true;
  track.adStarted(placement);
  try {
    // Simulated watch. Real SDK call goes here.
    await new Promise((resolve) => setTimeout(resolve, 700));
    track.adRewarded(placement);
    return true;
  } catch {
    track.adDismissed(placement);
    return false;
  } finally {
    showing = false;
  }
}
