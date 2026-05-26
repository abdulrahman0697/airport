/**
 * Region definitions (BRD §4.4).
 *
 * 9 regions, each cash-unlockable. Players start in their home region
 * (Europe by default — the Phase-2 initialState seeds the starter route
 * there). Unlock costs roughly track the lifetime-earnings curve so a
 * player crossing each tier-unlock threshold finds the next region
 * within reach.
 */

export interface RegionDef {
  readonly id: number;
  readonly name: string;
  readonly unlockCost: number;
}

export const REGIONS: readonly RegionDef[] = [
  { id: 1, name: 'North America',  unlockCost: 250_000 },
  { id: 2, name: 'Latin America',  unlockCost: 750_000 },
  { id: 3, name: 'Europe',         unlockCost: 0 }, // starter
  { id: 4, name: 'Middle East',    unlockCost: 2_000_000 },
  { id: 5, name: 'Africa',         unlockCost: 5_000_000 },
  { id: 6, name: 'South Asia',     unlockCost: 10_000_000 },
  { id: 7, name: 'East Asia',      unlockCost: 25_000_000 },
  { id: 8, name: 'Southeast Asia', unlockCost: 50_000_000 },
  { id: 9, name: 'Oceania',        unlockCost: 100_000_000 },
];

const BY_ID = new Map(REGIONS.map((r) => [r.id, r]));
export function getRegion(id: number): RegionDef | undefined {
  return BY_ID.get(id);
}
