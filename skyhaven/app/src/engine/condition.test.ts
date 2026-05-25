import { describe, expect, it } from 'vitest';
import { conditionBand, needsAttention, repairCost } from './condition';
import { AIRCRAFT_DEFS } from '../data/aircraft';
import type { OwnedAircraft } from './types';

function aircraft(overrides: Partial<OwnedAircraft> = {}): OwnedAircraft {
  return {
    uid: 'test', defId: AIRCRAFT_DEFS[0]!.id, condition: 100,
    flightHoursAccumulated: 0,
    upgrades: { engine: 0, cabin: 0, fuelEff: 0, marketing: 0 },
    routeId: null,
    ...overrides,
  };
}

describe('conditionBand', () => {
  it('normal above 70', () => { expect(conditionBand(85)).toBe('normal'); });
  it('degraded 40–70', () => {
    expect(conditionBand(70)).toBe('normal');
    expect(conditionBand(69)).toBe('degraded');
    expect(conditionBand(40)).toBe('degraded');
  });
  it('critical below 40', () => { expect(conditionBand(39)).toBe('critical'); });
});

describe('repairCost', () => {
  it('is zero at full condition', () => {
    expect(repairCost(aircraft({ condition: 100 }))).toBe(0);
  });
  it('scales with degradation', () => {
    const half = repairCost(aircraft({ condition: 50 }));
    const dead = repairCost(aircraft({ condition: 0 }));
    expect(half).toBeGreaterThan(0);
    expect(dead).toBeGreaterThan(half);
  });
});

describe('needsAttention', () => {
  it('flags anything below 70', () => {
    expect(needsAttention(aircraft({ condition: 75 }))).toBe(false);
    expect(needsAttention(aircraft({ condition: 65 }))).toBe(true);
  });
});
