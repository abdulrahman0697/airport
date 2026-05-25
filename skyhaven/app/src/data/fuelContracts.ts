/**
 * Fuel contracts (BRD §4.6).
 *
 * Each contract is a *one-time* cash purchase that permanently raises
 * the airline's fuel supply rate. The starter contract is granted for
 * free in `initialState.ts`.
 *
 * Tier costs follow a roughly 5–6× growth so they remain a perpetual
 * cash sink as the player tiers up. Supply rates target whole-fleet
 * burn at the relevant tier — e.g. tier-3 supply (60/s) carries a small
 * fleet of regional jets; tier-6 carries a full long-haul operation.
 */

export interface FuelContractDef {
  readonly id: string;
  readonly name: string;
  /** Fuel units delivered per real-second. */
  readonly supplyRatePerSec: number;
  /** One-time cost in cash. 0 for the free starter. */
  readonly cost: number;
  /** Sort order in the UI list. */
  readonly tier: number;
}

export const FUEL_CONTRACTS: readonly FuelContractDef[] = [
  { id: 'fc.starter',       name: 'Starter Supply',         supplyRatePerSec: 15,     cost: 0,             tier: 0 },
  { id: 'fc.local',         name: 'Local Refinery',         supplyRatePerSec: 30,     cost: 8_000,         tier: 1 },
  { id: 'fc.regional',      name: 'Regional Supplier',      supplyRatePerSec: 75,     cost: 35_000,        tier: 2 },
  { id: 'fc.national',      name: 'National Distributor',   supplyRatePerSec: 180,    cost: 200_000,       tier: 3 },
  { id: 'fc.continental',   name: 'Continental Wholesale',  supplyRatePerSec: 450,    cost: 1_200_000,     tier: 4 },
  { id: 'fc.global',        name: 'Global Trading Desk',    supplyRatePerSec: 1_100,  cost: 8_000_000,     tier: 5 },
  { id: 'fc.energy',        name: 'Energy Conglomerate',    supplyRatePerSec: 2_700,  cost: 55_000_000,    tier: 6 },
  { id: 'fc.petrochemical', name: 'Petrochemical Empire',   supplyRatePerSec: 6_500,  cost: 350_000_000,   tier: 7 },
];

const BY_ID = new Map(FUEL_CONTRACTS.map((c) => [c.id, c]));

export function getFuelContract(id: string): FuelContractDef | undefined {
  return BY_ID.get(id);
}
