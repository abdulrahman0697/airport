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
 */

import { legDurationMs, legRevenue } from './economy';
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

  const fleetById = new Map(state.fleet.map((a) => [a.uid, a]));
  let cash = state.cash;
  let lifetime = state.lifetimeEarnings;
  let fleetMutated = false;
  let nextFleet: OwnedAircraft[] = state.fleet;

  const nextRoutes: Route[] = state.routes.map((r) => {
    const aircraft = fleetById.get(r.aircraftUid);
    if (!aircraft) return r;
    const dur = legDurationMs(r, aircraft);
    if (!isFinite(dur) || dur <= 0) return r;

    let progress = r.legProgress + ctx.dtMs / dur;
    let direction = r.legDirection;
    let hoursAccumulated = aircraft.flightHoursAccumulated;
    let conditionDelta = 0;
    let revenueThisTick = 0;

    while (progress >= 1) {
      progress -= 1;
      direction = direction === 'outbound' ? 'inbound' : 'outbound';
      revenueThisTick += legRevenue(r, aircraft);
      hoursAccumulated += dur / (3600 * 1000);
      conditionDelta += 0.0; // condition decay arrives in Phase 3
    }

    if (revenueThisTick > 0) {
      cash += revenueThisTick;
      lifetime += revenueThisTick;
    }

    if (hoursAccumulated !== aircraft.flightHoursAccumulated || conditionDelta !== 0) {
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

  return {
    ...state,
    cash,
    lifetimeEarnings: lifetime,
    fleet: nextFleet,
    routes: nextRoutes,
    lastSeenTimestamp: ctx.nowMs,
  };
}
