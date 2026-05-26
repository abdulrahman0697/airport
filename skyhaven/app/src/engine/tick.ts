/**
 * Deterministic fixed-timestep simulation tick (BRD §2.4).
 *
 * The tick function is **pure** — no `Date.now`, no `Math.random`, no
 * `performance.now` direct reads. Everything time-related flows in
 * through `TickContext`. Random events use `state.seed`, advanced via
 * `nextSeed()`, so a single big-dt catch-up tick is reproducible.
 *
 * Phase 6 adds:
 *  - Live-event scheduling (`rollEvent` + expiry) and per-tick effects
 *    woven into `legRevenue` (revenue + load factor) and the fuel
 *    supply rate (price-spike events).
 *  - Maintenance Chief auto-repair: any hub aircraft below the
 *    threshold gets a one-shot heal if cash permits.
 *  - Roaming-collectible spawn / expiry (the world layer renders them
 *    and the user taps to claim).
 */

import { getAircraftDef } from '../data/aircraft';
import { loadTopAirports } from '../data/airports';
import { repairCost } from './condition';
import { TIME_COMPRESSION, legDurationMs, legRevenue } from './economy';
import {
  COLLECTIBLE_INTERVAL_MS,
  COLLECTIBLE_SPAWN_PROBABILITY,
  EVENT_CHECK_INTERVAL_MS,
  expireEvents,
  fuelSupplyEventMultiplier,
  nextSeed,
  rollEvent,
} from './events';
import { MAINTENANCE_CHIEF_THRESHOLD } from './managers';
import { maxTierUnlockedFor } from './tierUnlocks';
import type { ActiveEvent, Collectible, OwnedAircraft, Route, SaveState } from './types';

export const TICK_HZ = 10;
export const TICK_MS = 1000 / TICK_HZ;

export interface TickContext {
  readonly nowMs: number;
  readonly dtMs: number;
}

function uniform(seed: number): number {
  return seed / 0xFFFFFFFF;
}

function tickEvents(state: SaveState, ctx: TickContext): {
  events: ActiveEvent[];
  seed: number;
  nextCheckMs: number;
} {
  const remaining = expireEvents(state.activeEvents, ctx.nowMs);
  let seed = state.seed;
  let nextCheckMs = state.nextEventCheckMs;
  // Defensive: if a save migrated or loaded with a far-past scheduler
  // timestamp slips past `rebaseSchedulerFields`, the catch-up loop
  // would burn billions of iterations. Cap at a sane horizon.
  const MAX_CATCHUP_ROLLS = 16;
  if (nextCheckMs < ctx.nowMs - MAX_CATCHUP_ROLLS * EVENT_CHECK_INTERVAL_MS) {
    nextCheckMs = ctx.nowMs - MAX_CATCHUP_ROLLS * EVENT_CHECK_INTERVAL_MS;
  }
  let events = remaining;
  let iterations = 0;
  while (ctx.nowMs >= nextCheckMs && iterations < MAX_CATCHUP_ROLLS) {
    const { newSeed, event } = rollEvent(seed, state.unlockedRegions, nextCheckMs);
    seed = newSeed;
    if (event) events = [...events, event];
    nextCheckMs += EVENT_CHECK_INTERVAL_MS;
    iterations++;
  }
  return { events, seed, nextCheckMs };
}

