import { describe, expect, it } from 'vitest';
import { upgradeCost, canUpgrade, UPGRADE_SPECS } from './upgrades';
import { AIRCRAFT_DEFS } from '../data/aircraft';
import type { OwnedAircraft } from './types';

function aircraft(level: number, kind: 'engine' | 'cabin' = 'engine'): OwnedAircraft {
  return {
    uid: 'test', defId: AIRCRAFT_DEFS[0]!.id, condition: 100, flightHoursAccumulated: 0,
    upgrades: { engine: 0, cabin: 0, fuelEff: 0, marketing: 0, [kind]: level },
    routeId: null,
  };
}

describe('upgradeCost', () => {
  it('starts at baseFraction × purchase cost', () => {
    const def = AIRCRAFT_DEFS[0]!;
    const cost = upgradeCost(aircraft(0), 'engine');
    expect(cost).toBeCloseTo(def.basePurchaseCost * UPGRADE_SPECS.engine.baseFraction, -1);
  });

  it('grows by 1.15 per level', () => {
    const c0 = upgradeCost(aircraft(0), 'engine');
    const c1 = upgradeCost(aircraft(1), 'engine');
    const c2 = upgradeCost(aircraft(2), 'engine');
    expect(c1 / c0).toBeCloseTo(1.15, 1);
    expect(c2 / c1).toBeCloseTo(1.15, 1);
  });

  it('is infinity at max level', () => {
    expect(upgradeCost(aircraft(UPGRADE_SPECS.engine.maxLevel), 'engine')).toBe(Infinity);
  });
});

describe('canUpgrade', () => {
  it('false at max', () => {
    expect(canUpgrade(aircraft(UPGRADE_SPECS.engine.maxLevel), 'engine')).toBe(false);
  });
  it('true below max', () => {
    expect(canUpgrade(aircraft(0), 'engine')).toBe(true);
  });
});
