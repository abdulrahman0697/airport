import { describe, expect, it } from 'vitest';
import {
  LONG_HAUL_MAX_BONUS,
  LONG_HAUL_MAX_KM,
  LONG_HAUL_MIN_KM,
  legRevenue,
  longHaulMultiplier,
} from './economy';
import { getAircraftDef } from '../data/aircraft';
import type { OwnedAircraft, Route } from './types';

function mkAircraft(defId: string): OwnedAircraft {
  return {
    uid: 'a1', defId, condition: 100, flightHoursAccumulated: 0,
    upgrades: { engine: 0, cabin: 0, fuelEff: 0, marketing: 0 },
    routeId: 'r1',
  };
}
function mkRoute(distanceKm: number): Route {
  return {
    id: 'r1', originIata: 'AAA', destIata: 'BBB', distanceKm,
    aircraftUid: 'a1', pricing: 'balanced', loadFactor: 0.8,
    legProgress: 0, legDirection: 'outbound', aircraftType: undefined as never,
  };
}

describe('longHaulMultiplier', () => {
  it('is 1.0 at/below the short threshold', () => {
    expect(longHaulMultiplier(0)).toBe(1);
    expect(longHaulMultiplier(LONG_HAUL_MIN_KM)).toBe(1);
  });
  it('caps at +max bonus at/above the long threshold', () => {
    expect(longHaulMultiplier(LONG_HAUL_MAX_KM)).toBeCloseTo(1 + LONG_HAUL_MAX_BONUS);
    expect(longHaulMultiplier(LONG_HAUL_MAX_KM * 2)).toBeCloseTo(1 + LONG_HAUL_MAX_BONUS);
  });
  it('ramps monotonically in between', () => {
    const mid = (LONG_HAUL_MIN_KM + LONG_HAUL_MAX_KM) / 2;
    const m = longHaulMultiplier(mid);
    expect(m).toBeGreaterThan(1);
    expect(m).toBeLessThan(1 + LONG_HAUL_MAX_BONUS);
    expect(longHaulMultiplier(mid + 1000)).toBeGreaterThan(m);
  });
});

describe('legRevenue long-haul premium', () => {
  it('pays more per km on a long route than a short one (same plane)', () => {
    const a = mkAircraft('t5.b787-9');
    const def = getAircraftDef('t5.b787-9')!;
    expect(def).toBeTruthy();
    const shortR = legRevenue(mkRoute(1000), a);
    const longR = legRevenue(mkRoute(12000), a);
    const shortPerKm = shortR / 1000;
    const longPerKm = longR / 12000;
    // Long route earns a higher per-km yield thanks to the long-haul bonus.
    expect(longPerKm).toBeGreaterThan(shortPerKm);
  });
});
