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
import { evaluateAchievements } from './achievements';
import { recomputeProgress, rollIfNeeded } from './dailyMissions';
import { repairCost } from './condition';
import { computeEcoScore, ecoRevenueBonus } from './eco';
import { TIME_COMPRESSION, legDurationMs, legRevenue } from './economy';
import { processGoalChain } from './goalChain';
import { processVintageMilestones, vintageGlobalYieldBonus } from './vintage';
import {
  COLLECTIBLE_INTERVAL_MS,
  COLLECTIBLE_SPAWN_PROBABILITY,
  EVENT_CHECK_INTERVAL_MS,
  expireEvents,
  fuelSupplyEventMultiplier,
  nextSeed,
  rollEvent,
  runningEvents as runningEventsOf,
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
  events: readonly ActiveEvent[];
  seed: number;
  nextCheckMs: number;
} {
  // Preserve the array reference if no event expires this tick.
  let events: readonly ActiveEvent[] = state.activeEvents;
  let anyExpired = false;
  for (let i = 0; i < state.activeEvents.length; i++) {
    const e = state.activeEvents[i]!;
    if (ctx.nowMs >= e.startedAt + e.durationMs) { anyExpired = true; break; }
  }
  if (anyExpired) {
    events = expireEvents(state.activeEvents, ctx.nowMs);
  }

  // No new events while the tutorial is in flight (per BRD §5.3 + locked
  // decision: the player should reach the goal chain before live-ops
  // start firing). The check timestamp rolls forward to `now` so events
  // don't all spawn in one burst the moment the tutorial completes.
  if (!state.tutorialCompleted) {
    return {
      events,
      seed: state.seed,
      nextCheckMs: ctx.nowMs + EVENT_CHECK_INTERVAL_MS,
    };
  }

  let seed = state.seed;
  let nextCheckMs = state.nextEventCheckMs;
  const MAX_CATCHUP_ROLLS = 16;
  if (nextCheckMs < ctx.nowMs - MAX_CATCHUP_ROLLS * EVENT_CHECK_INTERVAL_MS) {
    nextCheckMs = ctx.nowMs - MAX_CATCHUP_ROLLS * EVENT_CHECK_INTERVAL_MS;
  }
  let iterations = 0;
  while (ctx.nowMs >= nextCheckMs && iterations < MAX_CATCHUP_ROLLS) {
    // User-locked rule: only one event in flight at a time. Skip the
    // roll when another event is still announced or running. We still
    // advance the seed so determinism doesn't drift.
    if (events.length === 0) {
      const { newSeed, event } = rollEvent(seed, state.unlockedRegions, nextCheckMs);
      seed = newSeed;
      if (event) events = [...events, event];
    } else {
      seed = nextSeed(seed);
    }
    nextCheckMs += EVENT_CHECK_INTERVAL_MS;
    iterations++;
  }
  return { events, seed, nextCheckMs };
}

function tickCollectibles(state: SaveState, ctx: TickContext, seed: number): {
  collectibles: readonly Collectible[];
  seed: number;
  nextSpawnMs: number;
} {
  let collectibles: readonly Collectible[] = state.collectibles;
  let anyExpired = false;
  for (let i = 0; i < state.collectibles.length; i++) {
    if (ctx.nowMs >= state.collectibles[i]!.expiresAt) { anyExpired = true; break; }
  }
  if (anyExpired) {
    collectibles = state.collectibles.filter((c) => ctx.nowMs < c.expiresAt);
  }
  // No new collectibles during the tutorial either — keeps the screen
  // clean of orbs while the player is being walked through the basics.
  if (!state.tutorialCompleted) {
    return {
      collectibles,
      seed,
      nextSpawnMs: ctx.nowMs + COLLECTIBLE_INTERVAL_MS,
    };
  }
  let s = seed;
  let nextSpawnMs = state.nextCollectibleSpawnMs;
  const MAX_CATCHUP_SPAWNS = 16;
  if (nextSpawnMs < ctx.nowMs - MAX_CATCHUP_SPAWNS * COLLECTIBLE_INTERVAL_MS) {
    nextSpawnMs = ctx.nowMs - MAX_CATCHUP_SPAWNS * COLLECTIBLE_INTERVAL_MS;
  }
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
  // Only the *running* phase of each event applies effects. The
  // announce phase shows a popup but doesn't modify revenue or fuel.
  const running = runningEventsOf(activeEvents, ctx.nowMs);

  // ── Vintage + Eco global multipliers ────────────────────────────
  // Computed once per tick from state at tick-start; classics added
  // mid-tick via processVintageMilestones don't retroactively boost
  // earnings within the same tick.
  const ecoScoreAtStart = computeEcoScore(state.fleet);
  const globalYieldMult =
    1 + vintageGlobalYieldBonus(state.vintage) + ecoRevenueBonus(ecoScoreAtStart);

  // ── Fuel reserve evolution with event modifier ──────────────────
  const supplyMul = fuelSupplyEventMultiplier(running);
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
        running,
        globalYieldMult,
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
    maxTierUnlockedFor(lifetime),
  );

  // Eco score reflects the fleet *after* tick mutations; tiering shifts
  // smoothly as fuel-eff upgrades land or modern aircraft join.
  const ecoRating = Math.round(computeEcoScore(nextFleet));

  const next: SaveState = {
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
    ecoRating,
    lastSeenTimestamp: ctx.nowMs,
  };

  // Vintage milestone processing happens after the cash credit lands.
  // The helper queues a `pendingVintageDrop` for the UI popup; ack via
  // the `acknowledgeVintageDrop` action clears it.
  const withVintage = processVintageMilestones(next);
  // Achievement evaluation runs after vintage + before goal-chain so
  // any reward-credited achievement (e.g. lifetime-earnings milestone)
  // contributes to the goal-chain's cash check this same tick.
  // Suppressed during the tutorial: Mission Control is the only
  // progression signal we want the player to react to in those first
  // minutes, and we don't want a "+$10K Achievement Unlocked" toast
  // firing the moment the player taps "Sign Local Refinery" because
  // they're following an instruction, not making a strategic move.
  const withAchievements = withVintage.tutorialCompleted
    ? evaluateAchievements(withVintage).state
    : withVintage;
  // Daily missions: roll new set on date change, recompute progress
  // every tick. Cheap (K=3 templates).
  const withDailyRoll = rollIfNeeded(withAchievements, ctx.nowMs);
  const withDailyProgress = recomputeProgress(withDailyRoll);
  // Goal-chain auto-detection runs last so it sees the freshly-credited
  // cash + any vintage drops in the same tick.
  return processGoalChain(withDailyProgress);
}
