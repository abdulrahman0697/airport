/**
 * Deterministic fixed-timestep simulation tick (BRD §2.4).
 *
 * The tick function is **pure** — no `Date.now`, no `Math.random`, no
 * `performance.now` direct reads. Everything time-related flows in
 * through `TickContext`. This is what lets the Web Worker (Phase 9)
 * deterministically catch up on offline progress.
 *
 * One tick advances the world by `ctx.dtMs` milliseconds. For online
 * play the game loop calls `tick(state, { dtMs: 100, ... })` at 10 Hz;
 * for offline catch-up the worker calls it with a single larger dtMs.
 *
 * Phase 3 adds:
 *  - Condition decay per leg (BRD §4.2)
 *  - Cumulative-earnings tier-unlock gates (BRD §6.1)
 *  - Flight-hours accumulation in game-time hours
 *
 * Phase 4 adds:
 *  - Fuel reserve evolution (supply − demand × dt, clamped to capacity)
 *  - When reserve = 0 AND demand > supply, every assigned aircraft is
 *    treated as fuel-starved and earns nothing this tick. Under strict
 *    gating this only happens during fuel-price events (Phase 6).
 */

import { getAircraftDef } from '../data/aircraft';
import { TIME_COMPRESSION, legDurationMs, legRevenue } from './economy';
import { maxTierUnlockedFor } from './tierUnlocks';
import type { OwnedAircraft, Route, SaveState } from './types';

export const TICK_HZ = 10;
export const TICK_MS = 1000 / TICK_HZ;

export interface TickContext {
  /** Wall-clock epoch ms at the moment this tick is being processed. */
  readonly nowMs: number;
  /** Game-time delta this tick should advance, in real-time ms. */
  readonly dtMs: number;
}

export function tick(state: SaveState, ctx: TickContext): SaveState {
  if (ctx.dtMs <= 0) {
    return { ...state, lastSeenTimestamp: ctx.nowMs };
  }

  const dtSec = ctx.dtMs / 1000;
  const fuel = state.fuel;
  const netRate = fuel.supplyRate - fuel.demandRate;

  // Evolve the reserve. Reserve fills under strict gating; the negative
  // branch is the fuel-price-spike path covered by Phase 6 events.
  let nextReserve = fuel.reserve + netRate * dtSec;
  if (nextReserve < 0) nextReserve = 0;
  if (nextReserve > fuel.capacity) nextReserve = fuel.capacity;

  // Fleet is fuel-starved when the reserve is empty AND we'd dig deeper.
  const fuelStarved = nextReserve <= 0 && netRate < 0;

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
      revenueThisTick += legRevenue(r, { ...aircraft, condition: effectiveCondition });
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
    fuel: { ...fuel, reserve: nextReserve },
    tierUnlocked,
    lastSeenTimestamp: ctx.nowMs,
  };
}
