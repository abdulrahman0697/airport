/**
 * Airport dataset accessors.
 * - `loadTopAirports`: ~500 large airports bundled with the main chunk.
 * - `loadAllAirports`: ~3,000 airport full set, dynamically imported on demand.
 *
 * Both are CC0 (OurAirports). Regenerate via `scripts/build-airports.mjs`.
 */

export interface Airport {
  readonly iata: string;
  readonly lat: number;
  readonly lon: number;
  readonly city: string;
  readonly country: string;
  /** Region id 1..9 per BRD §4.4. */
  readonly region: number;
  /** 1..5 (5 = largest international); drives demand. */
  readonly sizeTier: number;
  /** 1..4 (4 = supports Mega-Liner). */
  readonly runwayCategory: number;
}

import topData from './airports.top.json' with { type: 'json' };

const TOP: readonly Airport[] = topData as readonly Airport[];

export function loadTopAirports(): readonly Airport[] {
  return TOP;
}

let fullCache: readonly Airport[] | null = null;
export async function loadAllAirports(): Promise<readonly Airport[]> {
  if (fullCache) return fullCache;
  const mod = await import('./airports.full.json', { with: { type: 'json' } });
  fullCache = mod.default as readonly Airport[];
  return fullCache;
}
