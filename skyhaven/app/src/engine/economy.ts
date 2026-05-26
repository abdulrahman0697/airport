/**
 * Economy formulas.
 *
 * All values are Remote-Config-tunable at runtime (BRD §4.13, §13.3).
 * The constants below are seed defaults; Phase 13 wires Remote Config.
 *
 * BRD §4.3 per-leg revenue:
 *   capacity × loadFactor × yieldPerSeatKm × distanceKm − landingFees
 *
 * Phase 5 multiplicative bonuses on top of the base:
 *  - **Route demand** — derived from the two airports' size tiers
 *    (`(originSize + destSize) / 8` ∈ [0..1]). High-demand routes earn
 *    a small per-leg yield boost; thin routes earn slightly less.
 *  - **Network bonus** — every Hub on either end of the route adds
 *    `hub.level × HUB_BONUS_PER_LEVEL` to the revenue multiplier.
 */

import { loadTopAirports } from '../data/airports';
import { networkBonusForRoute } from './hubs';
import type { Hub, OwnedAircraft, Route, RoutePricing } from './types';
import { getAircraftDef } from '../data/aircraft';

/** $/seat-km baseline before global yield multiplier. */
export const YIELD_PER_SEAT_KM = 0.10;

/** One-time per-route landing fee (placeholder; tunable). */
export const LANDING_FEE = 100;

/** Game-time : real-time compression. 1 game-hour = (3600/COMP) real seconds. */
export const TIME_COMPRESSION = 120;

/** Pricing → yield and base load multipliers. */
export const PRICING_MOD: Record<RoutePricing, { yield: number; load: number }> = {
  economy:  { yield: 0.80, load: 1.10 },
  balanced: { yield: 1.00, load: 1.00 },
  premium:  { yield: 1.40, load: 0.70 },
};

/** Real-time duration of one leg of a route, in milliseconds. */
export function legDurationMs(route: Route, aircraft: OwnedAircraft): number {
  const def = getAircraftDef(aircraft.defId);
  if (!def) return Number.POSITIVE_INFINITY;
  const speed = def.cruiseSpeedKmh * (1 + 0.05 * aircraft.upgrades.engine);
  const gameHours = route.distanceKm / speed;
  return (gameHours * 3600 * 1000) / TIME_COMPRESSION;
}

/** Cabin upgrades add 5% capacity per level. */
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

/**
 * Route demand on the [0..1] scale derived from the two airports' size
 * tiers. Range 4–8 maps to ~[0.25, 1.0] given current size tiers (1, 2, 4).
 * Cached upstream by callers that loop over many routes.
 */
export function routeDemand(originIata: string, destIata: string): number {
  const airports = loadTopAirports();
  const o = airports.find((a) => a.iata === originIata);
  const d = airports.find((a) => a.iata === destIata);
  if (!o || !d) return 0.5;
  const sum = o.sizeTier + d.sizeTier;
  // Linear: 2 → 0.25, 4 → 0.5, 6 → 0.75, 8 → 1.0
  return Math.max(0, Math.min(1, sum / 8));
}

/** Per-leg revenue with all multipliers applied. */
export function legRevenue(route: Route, aircraft: OwnedAircraft, hubs: readonly Hub[] = []): number {
  const cap = effectiveCapacity(aircraft);
  const yieldMul = PRICING_MOD[route.pricing].yield;
  const condMul = conditionRevenueMultiplier(aircraft.condition);
  const demand = routeDemand(route.originIata, route.destIata);
  // Thin routes earn slightly less; busy routes a small boost.
  const demandMul = 0.85 + 0.30 * demand;
  const networkMul = 1 + networkBonusForRoute(hubs, route.originIata, route.destIata);
  const gross = cap
    * route.loadFactor
    * YIELD_PER_SEAT_KM * yieldMul
    * route.distanceKm
    * condMul
    * demandMul
    * networkMul;
  return Math.max(0, gross - LANDING_FEE);
}

/** Cash earned per real-second for a single route at steady state. */
export function cashPerSecond(route: Route, aircraft: OwnedAircraft, hubs: readonly Hub[] = []): number {
  const ms = legDurationMs(route, aircraft);
  if (!isFinite(ms) || ms <= 0) return 0;
  return legRevenue(route, aircraft, hubs) / (ms / 1000);
}
