/**
 * Player actions — pure state transitions.
 *
 * Each action takes the current `SaveState` and returns a new state
 * with the action applied, or throws an `ActionError` when the action
 * is invalid (cash too low, tier locked, fuel limit, etc.). Throws are
 * caught at the store boundary and surfaced to the UI as toasts.
 *
 * The store invokes these actions imperatively. They are pure so the
 * Web Worker can run them (offline action sequences are still TBD).
 */
import { getAircraftDef } from '../data/aircraft';
import { loadTopAirports } from '../data/airports';
import { FUEL_CAPACITY_TIERS, nextCapacityTier } from '../data/fuelCapacity';
import { FUEL_CONTRACTS, getFuelContract } from '../data/fuelContracts';
import { getManagerDef, managerCost, type ManagerKind } from '../data/managers';
import { getRegion, REGIONS } from '../data/regions';
import { conditionBand, repairCost } from './condition';
import { haversineKm } from './distance';
import { aircraftBurnRate, hasFuelHeadroom, withRecomputedDemand } from './fuel';
import {
  emptyHubManagers,
  hubCreationCost,
  hubUpgradeCost,
  MAX_HUB_LEVEL,
  routesAtAirport,
} from './hubs';
import { airportSupportsAircraft, minRunwayForAircraft } from './runway';
import { upgradeCost, UPGRADE_SPECS, type UpgradeKind } from './upgrades';
import type { Collectible, Hub, OwnedAircraft, Route, RoutePricing, SaveState } from './types';

export class ActionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

