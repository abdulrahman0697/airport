import { describe, expect, it } from 'vitest';
import {
  ActionError,
  buyAircraft,
  closeRoute,
  openRoute,
  signFuelContract,
  upgradeFuelCapacity,
} from './actions';
import { createInitialState } from './initialState';
import { aircraftBurnRate, hasFuelHeadroom, totalDemand, withRecomputedDemand } from './fuel';
import { tick } from './tick';

function loaded() {
  const s = createInitialState(0);
  return { ...s, cash: 10_000_000_000, tierUnlocked: 4, lifetimeEarnings: 10_000_000_000 };
}

describe('aircraftBurnRate / totalDemand', () => {
  it('is zero for an idle fleet', () => {
    const s = createInitialState(0);
    const idle = { ...s, fleet: s.fleet.map((a) => ({ ...a, routeId: null })) };
    expect(totalDemand(idle)).toBe(0);
  });

  it('matches a single assigned aircraft', () => {
    const s = createInitialState(0);
    const a = s.fleet[0]!;
    expect(totalDemand(s)).toBeCloseTo(aircraftBurnRate(a), 5);
  });

  it('drops when a Fuel Eff upgrade is applied', () => {
    const s = createInitialState(0);
    const a = s.fleet[0]!;
    const base = aircraftBurnRate(a);
    const upgraded = aircraftBurnRate({ ...a, upgrades: { ...a.upgrades, fuelEff: 3 } });
    expect(upgraded).toBeCloseTo(base * 0.7, 5);
  });

  it('treats zero-condition aircraft as not contributing demand', () => {
    const s = createInitialState(0);
    const a = s.fleet[0]!;
    const dead = { ...s, fleet: [{ ...a, condition: 0 }] };
    expect(totalDemand(dead)).toBe(0);
  });
});

describe('strict fuel gate (BRD §4.6, locked decision)', () => {
  it('blocks opening a route that would push demand past supply', () => {
    // Cap supply just above the starter aircraft's burn so a second
    // assignment overshoots the headroom.
    let s = loaded();
    s = { ...s, fuel: { ...s.fuel, supplyRate: aircraftBurnRate(s.fleet[0]!) + 0.1 } };
    s = withRecomputedDemand(s);
    s = buyAircraft(s, 't1.atr42');
    const newAc = s.fleet[s.fleet.length - 1]!;
    expect(hasFuelHeadroom(s, aircraftBurnRate(newAc))).toBe(false);
    try {
      openRoute(s, 'LHR', 'CDG', newAc.uid);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as ActionError).code).toBe('FUEL_LIMIT');
    }
  });

  it('allows the route once a contract is signed', () => {
    let s = loaded();
    s = { ...s, fuel: { ...s.fuel, supplyRate: aircraftBurnRate(s.fleet[0]!) + 0.1 } };
    s = withRecomputedDemand(s);
    s = buyAircraft(s, 't1.atr42');
    const newAc = s.fleet[s.fleet.length - 1]!;
    s = signFuelContract(s, 'fc.local');
    s = openRoute(s, 'LHR', 'CDG', newAc.uid);
    expect(s.routes.length).toBe(2);
  });
});

describe('signFuelContract / upgradeFuelCapacity', () => {
  it('raises supplyRate by the contract amount and deducts cash', () => {
    const s0 = loaded();
    const before = s0.fuel.supplyRate;
    const s1 = signFuelContract(s0, 'fc.local');
    expect(s1.fuel.supplyRate).toBeCloseTo(before + 30, 5);
    expect(s1.fuel.contracts).toContain('fc.local');
    expect(s1.cash).toBeLessThan(s0.cash);
  });

  it('refuses a duplicate signing', () => {
    let s = loaded();
    s = signFuelContract(s, 'fc.local');
    expect(() => signFuelContract(s, 'fc.local')).toThrow(/already signed/);
  });

  it('upgradeFuelCapacity bumps capacity to the next tier', () => {
    const s0 = loaded();
    const s1 = upgradeFuelCapacity(s0);
    expect(s1.fuel.capacity).toBeGreaterThan(s0.fuel.capacity);
  });
});

describe('reserve evolution in tick', () => {
  it('fills toward capacity when supply > demand', () => {
    // Drain to zero, then verify the tick refills toward the ceiling.
    let s = createInitialState(0);
    s = { ...s, fuel: { ...s.fuel, reserve: 0 } };
    const supply = s.fuel.supplyRate;
    const demand = s.fuel.demandRate;
    expect(supply).toBeGreaterThan(demand);
    const s1 = tick(s, { nowMs: 10_000, dtMs: 10_000 });
    const expected = Math.min(s.fuel.capacity, (supply - demand) * 10);
    expect(s1.fuel.reserve).toBeCloseTo(expected, 1);
  });

  it('grounds the fleet when reserve hits 0 with demand > supply', () => {
    // Force a deficit and an empty reserve. Revenue should be zero.
    let s = createInitialState(0);
    s = {
      ...s,
      fuel: {
        ...s.fuel,
        reserve: 0,
        supplyRate: 1,
        demandRate: 100,
      },
    };
    const before = s.cash;
    const s1 = tick(s, { nowMs: 60_000, dtMs: 60_000 });
    expect(s1.cash).toBe(before);
    expect(s1.fuel.reserve).toBe(0);
  });

  it('caps reserve at capacity', () => {
    const s = createInitialState(0);
    const s1 = tick(s, { nowMs: 60 * 60 * 1000, dtMs: 60 * 60 * 1000 });
    expect(s1.fuel.reserve).toBeLessThanOrEqual(s.fuel.capacity);
  });
});

describe('closeRoute / sellAircraft recompute demand', () => {
  it('closeRoute brings demand back down', () => {
    const s0 = createInitialState(0);
    const initialDemand = s0.fuel.demandRate;
    expect(initialDemand).toBeGreaterThan(0);
    const s1 = closeRoute(s0, s0.routes[0]!.id);
    expect(s1.fuel.demandRate).toBe(0);
  });
});
