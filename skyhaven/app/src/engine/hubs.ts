/**
 * Hubs (BRD §4.3 + §13.3 Remote Config `hub_bonus_per_level`).
 *
 * Any airport carrying ≥ 2 of the player's routes can be promoted to a
 * Hub. Hubs are leveled; each level grants `HUB_BONUS_PER_LEVEL` to the
 * revenue of every connected route. When both ends of a route are hubs,
 * their bonuses sum.
 *
 * Creation cost scales with the airport's size tier; level-up cost
 * compounds 1.7× per level off a tier-tied base.
 */

import { loadTopAirports } from '../data/airports';
import type { Hub, SaveState } from './types';

/** Per-level network bonus. Tunable via Remote Config `hub_bonus_per_level`. */
export const HUB_BONUS_PER_LEVEL = 0.05;

export const MAX_HUB_LEVEL = 10;

/** Initial hub creation cost by airport size tier. */
function creationCostForSizeTier(sizeTier: number): number {
  switch (sizeTier) {
    case 4: return 50_000;
    case 2: return 20_000;
    default: return 10_000;
  }
}

export function hubCreationCost(iata: string): number {
  const airport = loadTopAirports().find((a) => a.iata === iata);
  return airport ? creationCostForSizeTier(airport.sizeTier) : 25_000;
}

/** Cost to advance an existing hub from `level` to `level + 1`. */
export function hubUpgradeCost(iata: string, currentLevel: number): number {
  if (currentLevel >= MAX_HUB_LEVEL) return Number.POSITIVE_INFINITY;
  const base = hubCreationCost(iata);
  return Math.round(base * Math.pow(1.7, currentLevel));
}

/** Count of player routes touching `iata` (either end). */
export function routesAtAirport(state: SaveState, iata: string): number {
  let n = 0;
  for (const r of state.routes) {
    if (r.originIata === iata || r.destIata === iata) n++;
  }
  return n;
}

/** Total network bonus multiplier for a route given the current hubs. */
export function networkBonusForRoute(
  hubs: readonly Hub[],
  originIata: string,
  destIata: string,
): number {
  let bonus = 0;
  for (const h of hubs) {
    if (h.iata === originIata || h.iata === destIata) {
      bonus += h.level * HUB_BONUS_PER_LEVEL;
    }
  }
  return bonus;
}

export function emptyHubManagers(): Hub['managers'] {
  return {
    hubDirector: false,
    maintenanceChief: false,
    logisticsDirector: false,
    fleetEngineer: false,
    marketingLead: false,
    crisisManager: false,
  };
}
