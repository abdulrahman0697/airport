import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { loadedTestState } from './test-fixtures';
import { TICK_HZ, TICK_MS, drainArrivals, tick } from './tick';

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

  it('never makes cash decrease', () => {
    let s = loadedTestState();
    for (let i = 0; i < 200; i++) {
      const before = s.cash;
      s = tick(s, { nowMs: (i + 1) * 100, dtMs: 100 });
      expect(s.cash).toBeGreaterThanOrEqual(before);
    }
  });

  it('200 small ticks ≈ one big tick over a short window (pre-threshold)', () => {
    // Keep the window short enough that condition stays above the 70%
    // threshold for both paths — the linear regime where small ≈ big.
    const s0 = loadedTestState();
    let small = s0;
    for (let i = 0; i < 200; i++) {
      small = tick(small, { nowMs: (i + 1) * 100, dtMs: 100 });
    }
    const big = tick(s0, { nowMs: 200 * 100, dtMs: 200 * 100 });
    expect(big.cash).toBeGreaterThan(0);
    expect(Math.abs(big.cash - small.cash)).toBeLessThan(small.cash * 0.5 + 1000);
    expect(big.lastSeenTimestamp).toBe(small.lastSeenTimestamp);
  });

  it('credits revenue and accumulates flight hours over a long window', () => {
    const s0 = loadedTestState();
    const s1 = tick(s0, { nowMs: 600_000, dtMs: 600_000 });
    expect(s1.cash).toBeGreaterThan(s0.cash);
    expect(s1.lifetimeEarnings).toBeGreaterThan(0);
    const ac = s1.fleet[0]!;
    expect(ac.flightHoursAccumulated).toBeGreaterThan(0);
  });

  it('degrades condition over flight time', () => {
    // Hold the event scheduler off so fuel-price spikes don't drain
    // the reserve during the catch-up window and ground the fleet.
    const s0 = { ...loadedTestState(), nextEventCheckMs: 1e15 };
    const s1 = tick(s0, { nowMs: 30 * 60 * 1000, dtMs: 30 * 60 * 1000 });
    const ac = s1.fleet[0]!;
    expect(ac.condition).toBeLessThan(100);
    expect(ac.condition).toBeGreaterThan(50);
  });

  it('unlocks tier 2 once lifetime earnings cross $50K', () => {
    const s0 = loadedTestState();
    // Seed lifetime just under the T2 threshold and run a long
    // enough tick to push over it. After the rebalance pass (4× yield
    // cut), per-second route revenue is much smaller, so we let
    // 10 game-minutes accrue instead of 1.
    const seeded = { ...s0, lifetimeEarnings: 49_500, tierUnlocked: 1 };
    const s1 = tick(seeded, { nowMs: 600_000, dtMs: 600_000 });
    expect(s1.lifetimeEarnings).toBeGreaterThan(50_000);
    expect(s1.tierUnlocked).toBeGreaterThanOrEqual(2);
  });

  it('refuses to fly an aircraft at 0% condition', () => {
    let s = loadedTestState();
    s = { ...s, fleet: [{ ...s.fleet[0]!, condition: 0 }] };
    const s1 = tick(s, { nowMs: 60_000, dtMs: 60_000 });
    expect(s1.cash).toBe(s.cash);
  });
});

describe('arrivals output (Arrivals & Time update)', () => {
  it('emits an arrival with a positive amount when a leg completes', () => {
    const s0 = loadedTestState();
    tick(s0, { nowMs: 10_000, dtMs: 3_600_000 }); // big dt → ≥1 leg lands
    const arrivals = drainArrivals();
    expect(arrivals.length).toBeGreaterThan(0);
    expect(arrivals[0]!.amount).toBeGreaterThan(0);
    expect(typeof arrivals[0]!.destIata).toBe('string');
    expect(drainArrivals().length).toBe(0); // buffer cleared after draining
  });

  it('clears stale arrivals at the start of each tick', () => {
    const s0 = loadedTestState();
    tick(s0, { nowMs: 10_000, dtMs: 3_600_000 }); // fills the buffer
    tick(s0, { nowMs: 20_000, dtMs: 1 });          // tiny dt: no landing, resets
    expect(drainArrivals().length).toBe(0);
  });
});
