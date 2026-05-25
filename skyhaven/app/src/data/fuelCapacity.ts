/**
 * Fuel capacity tiers (BRD §4.6).
 *
 * Each tier is the absolute reserve ceiling, *not* an increment. The
 * player upgrades through them sequentially; the cost is for the jump
 * to the named capacity. Designed so the reserve can hold roughly 1–2
 * game-hours of demand at the typical fleet size for that tier — a
 * comfortable buffer for fuel-price spike events without trivialising
 * the gate.
 */

export interface FuelCapacityTier {
  readonly level: number;
  readonly capacity: number;
  /** Cost to reach this level from the previous. Level 0 is free / starter. */
  readonly cost: number;
}

export const FUEL_CAPACITY_TIERS: readonly FuelCapacityTier[] = [
  { level: 0, capacity: 1_500,      cost: 0 },
  { level: 1, capacity: 4_000,      cost: 3_500 },
  { level: 2, capacity: 10_000,     cost: 18_000 },
  { level: 3, capacity: 28_000,     cost: 95_000 },
  { level: 4, capacity: 80_000,     cost: 600_000 },
  { level: 5, capacity: 250_000,    cost: 3_500_000 },
  { level: 6, capacity: 800_000,    cost: 25_000_000 },
  { level: 7, capacity: 2_500_000,  cost: 150_000_000 },
];

export function currentCapacityLevel(capacity: number): number {
  let best = 0;
  for (const t of FUEL_CAPACITY_TIERS) {
    if (capacity >= t.capacity) best = t.level;
  }
  return best;
}

export function nextCapacityTier(capacity: number): FuelCapacityTier | undefined {
  const cur = currentCapacityLevel(capacity);
  return FUEL_CAPACITY_TIERS[cur + 1];
}
