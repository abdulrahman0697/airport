/**
 * Early-goal chain (BRD §5.3).
 *
 * Eight sequential goals that take a fresh player from "open a 3rd
 * route" to "unlock Tier 2". Each goal has a pure `check` predicate
 * over the current `SaveState`; the tick runs it after applying the
 * tick's effects and, on completion, credits the reward and advances
 * `state.goalChainStep`. When the step reaches `GOAL_COUNT` the chain
 * has graduated and the UI replaces the card with the rotating
 * objectives feed (Phase 14 retention).
 *
 * Reward values are illustrative and Remote-Config-tunable.
 */
import type { SaveState } from './types';

export interface GoalDef {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly reward: number;
  readonly check: (s: SaveState) => boolean;
}

const LONG_ROUTE_KM = 1500;

export const GOAL_CHAIN: readonly GoalDef[] = [
  {
    id: 'goal.routes.3',
    title: 'Build the network',
    description: 'Open a third route.',
    reward: 2_000,
    check: (s) => s.routes.length >= 3,
  },
  {
    id: 'goal.fleet.3',
    title: 'Add another wing',
    description: 'Buy a third aircraft.',
    reward: 5_000,
    check: (s) => s.fleet.length >= 3,
  },
  {
    id: 'goal.earnings.25k',
    title: 'First milestone',
    description: 'Earn $25,000 total.',
    reward: 10_000,
    check: (s) => s.lifetimeEarnings >= 25_000,
  },
  {
    id: 'goal.upgrade.1',
    title: 'Tune the fleet',
    description: 'Apply your first upgrade.',
    reward: 15_000,
    check: (s) => s.fleet.some((a) =>
      a.upgrades.engine + a.upgrades.cabin + a.upgrades.fuelEff + a.upgrades.marketing > 0),
  },
  {
    id: 'goal.long-route',
    title: 'Stretch the wings',
    description: `Open a route longer than ${LONG_ROUTE_KM.toLocaleString()} km.`,
    reward: 25_000,
    check: (s) => s.routes.some((r) => r.distanceKm > LONG_ROUTE_KM),
  },
  {
    id: 'goal.fleet.5',
    title: 'Grow the fleet',
    description: 'Reach 5 aircraft.',
    reward: 50_000,
    check: (s) => s.fleet.length >= 5,
  },
  {
    id: 'goal.manager.1',
    title: 'Hire your first manager',
    description: 'Promote a hub and hire any manager.',
    reward: 100_000,
    check: (s) =>
      s.hubs.some((h) => Object.values(h.managers).some(Boolean)),
  },
  {
    id: 'goal.tier.2',
    title: 'Unlock Tier 2',
    description: 'Cross $50,000 lifetime earnings to unlock regional jets.',
    reward: 150_000,
    check: (s) => s.tierUnlocked >= 2,
  },
];

export const GOAL_COUNT = GOAL_CHAIN.length;

/** Iterate any newly-satisfied goals and credit their rewards. */
export function processGoalChain(state: SaveState): SaveState {
  let step = state.goalChainStep;
  if (step >= GOAL_COUNT) return state;
  let cash = state.cash;
  let mutated = false;

  // Multiple goals can complete in a single tick (e.g. catch-up). We
  // advance only as long as the next goal's check passes given the
  // *current* state — goals don't compound on each other within a tick.
  while (step < GOAL_COUNT) {
    const g = GOAL_CHAIN[step]!;
    if (!g.check(state)) break;
    cash += g.reward;
    step++;
    mutated = true;
  }
  if (!mutated) return state;
  return { ...state, cash, goalChainStep: step };
}
