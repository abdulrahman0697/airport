/**
 * Aircraft condition decay + repair (BRD §4.2).
 *
 * Decay is applied per-leg in `tick.ts`:
 *   delta = def.conditionDecayRate × gameHoursThisLeg
 *
 * Repair cost scales with both the aircraft tier (more expensive types
 * cost more to fix) and how degraded the aircraft is. Tuned as texture —
 * a single repair never breaks the bank.
 */
import { getAircraftDef } from '../data/aircraft';
import { TUNING } from './tuning';
import type { OwnedAircraft } from './types';

/** Maximum fraction of purchase cost a fully-decayed (0%) repair charges. */
const FULL_REPAIR_FRACTION = 0.08;

export function repairCost(aircraft: OwnedAircraft): number {
  if (aircraft.condition >= 100) return 0;
  const def = getAircraftDef(aircraft.defId);
  if (!def) return 0;
  const missingFraction = (100 - aircraft.condition) / 100;
  return Math.round(def.basePurchaseCost * FULL_REPAIR_FRACTION * missingFraction * TUNING.repairCostMult);
}

export type ConditionBand = 'normal' | 'degraded' | 'critical';

export function conditionBand(condition: number): ConditionBand {
  if (condition >= 70) return 'normal';
  if (condition >= 40) return 'degraded';
  return 'critical';
}

/** Aircraft is in any state needing attention (Phase 5 list filter chip). */
export function needsAttention(aircraft: OwnedAircraft): boolean {
  return aircraft.condition < 70;
}
