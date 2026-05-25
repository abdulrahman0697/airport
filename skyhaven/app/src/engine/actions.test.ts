import { describe, expect, it } from 'vitest';
import { AIRCRAFT_DEFS } from '../data/aircraft';
import {
  ActionError,
  applyUpgrade,
  buyAircraft,
  closeRoute,
  openRoute,
  repairAircraft,
  setRoutePricing,
} from './actions';
import { createInitialState } from './initialState';

function freshState() {
  const s = createInitialState(0);
  // Generous everything so we exercise the action logic without bumping
  // into cash / tier / fuel gates. Fuel-gate behaviour has its own suite
  // (fuel.test.ts).
  return {
    ...s,
    cash: 10_000_000_000,
    tierUnlocked: 4,
    lifetimeEarnings: 10_000_000_000,
    fuel: { ...s.fuel, supplyRate: 1_000_000, capacity: 10_000_000, reserve: 10_000_000 },
  };
}

describe('buyAircraft', () => {
  it('adds an aircraft to the fleet and deducts cash', () => {
    const s0 = freshState();
    const def = AIRCRAFT_DEFS[0]!;
    const s1 = buyAircraft(s0, def.id);
    expect(s1.fleet.length).toBe(s0.fleet.length + 1);
    expect(s1.cash).toBe(s0.cash - def.basePurchaseCost);
    expect(s1.fleet[s1.fleet.length - 1]?.routeId).toBeNull();
    expect(s1.fleet[s1.fleet.length - 1]?.condition).toBe(100);
  });

  it('throws INSUFFICIENT_CASH when broke', () => {
    const s0 = { ...freshState(), cash: 0 };
    expect(() => buyAircraft(s0, AIRCRAFT_DEFS[0]!.id)).toThrow(ActionError);
  });

  it('throws TIER_LOCKED for higher tiers', () => {
    const s0 = { ...freshState(), tierUnlocked: 1 };
    const t4 = AIRCRAFT_DEFS.find((a) => a.tier === 4)!;
    expect(() => buyAircraft(s0, t4.id)).toThrow(ActionError);
  });
});

describe('openRoute / closeRoute / setRoutePricing', () => {
  it('opens a route between two airports the aircraft can reach', () => {
    let s = freshState();
    s = buyAircraft(s, 't2.e190');
    const ac = s.fleet[s.fleet.length - 1]!;
    s = openRoute(s, 'LHR', 'CDG', ac.uid);
    expect(s.routes.find((r) => r.aircraftUid === ac.uid)).toBeDefined();
    const updated = s.fleet.find((a) => a.uid === ac.uid)!;
    expect(updated.routeId).not.toBeNull();
  });

  it('refuses an out-of-range route', () => {
    let s = freshState();
    s = buyAircraft(s, 't1.atr42'); // 1450 km
    const ac = s.fleet[s.fleet.length - 1]!;
    try {
      openRoute(s, 'LAX', 'JFK', ac.uid);
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as ActionError).code).toBe('OUT_OF_RANGE');
    }
  });

  it('closeRoute frees the aircraft', () => {
    let s = freshState();
    s = buyAircraft(s, 't2.e190');
    const ac = s.fleet[s.fleet.length - 1]!;
    s = openRoute(s, 'LHR', 'CDG', ac.uid);
    const routeId = s.routes.find((r) => r.aircraftUid === ac.uid)!.id;
    s = closeRoute(s, routeId);
    expect(s.routes.find((r) => r.id === routeId)).toBeUndefined();
    expect(s.fleet.find((a) => a.uid === ac.uid)?.routeId).toBeNull();
  });

  it('setRoutePricing adjusts load factor in the expected direction', () => {
    let s = freshState();
    s = buyAircraft(s, 't2.e190');
    const ac = s.fleet[s.fleet.length - 1]!;
    s = openRoute(s, 'LHR', 'CDG', ac.uid);
    const r0 = s.routes.find((r) => r.aircraftUid === ac.uid)!;
    s = setRoutePricing(s, r0.id, 'premium');
    const r1 = s.routes.find((r) => r.id === r0.id)!;
    expect(r1.loadFactor).toBeLessThan(r0.loadFactor);
    s = setRoutePricing(s, r0.id, 'economy');
    const r2 = s.routes.find((r) => r.id === r0.id)!;
    expect(r2.loadFactor).toBeGreaterThan(r0.loadFactor);
  });
});

describe('applyUpgrade', () => {
  it('increments level and costs cash', () => {
    let s = freshState();
    s = buyAircraft(s, 't1.atr42');
    const ac = s.fleet[s.fleet.length - 1]!;
    const before = s.cash;
    s = applyUpgrade(s, ac.uid, 'engine');
    expect(s.fleet.find((a) => a.uid === ac.uid)?.upgrades.engine).toBe(1);
    expect(s.cash).toBeLessThan(before);
  });

  it('refuses past max level', () => {
    let s = freshState();
    s = buyAircraft(s, 't1.atr42');
    const acUid = s.fleet[s.fleet.length - 1]!.uid;
    for (let i = 0; i < 10; i++) s = applyUpgrade(s, acUid, 'engine');
    try {
      applyUpgrade(s, acUid, 'engine');
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as ActionError).code).toBe('UPGRADE_MAXED');
    }
  });

  it('marketing upgrade bumps the route load factor immediately', () => {
    let s = freshState();
    s = buyAircraft(s, 't2.e190');
    const ac = s.fleet[s.fleet.length - 1]!;
    s = openRoute(s, 'LHR', 'CDG', ac.uid);
    const routeId = s.routes.find((r) => r.aircraftUid === ac.uid)!.id;
    const r0 = s.routes.find((r) => r.id === routeId)!;
    s = applyUpgrade(s, ac.uid, 'marketing');
    const r1 = s.routes.find((r) => r.id === routeId)!;
    expect(r1.loadFactor).toBeGreaterThan(r0.loadFactor);
  });
});

describe('repairAircraft', () => {
  it('is a no-op when the aircraft is already at 100%', () => {
    let s = freshState();
    s = buyAircraft(s, 't1.atr42');
    const before = s.cash;
    const acUid = s.fleet[s.fleet.length - 1]!.uid;
    s = repairAircraft(s, acUid);
    expect(s.cash).toBe(before);
  });

  it('restores condition to 100 and charges cash', () => {
    let s = freshState();
    s = buyAircraft(s, 't1.atr42');
    const acIdx = s.fleet.length - 1;
    s.fleet[acIdx] = { ...s.fleet[acIdx]!, condition: 35 };
    const before = s.cash;
    s = repairAircraft(s, s.fleet[acIdx]!.uid);
    expect(s.fleet[acIdx]!.condition).toBe(100);
    expect(s.cash).toBeLessThan(before);
  });
});
