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

// ─── Credit a claimed gift (Phase 12.3) ─────────────────────────────
/**
 * Apply a friend gift to the local save state. The server-side
 * `claimGift` Cloud Function has already marked the gift as claimed
 * atomically; this is purely the local-state update for the reward.
 *
 * Fuel credits are clamped to the fuel reserve capacity so a generous
 * gift can't overflow the tank — the surplus is simply discarded.
 */
export function creditGift(
  state: SaveState,
  kind: 'cash' | 'fuel',
  amount: number,
): SaveState {
  if (!Number.isFinite(amount) || amount <= 0) return state;
  if (kind === 'cash') {
    return { ...state, cash: state.cash + amount, lifetimeEarnings: state.lifetimeEarnings + amount };
  }
  const nextReserve = Math.min(state.fuel.capacity, state.fuel.reserve + amount);
  return { ...state, fuel: { ...state.fuel, reserve: nextReserve } };
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

  // Hub gate (Phase 10 rework) — every route must originate from one
  // of the player's hubs.
  if (!state.hubs.some((h) => h.iata === originIata)) {
    throw new ActionError('NOT_A_HUB',
      `${originIata} isn't a hub yet — add it from the Hubs tab first.`);
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
    // Each newly-unlocked region triggers a free hub pick — the UI
    // prompts the player to choose their foothold there.
    pendingHubPickRegion: regionId,
  };
}

// ─── Pick / create hub ───────────────────────────────────────────────
/**
 * Promote an airport to a hub. Phase 10 rework:
 *  - The first hub in any region is **free** (it's the player's
 *    foothold in that region — comes with the region unlock).
 *  - Subsequent hubs in an unlocked region cost the standard fee.
 *  - Routes originate from hubs only (validated in `openRoute`).
 *
 * When the picked airport's region matches `pendingHubPickRegion`,
 * the pending flag is cleared.
 */
export function pickHub(state: SaveState, iata: string): SaveState {
  const airports = loadTopAirports();
  const ap = airports.find((a) => a.iata === iata);
  if (!ap) throw new ActionError('UNKNOWN_AIRPORT', `No airport ${iata}`);
  if (!state.unlockedRegions.includes(ap.region)) {
    const region = getRegion(ap.region);
    throw new ActionError(
      'REGION_LOCKED',
      `${region?.name ?? `Region ${ap.region}`} not yet unlocked`,
    );
  }
  if (state.hubs.some((h) => h.iata === iata)) {
    throw new ActionError('HUB_EXISTS', `${iata} is already a hub`);
  }

  // Count existing hubs already in this region — first one's free.
  let inRegion = 0;
  for (const h of state.hubs) {
    const hap = airports.find((a) => a.iata === h.iata);
    if (hap && hap.region === ap.region) inRegion++;
  }
  const cost = inRegion === 0 ? 0 : hubCreationCost(iata);
  if (state.cash < cost) {
    throw new ActionError('INSUFFICIENT_CASH', `Need $${cost.toLocaleString()} to add hub`);
  }

  const hub: Hub = { iata, level: 1, managers: emptyHubManagers() };
  return {
    ...state,
    cash: state.cash - cost,
    hubs: [...state.hubs, hub],
    pendingHubPickRegion:
      state.pendingHubPickRegion === ap.region ? null : state.pendingHubPickRegion,
  };
}

/** Backwards-compatible alias. The Phase 5 createHub gate (≥ 2 routes)
 *  is gone; the store action still exists for any caller that wires it. */
export const createHub = pickHub;

/** Compute the cost to pick a hub at this airport given current state. */
export function hubPickCost(state: SaveState, iata: string): number {
  const airports = loadTopAirports();
  const ap = airports.find((a) => a.iata === iata);
  if (!ap) return 0;
  let inRegion = 0;
  for (const h of state.hubs) {
    const hap = airports.find((a) => a.iata === h.iata);
    if (hap && hap.region === ap.region) inRegion++;
  }
  return inRegion === 0 ? 0 : hubCreationCost(iata);
}

/**
 * Switch the player's starting region before they've placed any hub.
 * Only valid when `hubs.length === 0` — used by the first-launch hub
 * picker so the player isn't locked into the timezone-detected default.
 * Replaces `unlockedRegions` with `[regionId]` and re-points the
 * pending hub-pick prompt at the chosen region.
 */
export function chooseStartingRegion(state: SaveState, regionId: number): SaveState {
  if (state.hubs.length > 0) {
    throw new ActionError('HAS_HUBS', 'Starting region locked in once you have a hub');
  }
  const region = getRegion(regionId);
  if (!region) throw new ActionError('UNKNOWN_REGION', `No region ${regionId}`);
  return {
    ...state,
    unlockedRegions: [regionId],
    pendingHubPickRegion: regionId,
  };
}

/** Dismiss the pending hub-pick prompt without picking (UI Skip button). */
export function dismissHubPick(state: SaveState): SaveState {
  if (state.pendingHubPickRegion === null) return state;
  return { ...state, pendingHubPickRegion: null };
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

// ─── Acknowledge vintage drop ────────────────────────────────────────
export function acknowledgeVintageDrop(state: SaveState): SaveState {
  if (state.pendingVintageDrop === null) return state;
  return { ...state, pendingVintageDrop: null };
}

// ─── Tutorial (Phase 9) ──────────────────────────────────────────────
export function setAirlineIdentity(
  state: SaveState,
  name: string,
  tailColor: string,
): SaveState {
  const clean = (name || '').trim().slice(0, 20) || state.airlineName;
  const code = (clean.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()) || state.code;
  return { ...state, airlineName: clean, tailColor, code };
}

export function advanceTutorial(state: SaveState): SaveState {
  return { ...state, tutorialStep: state.tutorialStep + 1 };
}

export function completeTutorial(state: SaveState): SaveState {
  return { ...state, tutorialCompleted: true, tutorialStep: 0 };
}

/** Replay the playable walkthrough — kicks the tutorial back to step 0. */
export function resetTutorial(state: SaveState): SaveState {
  return { ...state, tutorialCompleted: false, tutorialStep: 0 };
}

// ─── Acknowledge offline summary ─────────────────────────────────────
export function acknowledgeOfflineSummary(state: SaveState): SaveState {
  if (state.pendingOfflineSummary === null) return state;
  return { ...state, pendingOfflineSummary: null };
}

// ─── Claim daily reward ──────────────────────────────────────────────
export function claimDailyReward(state: SaveState): SaveState {
  if (state.pendingDailyReward === null) return state;
  const { amount } = state.pendingDailyReward;
  return { ...state, cash: state.cash + amount, pendingDailyReward: null };
}

// ─── Set pending offline summary (used by gameLoop) ──────────────────
export function setOfflineSummary(
  state: SaveState,
  summary: { elapsedMs: number; earnings: number } | null,
): SaveState {
  return { ...state, pendingOfflineSummary: summary };
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
