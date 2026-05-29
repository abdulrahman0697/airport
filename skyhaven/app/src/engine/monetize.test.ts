import { describe, expect, it } from 'vitest';
import {
  activateVip,
  fillFuel,
  grantCash,
  grantYieldSeconds,
  startSpeedUp,
  VIP_DURATION_MS,
} from './actions';
import { createInitialState } from './initialState';
import { loadedTestState } from './test-fixtures';
import { migrate } from './migrations';
import { CURRENT_SCHEMA_VERSION } from './types';
import { globalYieldMultFor, isVipActive } from './yield';

const NOW = 1_700_000_000_000;

describe('monetization grants', () => {
  it('grantCash adds to cash + lifetime and ignores non-positive', () => {
    const s0 = createInitialState(0);
    const s1 = grantCash(s0, 1234.7);
    expect(s1.cash).toBe(s0.cash + 1234);
    expect(s1.lifetimeEarnings).toBe(s0.lifetimeEarnings + 1234);
    expect(grantCash(s0, 0)).toBe(s0);
    expect(grantCash(s0, -5)).toBe(s0);
  });

  it('fillFuel tops the reserve to capacity', () => {
    const s0 = createInitialState(0);
    const drained = { ...s0, fuel: { ...s0.fuel, reserve: 0 } };
    expect(fillFuel(drained).fuel.reserve).toBe(s0.fuel.capacity);
  });

  it('startSpeedUp sets the expiry from now + duration', () => {
    const s0 = createInitialState(0);
    const s1 = startSpeedUp(s0, NOW, 180_000);
    expect(s1.speedUpUntilMs).toBe(NOW + 180_000);
    // Extends from the later of (existing, now).
    const s2 = startSpeedUp(s1, NOW + 1_000, 180_000);
    expect(s2.speedUpUntilMs).toBe(NOW + 180_000 + 180_000);
  });

  it('grantYieldSeconds credits income while routes earn', () => {
    const s0 = loadedTestState();
    const s1 = grantYieldSeconds(s0, 60, NOW);
    expect(s1.cash).toBeGreaterThan(s0.cash);
  });
});

describe('VIP pass', () => {
  it('sets a 7-day expiry, pays the welcome bonus, and reads active', () => {
    const s0 = loadedTestState();
    const s1 = activateVip(s0, NOW);
    expect(s1.vipUntilMs).toBe(NOW + VIP_DURATION_MS);
    expect(isVipActive(s1, NOW)).toBe(true);
    // 5h welcome bonus credited (loaded fixture has earning routes).
    expect(s1.cash).toBeGreaterThan(s0.cash);
    // Re-purchasing extends from the existing expiry.
    const s2 = activateVip(s1, NOW + 1000);
    expect(s2.vipUntilMs).toBe(NOW + VIP_DURATION_MS + VIP_DURATION_MS);
  });
});

describe('global yield boosts', () => {
  it('speed-up doubles and VIP adds 50%, composing multiplicatively', () => {
    const base = createInitialState(0); // no eco/vintage → base mult 1
    expect(globalYieldMultFor(base, NOW)).toBeCloseTo(1);
    expect(globalYieldMultFor({ ...base, speedUpUntilMs: NOW + 1000 }, NOW)).toBeCloseTo(2);
    expect(globalYieldMultFor({ ...base, vipUntilMs: NOW + 1000 }, NOW)).toBeCloseTo(1.5);
    expect(
      globalYieldMultFor({ ...base, speedUpUntilMs: NOW + 1000, vipUntilMs: NOW + 1000 }, NOW),
    ).toBeCloseTo(3);
    // Expired boosts have no effect.
    expect(globalYieldMultFor({ ...base, speedUpUntilMs: NOW - 1 }, NOW)).toBeCloseTo(1);
  });
});

describe('migration v10 → v11', () => {
  it('defaults the monetization timers to 0', () => {
    const v10 = { ...createInitialState(0), schemaVersion: 10 } as Record<string, unknown>;
    delete v10.speedUpUntilMs;
    delete v10.vipUntilMs;
    const out = migrate(v10, NOW) as unknown as {
      schemaVersion: number; speedUpUntilMs: number; vipUntilMs: number;
    };
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.speedUpUntilMs).toBe(0);
    expect(out.vipUntilMs).toBe(0);
  });
});
