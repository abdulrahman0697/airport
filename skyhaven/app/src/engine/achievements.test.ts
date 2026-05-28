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

  it('unlocks nothing on a fresh founder save — paced predicates require real growth', () => {
    const s = createInitialState(0);
    const out = evaluateAchievements(s);
    // After the achievement rewrite, every catalogue entry sits past
    // where the tutorial leaves the player (1 hub, 1 plane, 1 route,
    // $50K cash, tier 1, starter fuel contract). Finishing the
    // tutorial yields exactly one achievement (mil.tutorial); nothing
    // should fire on the bare initial state.
    expect(out.newlyUnlocked).toHaveLength(0);
    expect(out.totalReward).toBe(0);
    expect(out.state).toBe(s);
  });

  it('fires exactly one achievement when the tutorial is marked complete', () => {
    const s = createInitialState(0);
    const completed = { ...s, tutorialCompleted: true };
    const out = evaluateAchievements(completed);
    expect(out.newlyUnlocked).toEqual(['mil.tutorial']);
    expect(out.totalReward).toBeGreaterThan(0);
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
    expect(ACHIEVEMENT_COUNT).toBeGreaterThanOrEqual(50);
  });
});
