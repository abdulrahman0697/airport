/**
 * Tier growth roadmap (Design Review v2 — points 7, 20).
 *
 * What physically appears at each airport tier. Shared between the
 * AirportPanel (which paints the current tier and the next-unlock
 * card) and HeroMoments (which announces the new addition when the
 * tier ratchets up).
 */
export interface TierGrowthRow {
  readonly tier: number;
  readonly label: string;
  /** Headline / category for the celebration card. */
  readonly era: string;
}

export const AIRPORT_GROWTH: readonly TierGrowthRow[] = [
  { tier: 1, label: 'One gate · one runway',                  era: 'Regional Operator' },
  { tier: 2, label: 'Cargo apron + second gate',              era: 'Regional+ Operator' },
  { tier: 3, label: 'Control tower',                          era: 'International Operator' },
  { tier: 4, label: 'Parking + ground service vehicles',      era: 'National Carrier' },
  { tier: 5, label: 'Premium lounge wing',                    era: 'International Airline' },
  { tier: 6, label: 'Second runway + skybridge',              era: 'Long-Haul Carrier' },
  { tier: 7, label: 'Metro / rail link',                      era: 'Global Hub Network' },
  { tier: 8, label: 'Airport hotel tower',                    era: 'Aviation Empire' },
];

export function growthFor(tier: number): TierGrowthRow | undefined {
  return AIRPORT_GROWTH[tier - 1];
}
