/**
 * Fuel demand calculation and reserve evolution (BRD §4.6).
 *
 * Demand: the sum of per-second burn for every aircraft currently
 * assigned to a route and not grounded by zero condition. Fuel Eff
 * upgrades cut a plane's burn by 10% per level (max V → 50%).
 *
 * Phase 6: a Logistics Director hired at a hub cuts the burn rate of
 * every aircraft assigned to a route touching that hub by 25% (BRD
 * §4.11 acceptance criterion).
 *
 * Reserve evolves linearly in the absence of fuel-runout events:
 *   reserve(t) = clamp(reserve_0 + (supply − demand) × t, 0, capacity)
 */
import { getAircraftDef } from '../data/aircraft';
import { TIME_COMPRESSION } from './economy';
import {
  LOGISTICS_DIRECTOR_FUEL_MULT,
  aircraftHasLogisticsDirector,
} from './managers';
import type { Hub, OwnedAircraft, Route, SaveState } from './types';

const REAL_SEC_PER_GAME_HOUR = 3600 / TIME_COMPRESSION;

/** Per-real-second fuel burn for one aircraft (no manager effects). */
export function aircraftBurnRate(aircraft: OwnedAircraft): number {
  const def = getAircraftDef(aircraft.defId);
  if (!def) return 0;
  const eff = Math.max(0, 1 - 0.1 * aircraft.upgrades.fuelEff);
  return (def.fuelPerHour / REAL_SEC_PER_GAME_HOUR) * eff;
}

/** Per-real-second burn for one aircraft *with* manager effects applied. */
export function aircraftEffectiveBurn(
  aircraft: OwnedAircraft,
  routes: readonly Route[],
  hubs: readonly Hub[],
): number {
  let burn = aircraftBurnRate(aircraft);
  if (aircraftHasLogisticsDirector(aircraft.routeId, routes, hubs)) {
    burn *= LOGISTICS_DIRECTOR_FUEL_MULT;
  }
  return burn;
}

/** Sum of fuel burn across the active fleet (per real-second). */
export function totalDemand(state: SaveState): number {
  let demand = 0;
  for (const a of state.fleet) {
    if (a.routeId === null) continue;
    if (a.condition <= 0) continue;
    demand += aircraftEffectiveBurn(a, state.routes, state.hubs);
  }
  return demand;
}

/** Whether the airline has fuel headroom to add a new burn rate. */
export function hasFuelHeadroom(state: SaveState, additionalBurn: number): boolean {
  return state.fuel.demandRate + additionalBurn <= state.fuel.supplyRate + 1e-9;
}

/**
 * Recompute `state.fuel.demandRate` from the fleet. Call after any
 * action that changes which aircraft are flying or modifies fuelEff,
 * Logistics Director status, or hub membership.
 */
export function withRecomputedDemand(state: SaveState): SaveState {
  const demand = totalDemand(state);
  if (demand === state.fuel.demandRate) return state;
  return { ...state, fuel: { ...state.fuel, demandRate: demand } };
}
