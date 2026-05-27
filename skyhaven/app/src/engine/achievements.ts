/**
 * Achievement evaluator (BRD §14).
 *
 * Pure transition: scan every catalogue entry, mark anything whose
 * predicate just flipped from false to true as newly unlocked, and
 * credit the per-achievement cash reward in one batched update.
 *
 * Callers (the tick) are responsible for surfacing the unlocks to
 * the UI — `appendUnlocks` returns just the bookkeeping side; the
 * toast / hero-moment layer reads from store diffs.
 */
import { ACHIEVEMENT_DEFS, getAchievement } from '../data/achievements';
import type { SaveState } from './types';

export interface AchievementEvalResult {
  state: SaveState;
  newlyUnlocked: readonly string[];
  totalReward: number;
}

/**
 * Evaluate every achievement predicate against the current state and
 * unlock the ones that newly resolve true. Returns the same state
 * reference (no allocation) when nothing changed — important for
 * Zustand listeners.
 */
export function evaluateAchievements(state: SaveState): AchievementEvalResult {
  const known = new Set(state.achievements);
  const newly: string[] = [];
  let reward = 0;
  for (const def of ACHIEVEMENT_DEFS) {
    if (known.has(def.id)) continue;
    let ok = false;
    try { ok = def.predicate(state); }
    catch { ok = false; }
    if (!ok) continue;
    newly.push(def.id);
    reward += def.reward;
  }
  if (newly.length === 0) {
    return { state, newlyUnlocked: [], totalReward: 0 };
  }
  return {
    state: {
      ...state,
      achievements: [...state.achievements, ...newly],
      cash: state.cash + reward,
      lifetimeEarnings: state.lifetimeEarnings + reward,
    },
    newlyUnlocked: newly,
    totalReward: reward,
  };
}

/**
 * Force-unlock an achievement (idempotent). Used by event-driven
 * unlocks whose predicates can't be derived purely from SaveState
 * (e.g. "survive a fuel price spike" — fires from the tick's event
 * expiry path).
 */
export function forceUnlock(state: SaveState, id: string): SaveState {
  if (state.achievements.includes(id)) return state;
  const def = getAchievement(id);
  if (!def) return state;
  return {
    ...state,
    achievements: [...state.achievements, id],
    cash: state.cash + def.reward,
    lifetimeEarnings: state.lifetimeEarnings + def.reward,
  };
}
