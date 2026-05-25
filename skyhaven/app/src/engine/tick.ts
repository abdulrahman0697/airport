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
    const dur = legDurationMs(r, aircraft);
    if (!isFinite(dur) || dur <= 0) return r;
    if (aircraft.condition <= 0) return r; // grounded; condition floor

    let progress = r.legProgress + ctx.dtMs / dur;
    let direction = r.legDirection;
    let hoursAccumulated = aircraft.flightHoursAccumulated;
    let conditionDelta = 0;
    let revenueThisTick = 0;

    // `gameHoursPerLeg`: real-world equivalent flight time for one leg.
    // The aircraft accumulates flight-hours in game-time (i.e. real-
    // world hours-equivalent), which is what conditionDecayRate is
    // expressed in. With TIME_COMPRESSION=120, one real second of play
    // is 2 game-hours of flight.
    const gameHoursPerLeg = (dur * TIME_COMPRESSION) / (3600 * 1000);

    let legBudget = 50; // hard cap on legs per tick to prevent pathological loops
    while (progress >= 1 && legBudget-- > 0) {
      progress -= 1;
      direction = direction === 'outbound' ? 'inbound' : 'outbound';
      // Read the current effective condition for this leg so decay
      // accrued mid-tick is reflected in subsequent legs' revenue.
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
    tierUnlocked,
    lastSeenTimestamp: ctx.nowMs,
  };
}
