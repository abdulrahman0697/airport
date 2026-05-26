/**
 * Live-event scheduling + modifier math (BRD §4.12).
 *
 * The tick rolls a new event at most every `EVENT_CHECK_INTERVAL_MS`.
 * Spawn probability is deterministic — a `seed` carried in the state is
 * consumed and replaced by an xorshift step. This keeps the Web Worker
 * offline-catch-up path reproducible (Phase 9).
 *
 * Active events live in `state.activeEvents` with a frozen
 * `startedAt + durationMs`. The tick expires them by wall-clock.
 *
 * Crisis Manager mitigation is applied per-route in the consumer
 * (legRevenue / fuel demand) rather than at event spawn, because
 * the same fuel-price spike can affect different parts of the network
 * differently depending on which hubs have a Crisis Manager.
 */
import {
  EVENT_DEFS,
  EVENT_LOAD_FACTOR_BONUS,
  EVENT_REVENUE_MULTIPLIER,
  EVENT_SUPPLY_MULTIPLIER,
  type EventKind,
} from '../data/events';
import { loadTopAirports } from '../data/airports';
import { CRISIS_MANAGER_MITIGATION, routeHasCrisisManager } from './managers';
import type { ActiveEvent, Hub, Route } from './types';

export const EVENT_CHECK_INTERVAL_MS = 60_000; // roll every game-minute
const EVENT_SPAWN_PROBABILITY = 0.4;            // 40% chance per roll
const COLLECTIBLE_INTERVAL_MS = 90_000;
const COLLECTIBLE_SPAWN_PROBABILITY = 0.6;

/** Xorshift32 step — same flavour the world layer uses for clouds. */
export function nextSeed(seed: number): number {
  let s = seed | 0;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return s >>> 0;
}

function uniform(seed: number): number {
  return seed / 0xFFFFFFFF;
}

/** Decide whether a new event should spawn and which kind. */
export function rollEvent(
  seed: number,
  unlockedRegions: readonly number[],
  nowMs: number,
): { newSeed: number; event: ActiveEvent | null } {
  let s = nextSeed(seed);
  if (uniform(s) > EVENT_SPAWN_PROBABILITY) {
    return { newSeed: s, event: null };
  }
  s = nextSeed(s);
  const kinds = Object.keys(EVENT_DEFS) as EventKind[];
  const kindIdx = Math.floor(uniform(s) * kinds.length) % kinds.length;
  const kind = kinds[kindIdx]!;
  const def = EVENT_DEFS[kind];

  let regionId: number | null = null;
  if (def.regional) {
    s = nextSeed(s);
    if (unlockedRegions.length > 0) {
      const idx = Math.floor(uniform(s) * unlockedRegions.length) % unlockedRegions.length;
      regionId = unlockedRegions[idx] ?? null;
    }
  }
  s = nextSeed(s);
  const id = `evt-${kind}-${nowMs}-${(s % 1_000_000).toString(36)}`;
  return {
    newSeed: s,
    event: { id, kind, regionId, startedAt: nowMs, durationMs: def.durationMs },
  };
}

/** Expire any events whose window closed by `nowMs`. */
export function expireEvents(events: readonly ActiveEvent[], nowMs: number): ActiveEvent[] {
  return events.filter((e) => nowMs < e.startedAt + e.durationMs);
}

/** Tourism-Boom regional check — does the route touch the boomed region? */
function routeTouchesRegion(route: Route, regionId: number): boolean {
  const airports = loadTopAirports();
  const origin = airports.find((a) => a.iata === route.originIata);
  if (origin && origin.region === regionId) return true;
  const dest = airports.find((a) => a.iata === route.destIata);
  return !!dest && dest.region === regionId;
}

/** Revenue multiplier from active events for a given route. */
export function routeRevenueEventMultiplier(
  route: Route,
  events: readonly ActiveEvent[],
  hubs: readonly Hub[],
): number {
  let mul = 1;
  for (const e of events) {
    const m = EVENT_REVENUE_MULTIPLIER[e.kind];
    if (m === 1) continue;
    if (e.regionId !== null && !routeTouchesRegion(route, e.regionId)) continue;
    let delta = m - 1;
    if (delta < 0 && routeHasCrisisManager(route, hubs)) {
      delta *= CRISIS_MANAGER_MITIGATION;
    }
    mul *= (1 + delta);
  }
  return mul;
}

/** Load-factor bonus from active events for a given route. */
export function routeLoadFactorEventBonus(
  route: Route,
  events: readonly ActiveEvent[],
  hubs: readonly Hub[],
): number {
  let bonus = 0;
  for (const e of events) {
    const b = EVENT_LOAD_FACTOR_BONUS[e.kind];
    if (b === 0) continue;
    if (e.regionId !== null && !routeTouchesRegion(route, e.regionId)) continue;
    let adjusted = b;
    if (adjusted < 0 && routeHasCrisisManager(route, hubs)) {
      adjusted *= CRISIS_MANAGER_MITIGATION;
    }
    bonus += adjusted;
  }
  return bonus;
}

/** Global fuel-supply multiplier from active events (after Crisis Mgr). */
export function fuelSupplyEventMultiplier(events: readonly ActiveEvent[]): number {
  let mul = 1;
  for (const e of events) {
    const m = EVENT_SUPPLY_MULTIPLIER[e.kind];
    if (m === 1) continue;
    mul *= m;
  }
  return mul;
}

export { COLLECTIBLE_INTERVAL_MS, COLLECTIBLE_SPAWN_PROBABILITY };