function tickCollectibles(state: SaveState, ctx: TickContext, seed: number): {
  collectibles: Collectible[];
  seed: number;
  nextSpawnMs: number;
} {
  const remaining = state.collectibles.filter((c) => ctx.nowMs < c.expiresAt);
  let s = seed;
  let nextSpawnMs = state.nextCollectibleSpawnMs;
  // Same defensive clamp as `tickEvents`: keep the catch-up window
  // bounded if the persisted timestamp slips past `rebaseSchedulerFields`.
  const MAX_CATCHUP_SPAWNS = 16;
  if (nextSpawnMs < ctx.nowMs - MAX_CATCHUP_SPAWNS * COLLECTIBLE_INTERVAL_MS) {
    nextSpawnMs = ctx.nowMs - MAX_CATCHUP_SPAWNS * COLLECTIBLE_INTERVAL_MS;
  }
  let collectibles = remaining;
  let iterations = 0;
  while (ctx.nowMs >= nextSpawnMs && iterations < MAX_CATCHUP_SPAWNS) {
    s = nextSeed(s);
    if (uniform(s) < COLLECTIBLE_SPAWN_PROBABILITY && collectibles.length < 3) {
      s = nextSeed(s);
      const airports = loadTopAirports().filter((a) => state.unlockedRegions.includes(a.region));
      if (airports.length > 0) {
        const idx = Math.floor(uniform(s) * airports.length) % airports.length;
        const anchor = airports[idx]!;
        s = nextSeed(s);
        const isCash = uniform(s) < 0.7;
        s = nextSeed(s);
        const rewardAmount = isCash
          ? Math.round(2000 * (1 + uniform(s) * 8))      // $2K–$18K
          : Math.round(200 + uniform(s) * 500);           // 200–700 fuel
        collectibles = [
          ...collectibles,
          {
            id: `col-${nextSpawnMs}-${(s % 100_000).toString(36)}`,
            lat: anchor.lat + (uniform(nextSeed(s)) - 0.5) * 6,
            lon: anchor.lon + (uniform(nextSeed(s + 1)) - 0.5) * 12,
            spawnedAt: nextSpawnMs,
            expiresAt: nextSpawnMs + 90_000,
            reward: { kind: isCash ? 'cash' : 'fuel', amount: rewardAmount },
          },
        ];
      }
    }
    nextSpawnMs += COLLECTIBLE_INTERVAL_MS;
    iterations++;
  }
  return { collectibles, seed: s, nextSpawnMs };
}

function tickMaintenanceChief(
  fleet: OwnedAircraft[],
  routes: readonly Route[],
  hubs: readonly { iata: string; managers: { maintenanceChief: boolean } }[],
  cashIn: number,
): { fleet: OwnedAircraft[]; cash: number; mutated: boolean } {
  let cash = cashIn;
  let mutated = false;
  let outFleet: OwnedAircraft[] = fleet;
  // Build a fast lookup: which IATAs have a Maintenance Chief.
  const hubsWithMC = new Set(
    hubs.filter((h) => h.managers.maintenanceChief).map((h) => h.iata),
  );
  if (hubsWithMC.size === 0) return { fleet: outFleet, cash, mutated };

  for (let i = 0; i < outFleet.length; i++) {
    const a = outFleet[i]!;
    if (a.condition >= MAINTENANCE_CHIEF_THRESHOLD) continue;
    if (a.condition >= 100) continue;
    if (!a.routeId) continue;
    const route = routes.find((r) => r.id === a.routeId);
    if (!route) continue;
    if (!hubsWithMC.has(route.originIata) && !hubsWithMC.has(route.destIata)) continue;
    const cost = repairCost(a);
    if (cash < cost) continue;
    cash -= cost;
    if (!mutated) {
      outFleet = outFleet.slice();
      mutated = true;
    }
    outFleet[i] = { ...a, condition: 100 };
  }
  return { fleet: outFleet, cash, mutated };
}

