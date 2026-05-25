/**
 * Economy formulas.
 *
 * All values are Remote-Config-tunable at runtime (BRD §4.13, §13.3).
 * The constants below are seed defaults; Phase 13 wires Remote Config.
 *
 * BRD §4.3 per-leg revenue:
 *   capacity × loadFactor × yieldPerSeatKm × distanceKm − landingFees
 * Fuel cost is handled by the supply system (Phase 4), not per-leg.
 */

import type { OwnedAircraft, Route, RoutePricing } from './types';
import { getAircraftDef } from '../data/aircraft';

/** $/seat-km baseline before global yield multiplier. */
export const YIELD_PER_SEAT_KM = 0.10;

/** One-time per-route landing fee (placeholder; Phase 5 makes it distance-tiered). */
export const LANDING_FEE = 100;

/** Game-time : real-time compression. 1 game-hour = (3600/COMP) real seconds. */
export const TIME_COMPRESSION = 120;

/** Pricing → (yield multiplier, load-factor multiplier). */
export const PRICING_MOD: Record<RoutePricing, { yield: number; load: number }> = {
  economy:  { yield: 0.80, load: 1.10 },
  balanced: { yield: 1.00, load: 1.00 },
  premium:  { yield: 1.40, load: 0.70 },
};

/** Real-time duration of one leg of a route, in milliseconds. */
export function legDurationMs(route: Route, aircraft: OwnedAircraft): number {
  const def = getAircraftDef(aircraft.defId);
  if (!def) return Number.POSITIVE_INFINITY;
  // Engine upgrades (Phase 3) lift effective cruise speed by 5% per level.
  const speed = def.cruiseSpeedKmh * (1 + 0.05 * aircraft.upgrades.engine);
  const gameHours = route.distanceKm / speed;
  return (gameHours * 3600 * 1000) / TIME_COMPRESSION;
}

/** Cabin upgrades (Phase 3) add 5% capacity per level. */
export function effectiveCapacity(aircraft: OwnedAircraft): number {
  const def = getAircraftDef(aircraft.defId);
  if (!def) return 0;
  return def.capacity * (1 + 0.05 * aircraft.upgrades.cabin);
}

/** Condition penalty to per-leg revenue per BRD §4.2. */
export function conditionRevenueMultiplier(condition: number): number {
  if (condition >= 70) return 1.0;
  if (condition >= 40) return 0.9;
  return 0.65;
}

/** Per-leg revenue with all multipliers applied. */
export function legRevenue(route: Route, aircraft: OwnedAircraft): number {
  const cap = effectiveCapacity(aircraft);
  const yieldMul = PRICING_MOD[route.pricing].yield;
  const condMul = conditionRevenueMultiplier(aircraft.condition);
  const gross = cap * route.loadFactor * YIELD_PER_SEAT_KM * yieldMul * route.distanceKm * condMul;
  return Math.max(0, gross - LANDING_FEE);
}

/** Cash earned per real-second for a single route at steady state. */
export function cashPerSecond(route: Route, aircraft: OwnedAircraft): number {
  const ms = legDurationMs(route, aircraft);
  if (!isFinite(ms) || ms <= 0) return 0;
  return legRevenue(route, aircraft) / (ms / 1000);
}
