/**
 * Fuel demand calculation and reserve evolution (BRD §4.6).
 *
 * Demand: the sum of per-second burn for every aircraft currently
 * assigned to a route and not grounded by zero condition. Fuel Eff
 * upgrades cut a plane's burn by 10% per level (max V → 50%).
 *
 * Reserve evolves linearly in the absence of fuel-runout events:
 *   reserve(t) = clamp(reserve_0 + (supply − demand) × t, 0, capacity)
 *
 * Under the locked strict-gate rule (BRD planning), supply ≥ demand at
 * all times in normal play, so net rate is ≥ 0 and the reserve only
 * fills. Negative net rates can arise from Phase 6 events (fuel-price
 * spike) — the math handles them but the empty-reserve grounded path
 * is exercised only there.
 *
 * Time units: `fuelPerHour` is per game-hour of flight (matches BRD
 * §17.2 schema and the cruise speed convention). With TIME_COMPRESSION
 * (= 120) one real-second of play = 120/3600 = 1/30 game-hour, so the
 * per-real-second burn rate is `fuelPerHour / 30`.
 */
import { getAircraftDef } from '../data/aircraft';
import { TIME_COMPRESSION } from './economy';
import type { OwnedAircraft, SaveState } from './types';

const REAL_SEC_PER_GAME_HOUR = 3600 / TIME_COMPRESSION;

/** Per-real-second fuel burn for one aircraft. */
export function aircraftBurnRate(aircraft: OwnedAircraft): number {
  const def = getAircraftDef(aircraft.defId);
  if (!def) return 0;
  const eff = Math.max(0, 1 - 0.1 * aircraft.upgrades.fuelEff);
  return (def.fuelPerHour / REAL_SEC_PER_GAME_HOUR) * eff;
}

/** Sum of fuel burn across the active fleet (per real-second). */
export function totalDemand(state: SaveState): number {
  let demand = 0;
  for (const a of state.fleet) {
    if (a.routeId === null) continue;
    if (a.condition <= 0) continue;
    demand += aircraftBurnRate(a);
  }
  return demand;
}

/** Whether the airline has fuel headroom to add a new burn rate. */
export function hasFuelHeadroom(state: SaveState, additionalBurn: number): boolean {
  return state.fuel.demandRate + additionalBurn <= state.fuel.supplyRate + 1e-9;
}

/**
 * Recompute `state.fuel.demandRate` from the fleet. Call after any
 * action that changes which aircraft are flying or modifies fuelEff.
 */
export function withRecomputedDemand(state: SaveState): SaveState {
  const demand = totalDemand(state);
  if (demand === state.fuel.demandRate) return state;
  return { ...state, fuel: { ...state.fuel, demandRate: demand } };
}
