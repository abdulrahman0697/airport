/**
 * Eco Rating (BRD §4.10).
 *
 * A lightweight efficiency-reward system. The score rises with three
 * signals across the fleet:
 *  - average Fuel Eff upgrade level (max +50)
 *  - fraction of aircraft at Tier 4 or newer (max +35)
 *  - cargo-fleet fraction (max +15)
 *
 * The four tiers — Bronze / Silver / Gold / Platinum — each grant a
 * small revenue multiplier. Tone is factual; no preachy copy.
 */

import { getAircraftDef } from '../data/aircraft';
import type { OwnedAircraft } from './types';

export type EcoTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

export function computeEcoScore(fleet: readonly OwnedAircraft[]): number {
  if (fleet.length === 0) return 0;
  let fuelEffSum = 0;
  let modern = 0;
  let cargo = 0;
  let counted = 0;
  for (const a of fleet) {
    const def = getAircraftDef(a.defId);
    if (!def) continue;
    fuelEffSum += a.upgrades.fuelEff;
    if (def.category === 'cargo') cargo++;
    else if (def.tier >= 4) modern++;
    counted++;
  }
  if (counted === 0) return 0;
  const avgFuelEff = fuelEffSum / counted;
  const modernFrac = modern / counted;
  const cargoFrac = cargo / counted;
  return Math.min(100,
    (avgFuelEff / 5) * 50
    + modernFrac * 35
    + cargoFrac * 15);
}

interface TierBand {
  readonly tier: EcoTier;
  readonly min: number;
  readonly revenueBonus: number;
  readonly label: string;
  readonly color: string;
}

// Order matters: highest tier first so `ecoTier` returns the best match.
const TIER_BANDS: readonly TierBand[] = [
  { tier: 'platinum', min: 85, revenueBonus: 0.10, label: 'Platinum', color: '#E5E4E2' },
  { tier: 'gold',     min: 70, revenueBonus: 0.06, label: 'Gold',     color: '#F4C75B' },
  { tier: 'silver',   min: 50, revenueBonus: 0.03, label: 'Silver',   color: '#C0C0C8' },
  { tier: 'bronze',   min: 25, revenueBonus: 0.01, label: 'Bronze',   color: '#B08D57' },
];

export function ecoTier(score: number): EcoTier {
  for (const b of TIER_BANDS) if (score >= b.min) return b.tier;
  return 'none';
}

export function ecoRevenueBonus(score: number): number {
  for (const b of TIER_BANDS) if (score >= b.min) return b.revenueBonus;
  return 0;
}

export function ecoTierMeta(tier: EcoTier): { label: string; color: string; min: number; revenueBonus: number } | null {
  for (const b of TIER_BANDS) if (b.tier === tier) return { label: b.label, color: b.color, min: b.min, revenueBonus: b.revenueBonus };
  return null;
}

/** All tier definitions in ascending order, for UI rendering. */
export const ECO_TIERS: readonly TierBand[] = [...TIER_BANDS].reverse();
