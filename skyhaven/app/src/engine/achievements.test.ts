import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_COUNT, ACHIEVEMENT_DEFS } from '../data/achievements';
import { evaluateAchievements } from './achievements';
import { createInitialState } from './initialState';

describe('evaluateAchievements', () => {
  it('returns the same state when nothing newly resolves', () => {
    const s = createInitialState(0);
    // Fresh saves don't yet have any predicate-true achievements
    // (no aircraft, no hubs, $50K cash but no lifetime, etc).
    // Pre-seed every achievement so we evaluate no-op deterministically.
    const all = { ...s, achievements: ACHIEVEMENT_DEFS.map((d) => d.id) };
    const out = evaluateAchievements(all);
    expect(out.state).toBe(all);
    expect(out.newlyUnlocked).toHaveLength(0);
    expect(out.totalReward).toBe(0);
  });

  it('credits the fresh-save predicate achievements (fleet + capacity)', () => {
    const s = createInitialState(0);
    const out = evaluateAchievements(s);
    // A fresh founder save starts with 1 aircraft (fleet.size.1) and
    // a starter capacity contract (ops.capacity.2). Starter cash $50K
    // sits *below* the econ.cash.100k threshold, so those don't credit.
    expect(out.newlyUnlocked).toEqual(expect.arrayContaining(['fleet.size.1', 'ops.capacity.2']));
    expect(out.totalReward).toBeGreaterThan(0);
    expect(out.state.cash).toBe(s.cash + out.totalReward);
    expect(out.state.lifetimeEarnings).toBe(s.lifetimeEarnings + out.totalReward);
  });

  it('does not double-credit on subsequent passes', () => {
    const s = createInitialState(0);
    const once = evaluateAchievements(s);
    const twice = evaluateAchievements(once.state);
    expect(twice.newlyUnlocked).toHaveLength(0);
    expect(twice.state).toBe(once.state);
  });

  it('has the expected achievement count', () => {
    expect(ACHIEVEMENT_COUNT).toBe(ACHIEVEMENT_DEFS.length);
    expect(ACHIEVEMENT_COUNT).toBeGreaterThanOrEqual(55);
  });
});
