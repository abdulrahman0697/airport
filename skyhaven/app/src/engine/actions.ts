/**
 * Player actions — pure state transitions.
 *
 * Each action takes the current `SaveState` and returns a new state
 * with the action applied, or throws an `ActionError` when the action
 * is invalid (cash too low, tier locked, etc.). Throws are caught at
 * the store boundary and surfaced to the UI as toasts (Phase 5).
 *
 * The store invokes these actions imperatively. They are pure so the
 * Web Worker can run them (offline action sequences are still TBD).
 */
import { getAircraftDef } from '../data/aircraft';
import { loadTopAirports } from '../data/airports';
import { conditionBand } from './condition';
import { repairCost } from './condition';
import { haversineKm } from './distance';
import { upgradeCost, UPGRADE_SPECS, type UpgradeKind } from './upgrades';
import type { OwnedAircraft, Route, RoutePricing, SaveState } from './types';

export class ActionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

let nextAircraftUidCounter = 1;
let nextRouteUidCounter = 1;
function nextAircraftUid(state: SaveState): string {
  // Find the highest existing ac-NNNN number so a freshly-loaded save
  // doesn't recycle UIDs.
  for (const a of state.fleet) {
    const m = /^ac-(\d+)$/.exec(a.uid);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (n >= nextAircraftUidCounter) nextAircraftUidCounter = n + 1;
    }
  }
  return `ac-${String(nextAircraftUidCounter++).padStart(4, '0')}`;
}
function nextRouteUid(state: SaveState): string {
  for (const r of state.routes) {
    const m = /^rt-(\d+)$/.exec(r.id);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (n >= nextRouteUidCounter) nextRouteUidCounter = n + 1;
    }
  }
  return `rt-${String(nextRouteUidCounter++).padStart(4, '0')}`;
}

// ─── Buy aircraft ────────────────────────────────────────────────────
export function buyAircraft(state: SaveState, defId: string): SaveState {
  const def = getAircraftDef(defId);
  if (!def) throw new ActionError('UNKNOWN_AIRCRAFT', `No aircraft def ${defId}`);
  if (def.tier > state.tierUnlocked) {
    throw new ActionError('TIER_LOCKED', `Tier ${def.tier} not yet unlocked`);
  }
  if (state.cash < def.basePurchaseCost) {
    throw new ActionError('INSUFFICIENT_CASH',
      `Need $${def.basePurchaseCost.toLocaleString()}`);
  }
  const aircraft: OwnedAircraft = {
    uid: nextAircraftUid(state),
    defId,
    condition: 100,
    flightHoursAccumulated: 0,
    upgrades: { engine: 0, cabin: 0, fuelEff: 0, marketing: 0 },
    routeId: null,
  };
  return { ...state, cash: state.cash - def.basePurchaseCost, fleet: [...state.fleet, aircraft] };
}

// ─── Sell aircraft (for completeness; not surfaced in Phase 3 UI) ────
export function sellAircraft(state: SaveState, uid: string): SaveState {
  const idx = state.fleet.findIndex((a) => a.uid === uid);
  if (idx < 0) throw new ActionError('NO_AIRCRAFT', `No aircraft ${uid}`);
  const a = state.fleet[idx]!;
  if (a.routeId) throw new ActionError('AIRCRAFT_BUSY', 'Close the route first');
  const def = getAircraftDef(a.defId);
  if (!def) throw new ActionError('UNKNOWN_AIRCRAFT', `No def ${a.defId}`);
  const refund = Math.round(def.basePurchaseCost * 0.5 * (a.condition / 100));
  const fleet = state.fleet.slice();
  fleet.splice(idx, 1);
  return { ...state, cash: state.cash + refund, fleet };
}

// ─── Open route ──────────────────────────────────────────────────────
const ROUTE_OPEN_COST_PER_KM = 0.5;
const DESTINATION_SLOT_FEE = 200;
export function routeOpenCost(distanceKm: number): number {
  return Math.round(DESTINATION_SLOT_FEE + ROUTE_OPEN_COST_PER_KM * distanceKm);
}

export function openRoute(
  state: SaveState,
  originIata: string,
  destIata: string,
  aircraftUid: string,
  pricing: RoutePricing = 'balanced',
): SaveState {
  if (originIata === destIata) {
    throw new ActionError('SAME_AIRPORT', 'Origin and destination must differ');
  }
  const airports = loadTopAirports();
  const origin = airports.find((a) => a.iata === originIata);
  const dest = airports.find((a) => a.iata === destIata);
  if (!origin || !dest) throw new ActionError('UNKNOWN_AIRPORT', 'Airport not found');

  const aIdx = state.fleet.findIndex((a) => a.uid === aircraftUid);
  if (aIdx < 0) throw new ActionError('NO_AIRCRAFT', `No aircraft ${aircraftUid}`);
  const aircraft = state.fleet[aIdx]!;
  if (aircraft.routeId) throw new ActionError('AIRCRAFT_BUSY', 'Aircraft is on another route');

  const def = getAircraftDef(aircraft.defId);
  if (!def) throw new ActionError('UNKNOWN_AIRCRAFT', `No def ${aircraft.defId}`);

  const distanceKm = haversineKm(origin.lat, origin.lon, dest.lat, dest.lon);
  if (distanceKm > def.rangeKm) {
    throw new ActionError('OUT_OF_RANGE',
      `${def.displayName} max range ${def.rangeKm} km, route is ${Math.round(distanceKm)} km`);
  }

  const cost = routeOpenCost(distanceKm);
  if (state.cash < cost) {
    throw new ActionError('INSUFFICIENT_CASH', `Need $${cost.toLocaleString()} to open this route`);
  }

  const baseLoad = 0.55 + 0.03 * aircraft.upgrades.marketing;
  const route: Route = {
    id: nextRouteUid(state),
    originIata,
    destIata,
    distanceKm,
    aircraftUid,
    pricing,
    loadFactor: Math.min(0.98, baseLoad),
    legProgress: 0,
    legDirection: 'outbound',
  };

  const fleet = state.fleet.slice();
  fleet[aIdx] = { ...aircraft, routeId: route.id };

  return { ...state, cash: state.cash - cost, fleet, routes: [...state.routes, route] };
}

