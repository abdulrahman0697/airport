/**
 * Manager effect helpers (BRD §4.11).
 *
 * Each function takes whatever subset of state it needs and returns
 * a boolean / multiplier. Effects are *hub-scoped*: a manager hired
 * at one hub only affects routes / aircraft tied to that hub.
 *
 * Convention: a route or aircraft "touches" a hub when the hub's
 * IATA matches the route's origin or destination.
 */
import type { Hub, Route } from './types';

/** Logistics Director's 25% hub fuel cut (BRD §4.11 acceptance). */
export const LOGISTICS_DIRECTOR_FUEL_MULT = 0.75;
/** Marketing Lead's load-factor bonus per hub. */
export const MARKETING_LEAD_LOAD_BONUS = 0.05;
/** Maintenance Chief auto-repair triggers when condition drops below this. */
export const MAINTENANCE_CHIEF_THRESHOLD = 50;
/** Crisis Manager's mitigation multiplier on negative-event impact. */
export const CRISIS_MANAGER_MITIGATION = 0.5;

/** True if any hub touching this route has the Marketing Lead. */
export function routeHasMarketingLead(route: Route, hubs: readonly Hub[]): boolean {
  for (const h of hubs) {
    if (!h.managers.marketingLead) continue;
    if (h.iata === route.originIata || h.iata === route.destIata) return true;
  }
  return false;
}

/** True if the aircraft's current route touches a Logistics-Director hub. */
export function aircraftHasLogisticsDirector(
  routeId: string | null,
  routes: readonly Route[],
  hubs: readonly Hub[],
): boolean {
  if (!routeId) return false;
  const route = routes.find((r) => r.id === routeId);
  if (!route) return false;
  for (const h of hubs) {
    if (!h.managers.logisticsDirector) continue;
    if (h.iata === route.originIata || h.iata === route.destIata) return true;
  }
  return false;
}

/** True if any hub touching this route has the Crisis Manager. */
export function routeHasCrisisManager(route: Route, hubs: readonly Hub[]): boolean {
  for (const h of hubs) {
    if (!h.managers.crisisManager) continue;
    if (h.iata === route.originIata || h.iata === route.destIata) return true;
  }
  return false;
}

/** Iterate hubs that have at least one of the requested managers. */
export function hubsWithManager<K extends keyof Hub['managers']>(
  hubs: readonly Hub[],
  kind: K,
): readonly Hub[] {
  return hubs.filter((h) => h.managers[kind]);
}
