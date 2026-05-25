/**
 * Cumulative-earnings tier-unlock gates (BRD §6.1).
 *
 * Lifetime earnings drives the vertical power axis. The tick checks
 * after each revenue credit whether the player has crossed a threshold,
 * and `state.tierUnlocked` advances accordingly.
 *
 * Phase 3 ships gates for T2–T4. T5 (wide-body / cargo) lands in
 * Phase 7; T6–T8 + classics follow.
 */

export const TIER_UNLOCK_THRESHOLDS: Record<number, number> = {
  2: 50_000,
  3: 500_000,
  4: 5_000_000,
};

export function maxTierUnlockedFor(lifetimeEarnings: number, ceiling = 4): number {
  let max = 1;
  for (let t = 2; t <= ceiling; t++) {
    const threshold = TIER_UNLOCK_THRESHOLDS[t];
    if (threshold !== undefined && lifetimeEarnings >= threshold) max = t;
    else break;
  }
  return max;
}
