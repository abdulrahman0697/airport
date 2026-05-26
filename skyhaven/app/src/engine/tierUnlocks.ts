/**
 * Cumulative-earnings tier-unlock gates (BRD §6.1).
 *
 * Lifetime earnings drives the vertical power axis. The tick checks
 * after each revenue credit whether the player has crossed a threshold,
 * and `state.tierUnlocked` advances accordingly.
 *
 * T5 (wide-body) doubles as the cargo-lane unlock per BRD §4.5. The
 * higher tiers stretch out — by the time a player reaches T8 mega-
 * liners the airline is a global empire.
 */

export const TIER_UNLOCK_THRESHOLDS: Record<number, number> = {
  2: 50_000,
  3: 500_000,
  4: 5_000_000,
  5: 25_000_000,
  6: 150_000_000,
  7: 750_000_000,
  8: 4_000_000_000,
};

export const MAX_TIER = 8;

export function maxTierUnlockedFor(lifetimeEarnings: number, ceiling = MAX_TIER): number {
  let max = 1;
  for (let t = 2; t <= ceiling; t++) {
    const threshold = TIER_UNLOCK_THRESHOLDS[t];
    if (threshold !== undefined && lifetimeEarnings >= threshold) max = t;
    else break;
  }
  return max;
}
