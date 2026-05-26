/**
 * Vintage Hangar / classics (BRD §4.9).
 *
 * Players earn classic-aircraft drops as their lifetime earnings cross
 * fixed milestones. The drop pool is "no duplicate": until every
 * classic is collected, each milestone awards an unowned one in a
 * stable order. Once the set is complete, subsequent milestones pay a
 * cash bonus instead.
 *
 * Each owned classic permanently lifts the airline's global yield by
 * +1% — collection completion is +12% global revenue, on top of the
 * Eco Rating bonus.
 */

import {
  CLASSIC_DEFS,
  VINTAGE_FIRST_MILESTONE,
  VINTAGE_MILESTONE_STEP,
  VINTAGE_POST_COMPLETION_BONUS,
} from '../data/classics';
import type { SaveState } from './types';

/** Number of lifetime-earning milestones the player has reached. */
export function totalVintageMilestones(lifetimeEarnings: number): number {
  if (lifetimeEarnings < VINTAGE_FIRST_MILESTONE) return 0;
  return Math.floor((lifetimeEarnings - VINTAGE_FIRST_MILESTONE) / VINTAGE_MILESTONE_STEP) + 1;
}

/** First unowned classic in the canonical drop order, or null when full. */
export function nextUnownedClassic(owned: readonly string[]): string | null {
  for (const c of CLASSIC_DEFS) {
    if (!owned.includes(c.id)) return c.id;
  }
  return null;
}

/** Apply any pending vintage milestones — awards classics and/or cash. */
export function processVintageMilestones(state: SaveState): SaveState {
  const reached = totalVintageMilestones(state.lifetimeEarnings);
  if (reached <= state.vintageMilestonesConsumed) return state;

  let vintage: string[] = state.vintage;
  let cash = state.cash;
  let consumed = state.vintageMilestonesConsumed;
  let pending = state.pendingVintageDrop;
  let mutated = false;

  while (consumed < reached) {
    const next = nextUnownedClassic(vintage);
    if (next) {
      if (!mutated) { vintage = vintage.slice(); mutated = true; }
      vintage.push(next);
      pending = next; // queue the most recent for the UI popup
    } else {
      cash += VINTAGE_POST_COMPLETION_BONUS;
    }
    consumed++;
  }

  return {
    ...state,
    vintage,
    cash,
    vintageMilestonesConsumed: consumed,
    pendingVintageDrop: pending,
  };
}

/** +1% global yield per collected classic. */
export function vintageGlobalYieldBonus(vintage: readonly string[]): number {
  return 0.01 * vintage.length;
}