export function tick(state: SaveState, ctx: TickContext): SaveState {
  if (ctx.dtMs <= 0) {
    return { ...state, lastSeenTimestamp: ctx.nowMs };
  }

  // ── Event scheduling ─────────────────────────────────────────────
  const eventResult = tickEvents(state, ctx);
  const collectibleResult = tickCollectibles(state, ctx, eventResult.seed);
  const activeEvents = eventResult.events;

  // ── Fuel reserve evolution with event modifier ──────────────────
  const supplyMul = fuelSupplyEventMultiplier(activeEvents);
  const effectiveSupply = state.fuel.supplyRate * supplyMul;
  const dtSec = ctx.dtMs / 1000;
  const netRate = effectiveSupply - state.fuel.demandRate;

  let nextReserve = state.fuel.reserve + netRate * dtSec;
  if (nextReserve < 0) nextReserve = 0;
  if (nextReserve > state.fuel.capacity) nextReserve = state.fuel.capacity;

  const fuelStarved = nextReserve <= 0 && netRate < 0;

  // ── Fleet + route advancement ────────────────────────────────────
  const fleetById = new Map(state.fleet.map((a) => [a.uid, a]));
  let cash = state.cash;
  let lifetime = state.lifetimeEarnings;
  let fleetMutated = false;
  let nextFleet: OwnedAircraft[] = state.fleet;

  const nextRoutes: Route[] = state.routes.map((r) => {
    const aircraft = fleetById.get(r.aircraftUid);
    if (!aircraft) return r;
    const def = getAircraftDef(aircraft.defId);
    if (!def) return r;
    if (aircraft.condition <= 0) return r;
    if (fuelStarved) return r;

    const dur = legDurationMs(r, aircraft);
    if (!isFinite(dur) || dur <= 0) return r;

    let progress = r.legProgress + ctx.dtMs / dur;
    let direction = r.legDirection;
    let hoursAccumulated = aircraft.flightHoursAccumulated;
    let conditionDelta = 0;
    let revenueThisTick = 0;

    const gameHoursPerLeg = (dur * TIME_COMPRESSION) / (3600 * 1000);

    let legBudget = 50;
    while (progress >= 1 && legBudget-- > 0) {
      progress -= 1;
      direction = direction === 'outbound' ? 'inbound' : 'outbound';
      const effectiveCondition = Math.max(0, aircraft.condition - conditionDelta);
      revenueThisTick += legRevenue(
        r,
        { ...aircraft, condition: effectiveCondition },
        state.hubs,
        activeEvents,
      );
      hoursAccumulated += gameHoursPerLeg;
      conditionDelta += def.conditionDecayRate * gameHoursPerLeg;
    }

    if (revenueThisTick > 0) {
      cash += revenueThisTick;
      lifetime += revenueThisTick;
    }

    if (
      hoursAccumulated !== aircraft.flightHoursAccumulated
      || conditionDelta !== 0
    ) {
      if (!fleetMutated) {
        nextFleet = state.fleet.slice();
        fleetMutated = true;
      }
      const idx = nextFleet.findIndex((a) => a.uid === aircraft.uid);
      if (idx >= 0) {
        nextFleet[idx] = {
          ...aircraft,
          flightHoursAccumulated: hoursAccumulated,
          condition: Math.max(0, aircraft.condition - conditionDelta),
        };
      }
    }

    if (progress === r.legProgress && direction === r.legDirection) return r;
    return { ...r, legProgress: progress, legDirection: direction };
  });

  // ── Maintenance Chief auto-repair (after route advancement) ─────
  const maintResult = tickMaintenanceChief(nextFleet, nextRoutes, state.hubs, cash);
  if (maintResult.mutated) {
    nextFleet = maintResult.fleet;
    cash = maintResult.cash;
    fleetMutated = true;
  }

  const tierUnlocked = Math.max(
    state.tierUnlocked,
    maxTierUnlockedFor(lifetime, 4),
  );

  return {
    ...state,
    cash,
    lifetimeEarnings: lifetime,
    fleet: nextFleet,
    routes: nextRoutes,
    fuel: { ...state.fuel, reserve: nextReserve },
    activeEvents,
    collectibles: collectibleResult.collectibles,
    seed: collectibleResult.seed,
    nextEventCheckMs: eventResult.nextCheckMs,
    nextCollectibleSpawnMs: collectibleResult.nextSpawnMs,
    tierUnlocked,
    lastSeenTimestamp: ctx.nowMs,
  };
}
