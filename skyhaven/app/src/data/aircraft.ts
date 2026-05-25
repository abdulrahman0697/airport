/**
 * Aircraft definitions.
 *
 * Phase 2 ships Tier-1 only (a single regional turboprop) to anchor the
 * starting state. Phase 3 fills Tiers 1–4. Tiers 5–8 and Cargo follow
 * in Phase 7; Classics in Phase 8.
 *
 * Costs and `basePurchaseCost` are economy-tunable via Remote Config
 * (BRD §4.13). The values here are seed defaults; live tuning overrides
 * them at runtime.
 *
 * `cruiseSpeedKmh` is a *game-time* speed — distance / cruiseSpeedKmh
 * gives a *game-hour* duration that is then compressed by the engine's
 * TIME_COMPRESSION factor into real seconds.
 */
import type { AircraftDef } from '../engine/types';

export const AIRCRAFT_DEFS: readonly AircraftDef[] = [
  {
    id: 't1.atr42',
    displayName: 'Regional Turboprop',
    tier: 1,
    category: 'passenger',
    capacity: 50,
    rangeKm: 1500,
    cruiseSpeedKmh: 500,
    fuelPerHour: 300,
    basePurchaseCost: 25_000,
    conditionDecayRate: 0.5,
    artId: 'placeholder.t1.atr42',
  },
];

const BY_ID = new Map(AIRCRAFT_DEFS.map((a) => [a.id, a]));

export function getAircraftDef(id: string): AircraftDef | undefined {
  return BY_ID.get(id);
}
