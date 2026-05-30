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
import { TUNING } from './tuning';
import type { Hub, SaveState } from './types';

/** Per-level network bonus default. The live value is `TUNING.hubBonusPerLevel`,
 *  overridable via Remote Config `hub_bonus_per_level`. */
export const HUB_BONUS_PER_LEVEL = 0.05;

export const MAX_HUB_LEVEL = 10;

/**
 * Fleet-slot capacity of a hub by level (anti-swarm lever).
 *
 * Every aircraft is based at a home hub; a hub can only host so many.
 * Capacity = FLEET_SLOTS_BASE + FLEET_SLOTS_PER_LEVEL × level, so:
 *   L1 = 7 · L5 = 15 · L10 = 25 slots.
 * Leveling a hub both boosts route revenue (network bonus) AND unlocks
 * more fleet slots, so hub investment — not cheap-plane spam — is the
 * path to a bigger airline. Remote-Config-tunable like other tuning.
 */
export const FLEET_SLOTS_BASE = 5;
export const FLEET_SLOTS_PER_LEVEL = 2;
export function fleetSlotsForLevel(level: number): number {
  return FLEET_SLOTS_BASE + FLEET_SLOTS_PER_LEVEL * Math.max(1, level);
}

/** Number of aircraft currently based at `iata`. */
export function fleetCountAtHub(state: SaveState, iata: string): number {
  let n = 0;
  for (const a of state.fleet) {
    if (a.homeHubIata === iata) n++;
  }
  return n;
}

/** Total fleet slots a hub provides, or 0 if it isn't a hub. */
export function fleetSlotsAtHub(state: SaveState, iata: string): number {
  const hub = state.hubs.find((h) => h.iata === iata);
  return hub ? fleetSlotsForLevel(hub.level) : 0;
}

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

/**
 * Each additional hub costs more than the last, so sprawl competes
 * fairly with leveling an existing hub. The Nth paid hub multiplies the
 * size-tier base by HUB_CREATION_COST_GROWTH^(N-1):
 *
 *   1st hub  free (the starting foothold)
 *   2nd hub  base × 1.6^0 = 1.0×
 *   3rd hub  base × 1.6^1 = 1.6×
 *   4th hub  base × 1.6^2 = 2.56×  …
 *
 * `existingHubCount` is how many hubs the player already owns. This
 * multiplier applies ONLY to creation — `hubUpgradeCost` keeps using the
 * flat size-tier base so leveling never inflates with hub count.
 */
export const HUB_CREATION_COST_GROWTH = 1.6;

export function hubCreationCostScaled(iata: string, existingHubCount: number): number {
  if (existingHubCount <= 0) return 0; // first hub is free
  const base = hubCreationCost(iata);
  return Math.round(base * Math.pow(HUB_CREATION_COST_GROWTH, existingHubCount - 1));
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
      bonus += h.level * TUNING.hubBonusPerLevel;
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
