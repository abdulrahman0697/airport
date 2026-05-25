import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { TICK_HZ, TICK_MS, tick } from './tick';

describe('tick constants', () => {
  it('runs at 10 Hz', () => {
    expect(TICK_HZ).toBe(10);
    expect(TICK_MS).toBe(100);
  });
});

describe('tick — invariants', () => {
  it('is deterministic for the same input', () => {
    const s0 = createInitialState(1_700_000_000_000);
    const a = tick(s0, { nowMs: 1_700_000_001_000, dtMs: 1_000 });
    const b = tick(s0, { nowMs: 1_700_000_001_000, dtMs: 1_000 });
    expect(a).toEqual(b);
  });

  it('advances lastSeenTimestamp even for a zero-dt tick', () => {
    const s0 = createInitialState(0);
    const s1 = tick(s0, { nowMs: 5_000, dtMs: 0 });
    expect(s1.lastSeenTimestamp).toBe(5_000);
    expect(s1.cash).toBe(s0.cash);
  });

  it('never makes cash decrease in Phase-2 economy', () => {
    let s = createInitialState(0);
    for (let i = 0; i < 200; i++) {
      const before = s.cash;
      s = tick(s, { nowMs: (i + 1) * 100, dtMs: 100 });
      expect(s.cash).toBeGreaterThanOrEqual(before);
    }
  });

  it('200 small ticks ≈ one big tick of equal total dt (linear economy)', () => {
    const s0 = createInitialState(0);
    let small = s0;
    for (let i = 0; i < 200; i++) {
      small = tick(small, { nowMs: (i + 1) * 100, dtMs: 100 });
    }
    const big = tick(s0, { nowMs: 200 * 100, dtMs: 200 * 100 });
    // Cash drift between the two paths should stay tiny — at most one
    // half-leg's worth of revenue depending on where the leg boundary lands.
    expect(big.cash).toBeGreaterThan(0);
    expect(Math.abs(big.cash - small.cash)).toBeLessThan(small.cash * 0.5 + 1000);
    expect(big.lastSeenTimestamp).toBe(small.lastSeenTimestamp);
  });

  it('completes a leg and credits revenue when progress crosses 1.0', () => {
    const s0 = createInitialState(0);
    // Hand the loop enough wall-clock time to fly several legs.
    const s1 = tick(s0, { nowMs: 600_000, dtMs: 600_000 });
    expect(s1.cash).toBeGreaterThan(s0.cash);
    expect(s1.lifetimeEarnings).toBeGreaterThan(0);
  });
});
