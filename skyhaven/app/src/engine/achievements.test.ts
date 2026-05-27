import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_COUNT, ACHIEVEMENT_DEFS } from '../data/achievements';
import { evaluateAchievements } from './achievements';
import { createInitialState } from './initialState';

describe('evaluateAchievements', () => {
  it('returns the same state when nothing newly resolves', () => {
    const s = createInitialState(0);
    // Fresh saves don't yet have any predicate-true achievements
    // (no aircraft, no hubs, $2M cash but no lifetime, etc).
    // Pre-seed every cash-threshold to mark as known so we evaluate
    // no-op deterministically.
    const all = { ...s, achievements: ACHIEVEMENT_DEFS.map((d) => d.id) };
    const out = evaluateAchievements(all);
    expect(out.state).toBe(all);
    expect(out.newlyUnlocked).toHaveLength(0);
    expect(out.totalReward).toBe(0);
  });

  it('unlocks the starter cash achievement on a fresh save (cash $2M)', () => {
    const s = createInitialState(0);
    const out = evaluateAchievements(s);
    // The init state has $2M starter cash — that crosses
    // econ.cash.1m and econ.cash.100k.
    expect(out.newlyUnlocked).toEqual(expect.arrayContaining(['econ.cash.100k', 'econ.cash.1m']));
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