let nextAircraftUidCounter = 1;
let nextRouteUidCounter = 1;
function nextAircraftUid(state: SaveState): string {
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
  if (def.category === 'cargo') {
    // Cargo lane unlocks when the player first reaches T5 (BRD §4.5).
    if (state.tierUnlocked < 5) {
      throw new ActionError('CARGO_LOCKED', 'Cargo lane unlocks at Tier 5');
    }
  } else if (def.tier > state.tierUnlocked) {
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

// ─── Sell aircraft ───────────────────────────────────────────────────
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
  return withRecomputedDemand({ ...state, cash: state.cash + refund, fleet });
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

  // Region gate (BRD §4.4) — both endpoints must be in unlocked regions.
  for (const ap of [origin, dest]) {
    if (!state.unlockedRegions.includes(ap.region)) {
      const region = getRegion(ap.region);
      throw new ActionError(
        'REGION_LOCKED',
        `${region?.name ?? `Region ${ap.region}`} not yet unlocked`,
      );
    }
  }

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

  // Runway gate (BRD §4.2): both endpoints must accept this aircraft.
  if (!airportSupportsAircraft(origin.runwayCategory, def)) {
    throw new ActionError('RUNWAY_TOO_SMALL',
      `${origin.iata}'s runway can't take a ${def.displayName} (needs cat ${minRunwayForAircraft(def)})`);
  }
  if (!airportSupportsAircraft(dest.runwayCategory, def)) {
    throw new ActionError('RUNWAY_TOO_SMALL',
      `${dest.iata}'s runway can't take a ${def.displayName} (needs cat ${minRunwayForAircraft(def)})`);
  }

  // Strict fuel gate (BRD §4.6 + locked decision): block if opening this
  // route would push demand past supply.
  const burn = aircraftBurnRate(aircraft);
  if (!hasFuelHeadroom(state, burn)) {
    throw new ActionError(
      'FUEL_LIMIT',
      `Need ${burn.toFixed(1)} more fuel/sec — secure a new contract first`,
    );
  }

  const cost = routeOpenCost(distanceKm);
  if (state.cash < cost) {
    throw new ActionError('INSUFFICIENT_CASH', `Need $${cost.toLocaleString()} to open this route`);
  }

  // Cargo always ships full (BRD §4.5). Passenger uses the marketing
  // upgrade + initial-load curve we've used since Phase 3.
  const loadFactor = def.category === 'cargo'
    ? 1.0
    : Math.min(0.98, 0.55 + 0.03 * aircraft.upgrades.marketing);
  const route: Route = {
    id: nextRouteUid(state),
    originIata,
    destIata,
    distanceKm,
    aircraftUid,
    pricing,
    loadFactor,
    legProgress: 0,
    legDirection: 'outbound',
  };

  const fleet = state.fleet.slice();
  fleet[aIdx] = { ...aircraft, routeId: route.id };

  return withRecomputedDemand({
    ...state,
    cash: state.cash - cost,
    fleet,
    routes: [...state.routes, route],
  });
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
  return withRecomputedDemand({ ...state, fleet, routes });
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
  const def = aircraft ? getAircraftDef(aircraft.defId) : undefined;
  if (def?.category === 'cargo') {
    throw new ActionError('CARGO_NO_PRICING', 'Cargo routes ship full at a fixed rate');
  }
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

  const next = { ...state, cash: state.cash - cost, fleet, routes };
  // Fuel Eff lowers burn → recompute demand. Other upgrades are no-ops
  // for fuel but the helper short-circuits when the value is unchanged.
  return kind === 'fuelEff' ? withRecomputedDemand(next) : next;
}

// ─── Repair aircraft ─────────────────────────────────────────────────
export function repairAircraft(state: SaveState, aircraftUid: string): SaveState {
  const aIdx = state.fleet.findIndex((a) => a.uid === aircraftUid);
  if (aIdx < 0) throw new ActionError('NO_AIRCRAFT', `No aircraft ${aircraftUid}`);
  const aircraft = state.fleet[aIdx]!;
  if (aircraft.condition >= 100) return state;
  const cost = repairCost(aircraft);
  if (state.cash < cost) {
    throw new ActionError('INSUFFICIENT_CASH', `Need $${cost.toLocaleString()} to repair`);
  }
  const fleet = state.fleet.slice();
  fleet[aIdx] = { ...aircraft, condition: 100 };
  // A repaired aircraft can resume flight, so demand may need refresh
  // (a previously condition-0 aircraft no longer contributes 0 demand).
  return withRecomputedDemand({ ...state, cash: state.cash - cost, fleet });
}

// ─── Sign fuel contract ──────────────────────────────────────────────
export function signFuelContract(state: SaveState, contractId: string): SaveState {
  const def = getFuelContract(contractId);
  if (!def) throw new ActionError('UNKNOWN_CONTRACT', `No contract ${contractId}`);
  if (state.fuel.contracts.includes(contractId)) {
    throw new ActionError('CONTRACT_ALREADY_SIGNED', `${def.name} already signed`);
  }
  if (state.cash < def.cost) {
    throw new ActionError('INSUFFICIENT_CASH', `Need $${def.cost.toLocaleString()} for ${def.name}`);
  }
  return {
    ...state,
    cash: state.cash - def.cost,
    fuel: {
      ...state.fuel,
      contracts: [...state.fuel.contracts, contractId],
      supplyRate: state.fuel.supplyRate + def.supplyRatePerSec,
    },
  };
}

// ─── Upgrade fuel capacity ───────────────────────────────────────────
export function upgradeFuelCapacity(state: SaveState): SaveState {
  const next = nextCapacityTier(state.fuel.capacity);
  if (!next) throw new ActionError('CAPACITY_MAXED', 'Fuel capacity already at max tier');
  if (state.cash < next.cost) {
    throw new ActionError('INSUFFICIENT_CASH', `Need $${next.cost.toLocaleString()}`);
  }
  return {
    ...state,
    cash: state.cash - next.cost,
    fuel: { ...state.fuel, capacity: next.capacity },
  };
}

// ─── Unlock region ───────────────────────────────────────────────────
export function unlockRegion(state: SaveState, regionId: number): SaveState {
  const def = getRegion(regionId);
  if (!def) throw new ActionError('UNKNOWN_REGION', `No region ${regionId}`);
  if (state.unlockedRegions.includes(regionId)) {
    throw new ActionError('REGION_ALREADY_UNLOCKED', `${def.name} already unlocked`);
  }
  if (state.cash < def.unlockCost) {
    throw new ActionError(
      'INSUFFICIENT_CASH',
      `Need $${def.unlockCost.toLocaleString()} to unlock ${def.name}`,
    );
  }
  return {
    ...state,
    cash: state.cash - def.unlockCost,
    unlockedRegions: [...state.unlockedRegions, regionId].sort((a, b) => a - b),
  };
}

// ─── Create hub ──────────────────────────────────────────────────────
export function createHub(state: SaveState, iata: string): SaveState {
  if (state.hubs.some((h) => h.iata === iata)) {
    throw new ActionError('HUB_EXISTS', `${iata} is already a hub`);
  }
  if (routesAtAirport(state, iata) < 2) {
    throw new ActionError('HUB_NEEDS_ROUTES', `${iata} needs ≥ 2 connected routes`);
  }
  const cost = hubCreationCost(iata);
  if (state.cash < cost) {
    throw new ActionError('INSUFFICIENT_CASH', `Need $${cost.toLocaleString()} to create hub`);
  }
  const hub: Hub = { iata, level: 1, managers: emptyHubManagers() };
  return { ...state, cash: state.cash - cost, hubs: [...state.hubs, hub] };
}

// ─── Upgrade hub ─────────────────────────────────────────────────────
export function upgradeHub(state: SaveState, iata: string): SaveState {
  const idx = state.hubs.findIndex((h) => h.iata === iata);
  if (idx < 0) throw new ActionError('NO_HUB', `${iata} is not a hub`);
  const hub = state.hubs[idx]!;
  if (hub.level >= MAX_HUB_LEVEL) {
    throw new ActionError('HUB_MAXED', `${iata} is already at max level`);
  }
  const cost = hubUpgradeCost(iata, hub.level);
  if (state.cash < cost) {
    throw new ActionError('INSUFFICIENT_CASH', `Need $${cost.toLocaleString()} to upgrade`);
  }
  const hubs = state.hubs.slice();
  hubs[idx] = { ...hub, level: hub.level + 1 };
  return { ...state, cash: state.cash - cost, hubs };
}

// ─── Hire manager ────────────────────────────────────────────────────
export function hireManager(state: SaveState, iata: string, kind: ManagerKind): SaveState {
  const def = getManagerDef(kind);
  if (!def) throw new ActionError('UNKNOWN_MANAGER', `No manager ${kind}`);
  const idx = state.hubs.findIndex((h) => h.iata === iata);
  if (idx < 0) throw new ActionError('NO_HUB', `${iata} is not a hub`);
  const hub = state.hubs[idx]!;
  if (hub.managers[kind]) {
    throw new ActionError('MANAGER_HIRED', `${def.name} already at ${iata}`);
  }
  const cost = managerCost(kind, hub.level);
  if (state.cash < cost) {
    throw new ActionError('INSUFFICIENT_CASH', `Need $${cost.toLocaleString()} to hire ${def.name}`);
  }
  const hubs = state.hubs.slice();
  hubs[idx] = { ...hub, managers: { ...hub.managers, [kind]: true } };
  const next = { ...state, cash: state.cash - cost, hubs };
  // Logistics Director changes burn rate → recompute demand.
  return kind === 'logisticsDirector' ? withRecomputedDemand(next) : next;
}

// ─── Claim collectible ───────────────────────────────────────────────
export function claimCollectible(state: SaveState, id: string): SaveState {
  const idx = state.collectibles.findIndex((c) => c.id === id);
  if (idx < 0) throw new ActionError('NO_COLLECTIBLE', `No collectible ${id}`);
  const c = state.collectibles[idx]!;
  const collectibles = state.collectibles.slice();
  collectibles.splice(idx, 1);
  if (c.reward.kind === 'cash') {
    return { ...state, cash: state.cash + c.reward.amount, collectibles };
  }
  // fuel reward
  const newReserve = Math.min(state.fuel.capacity, state.fuel.reserve + c.reward.amount);
  return { ...state, fuel: { ...state.fuel, reserve: newReserve }, collectibles };
}

// Re-export so the store / UI can render data tables without separate imports.
export { FUEL_CAPACITY_TIERS, FUEL_CONTRACTS, REGIONS };
export type { Collectible };

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
