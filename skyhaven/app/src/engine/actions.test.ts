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
import { loadedTestState } from './test-fixtures';

function freshState() {
  return loadedTestState();
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

  it('blocks a purchase when the hub is at its fleet-slot cap', () => {
    // L1 LHR hub = 7 slots (5 + 2×1). The fixture's starter is hubless,
    // so 7 LHR-based buys fill it and the 8th is rejected.
    let s = freshState();
    for (let i = 0; i < 7; i++) s = buyAircraft(s, 't1.atr42', 'LHR');
    expect(s.fleet.filter((a) => a.homeHubIata === 'LHR').length).toBe(7);
    try {
      buyAircraft(s, 't1.atr42', 'LHR');
      throw new Error('expected HUB_FULL');
    } catch (e) {
      expect((e as ActionError).code).toBe('HUB_FULL');
    }
  });

  it('a higher hub level grants more fleet slots', () => {
    let s = freshState();
    // Bump LHR to L2 (9 slots): nine LHR buys succeed, the tenth fails.
    s = { ...s, hubs: s.hubs.map((h) => (h.iata === 'LHR' ? { ...h, level: 2 } : h)) };
    for (let i = 0; i < 9; i++) s = buyAircraft(s, 't1.atr42', 'LHR');
    expect(s.fleet.filter((a) => a.homeHubIata === 'LHR').length).toBe(9);
    expect(() => buyAircraft(s, 't1.atr42', 'LHR')).toThrow(ActionError);
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
    // Add LAX as a hub so the range gate fires first (not the hub gate).
    s = { ...s, hubs: [...s.hubs, { iata: 'LAX', level: 1, managers: {
      hubDirector: false, maintenanceChief: false, logisticsDirector: false,
      fleetEngineer: false, marketingLead: false, crisisManager: false,
    } }] };
    s = buyAircraft(s, 't1.atr42', 'LAX'); // 1450 km, based at LAX
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
    // Engine upgrades cap at 5 levels (was 10 — capped after the
    // upgrade-pacing rebalance). Install all 5 then expect the
    // sixth to throw UPGRADE_MAXED.
    for (let i = 0; i < 5; i++) s = applyUpgrade(s, acUid, 'engine');
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
