/**
 * Runway-category gating (BRD §4.2 / §4.3).
 *
 * Airports carry a runway category (1..4). Bigger aircraft need
 * bigger fields:
 *   cat 1: T1 regional turboprops only (none in the current top set)
 *   cat 2: up to T2 regional jets
 *   cat 3: up to T6 modern wide-bodies
 *   cat 4: anything (T7-T8 mega-liners + cargo)
 *
 * Our airport dataset only ships categories 2 (medium airports) and
 * 4 (large airports). So:
 *   - Medium airports take T1-T6 passenger aircraft.
 *   - Large airports take everything.
 *   - Cargo aircraft always require category 4 (their footprint and
 *     ground-handling needs go beyond passenger equivalents).
 */
import type { AircraftDef } from './types';

export function minRunwayForAircraft(def: AircraftDef): number {
  if (def.category === 'cargo') return 4;
  if (def.tier >= 7) return 4;
  if (def.tier >= 3) return 3;
  return 2;
}

export function airportSupportsAircraft(
  airportRunwayCategory: number,
  def: AircraftDef,
): boolean {
  return airportRunwayCategory >= minRunwayForAircraft(def);
}