// ─── Close route ─────────────────────────────────────────────────────
export function closeRoute(state: SaveState, routeId: string): SaveState {
  const rIdx = state.routes.findIndex((r) => r.id === routeId);
  if (rIdx < 0) throw new ActionError('NO_ROUTE', `No route ${routeId}`);
  const route = state.routes[rIdx]!;
  const aIdx = state.fleet.findIndex((a) => a.uid === route.aircraftUid);
  const routes = state.routes.slice();
  routes.splice(rIdx, 1);
  const fleet = aIdx >= 0
    ? state.fleet.map((a, i) => (i === aIdx ? { ...a, routeId: null } : a))
    : state.fleet;
  return { ...state, fleet, routes };
}

// ─── Set route pricing ───────────────────────────────────────────────
const PRICING_LOAD_RECALC: Record<RoutePricing, number> = {
  economy: 1.10,
  balanced: 1.00,
  premium: 0.70,
};

export function setRoutePricing(state: SaveState, routeId: string, pricing: RoutePricing): SaveState {
  const rIdx = state.routes.findIndex((r) => r.id === routeId);
  if (rIdx < 0) throw new ActionError('NO_ROUTE', `No route ${routeId}`);
  const route = state.routes[rIdx]!;
  const aircraft = state.fleet.find((a) => a.uid === route.aircraftUid);
  const baseLoad = 0.55 + 0.03 * (aircraft?.upgrades.marketing ?? 0);
  const newLoad = Math.min(0.98, baseLoad * PRICING_LOAD_RECALC[pricing]);
  const routes = state.routes.slice();
  routes[rIdx] = { ...route, pricing, loadFactor: newLoad };
  return { ...state, routes };
}

// ─── Apply upgrade ───────────────────────────────────────────────────
export function applyUpgrade(state: SaveState, aircraftUid: string, kind: UpgradeKind): SaveState {
  const aIdx = state.fleet.findIndex((a) => a.uid === aircraftUid);
  if (aIdx < 0) throw new ActionError('NO_AIRCRAFT', `No aircraft ${aircraftUid}`);
  const aircraft = state.fleet[aIdx]!;
  const spec = UPGRADE_SPECS[kind];
  const curLevel = aircraft.upgrades[kind];
  if (curLevel >= spec.maxLevel) {
    throw new ActionError('UPGRADE_MAXED', `${kind} already at max level`);
  }
  const cost = upgradeCost(aircraft, kind);
  if (state.cash < cost) {
    throw new ActionError('INSUFFICIENT_CASH', `Need $${cost.toLocaleString()}`);
  }
  const fleet = state.fleet.slice();
  fleet[aIdx] = {
    ...aircraft,
    upgrades: { ...aircraft.upgrades, [kind]: curLevel + 1 },
  };

  // Marketing upgrades immediately bump the load factor on any active route.
  let routes = state.routes;
  if (kind === 'marketing' && aircraft.routeId) {
    const rIdx = routes.findIndex((r) => r.id === aircraft.routeId);
    if (rIdx >= 0) {
      const route = routes[rIdx]!;
      const baseLoad = 0.55 + 0.03 * (curLevel + 1);
      const newLoad = Math.min(0.98, baseLoad * (
        route.pricing === 'economy' ? 1.10
        : route.pricing === 'premium' ? 0.70
        : 1.00
      ));
      routes = routes.slice();
      routes[rIdx] = { ...route, loadFactor: newLoad };
    }
  }

  return { ...state, cash: state.cash - cost, fleet, routes };
}

// ─── Repair aircraft ─────────────────────────────────────────────────
export function repairAircraft(state: SaveState, aircraftUid: string): SaveState {
  const aIdx = state.fleet.findIndex((a) => a.uid === aircraftUid);
  if (aIdx < 0) throw new ActionError('NO_AIRCRAFT', `No aircraft ${aircraftUid}`);
  const aircraft = state.fleet[aIdx]!;
  if (aircraft.condition >= 100) return state; // no-op
  const cost = repairCost(aircraft);
  if (state.cash < cost) {
    throw new ActionError('INSUFFICIENT_CASH', `Need $${cost.toLocaleString()} to repair`);
  }
  const fleet = state.fleet.slice();
  fleet[aIdx] = { ...aircraft, condition: 100 };
  return { ...state, cash: state.cash - cost, fleet };
}

/** Convenience selector for the UI's "needs attention" badge. */
export function fleetSummary(state: SaveState): {
  total: number;
  needsAttention: number;
  grounded: number;
} {
  let needsAttention = 0;
  let grounded = 0;
  for (const a of state.fleet) {
    if (a.condition <= 0) grounded++;
    if (conditionBand(a.condition) !== 'normal') needsAttention++;
  }
  return { total: state.fleet.length, needsAttention, grounded };
}
