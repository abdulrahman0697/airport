/**
 * Effective global yield + temporary boosts (monetization, Phase 15).
 *
 * Centralises the airline-wide revenue multiplier so the tick and the
 * income-estimate helpers agree. On top of the Vintage + Eco + Remote
 * Config base it folds in two time-boxed boosts:
 *   - **Speed-up** (rewarded ad): 2× revenue while active.
 *   - **VIP Pass** (IAP): +50% revenue while active.
 *
 * Both are stored as expiry timestamps on `SaveState` and compared
 * against the tick's `nowMs`, so determinism holds (time flows in via
 * TickContext, never read here directly).
 */
import { computeEcoScore, ecoRevenueBonus } from './eco';
import { TUNING } from './tuning';
import type { SaveState } from './types';
import { vintageGlobalYieldBonus } from './vintage';

export const SPEED_UP_MULT = 2;
export const VIP_REVENUE_MULT = 1.5;
export const VIP_FUEL_SUPPLY_MULT = 1.5;

export function isSpeedUpActive(s: SaveState, nowMs: number): boolean {
  return (s.speedUpUntilMs ?? 0) > nowMs;
}
export function isVipActive(s: SaveState, nowMs: number): boolean {
  return (s.vipUntilMs ?? 0) > nowMs;
}

/** Airline-wide revenue multiplier at `nowMs`, including all boosts. */
export function globalYieldMultFor(s: SaveState, nowMs: number): number {
  const eco = ecoRevenueBonus(computeEcoScore(s.fleet));
  let m = (1 + vintageGlobalYieldBonus(s.vintage) + eco) * TUNING.globalYieldMult;
  if (isSpeedUpActive(s, nowMs)) m *= SPEED_UP_MULT;
  if (isVipActive(s, nowMs)) m *= VIP_REVENUE_MULT;
  return m;
}
