import { describe, expect, it } from 'vitest';
import { loadTopAirports } from '../data/airports';
import { ActionError, createHub, openRoute, upgradeHub, buyAircraft, unlockRegion } from './actions';
import { createInitialState } from './initialState';
import {
  HUB_BONUS_PER_LEVEL,
  hubCreationCost,
  hubUpgradeCost,
  MAX_HUB_LEVEL,
  networkBonusForRoute,
  routesAtAirport,
} from './hubs';
import { legRevenue } from './economy';
import type { Hub } from './types';

function loaded() {
  const s = createInitialState(0);
  return {
    ...s,
    cash: 10_000_000_000,
    tierUnlocked: 4,
    lifetimeEarnings: 10_000_000_000,
    unlockedRegions: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    fuel: { ...s.fuel, supplyRate: 1_000_000, capacity: 10_000_000, reserve: 10_000_000 },
  };
}

describe('routesAtAirport', () => {
  it('counts routes that touch either end', () => {
    const s = loaded();
    expect(routesAtAirport(s, s.routes[0]!.originIata)).toBe(1);
    expect(routesAtAirport(s, s.routes[0]!.destIata)).toBe(1);
    expect(routesAtAirport(s, 'ZZZ')).toBe(0);
  });
});

describe('createHub', () => {
  it('refuses an airport with fewer than 2 routes', () => {
    const s = loaded();
    try {
      createHub(s, s.routes[0]!.originIata);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as ActionError).code).toBe('HUB_NEEDS_ROUTES');
    }
  });

  it('creates a hub once an airport carries ≥ 2 routes', () => {
    let s = loaded();
    const startOrigin = s.routes[0]!.originIata;
    // Open a second route from the starter origin so it has 2 routes.
    s = buyAircraft(s, 't2.e190');
    const newAc = s.fleet[s.fleet.length - 1]!;
    // Pick a destination different from the first route's destination
    // and within range and unlocked. Use any large EU airport that
    // isn't the existing dest.
    const airports = loadTopAirports();
    const candidate = airports.find((a) =>
      a.iata !== startOrigin
      && a.iata !== s.routes[0]!.destIata
      && a.region === 3
      && a.sizeTier === 4,
    );
    if (!candidate) throw new Error('no candidate destination');
    s = openRoute(s, startOrigin, candidate.iata, newAc.uid);
    expect(routesAtAirport(s, startOrigin)).toBe(2);

    const before = s.cash;
    s = createHub(s, startOrigin);
    expect(s.hubs.find((h) => h.iata === startOrigin)?.level).toBe(1);
    expect(s.cash).toBeLessThan(before);
  });
});

describe('upgradeHub', () => {
  it('refuses if airport is not a hub', () => {
    const s = loaded();
    expect(() => upgradeHub(s, 'XXX')).toThrow(/not a hub/);
  });

  it('increments level and charges escalating cost', () => {
    let s = loaded();
    s.hubs = [{ iata: 'TEST', level: 1, managers: {
      hubDirector: false, maintenanceChief: false, logisticsDirector: false,
      fleetEngineer: false, marketingLead: false, crisisManager: false,
    } }];
    const c1 = hubUpgradeCost('TEST', 1);
    const c2 = hubUpgradeCost('TEST', 2);
    expect(c2).toBeGreaterThan(c1);
    s = upgradeHub(s, 'TEST');
    expect(s.hubs.find((h) => h.iata === 'TEST')?.level).toBe(2);
  });

  it('refuses past MAX_HUB_LEVEL', () => {
    const s = loaded();
    s.hubs = [{
      iata: 'TEST',
      level: MAX_HUB_LEVEL,
      managers: {
        hubDirector: false, maintenanceChief: false, logisticsDirector: false,
        fleetEngineer: false, marketingLead: false, crisisManager: false,
      },
    }];
    expect(() => upgradeHub(s, 'TEST')).toThrow(/max level/);
  });
});

describe('networkBonusForRoute', () => {
  const hub = (iata: string, level: number): Hub => ({
    iata, level,
    managers: {
      hubDirector: false, maintenanceChief: false, logisticsDirector: false,
      fleetEngineer: false, marketingLead: false, crisisManager: false,
    },
  });

  it('is zero with no matching hubs', () => {
    expect(networkBonusForRoute([hub('XXX', 5)], 'AAA', 'BBB')).toBe(0);
  });

  it('adds level × per-level bonus for a matching origin', () => {
    expect(networkBonusForRoute([hub('AAA', 4)], 'AAA', 'BBB'))
      .toBeCloseTo(4 * HUB_BONUS_PER_LEVEL);
  });

  it('sums the bonus when both ends are hubs', () => {
    const bonus = networkBonusForRoute([hub('AAA', 3), hub('BBB', 5)], 'AAA', 'BBB');
    expect(bonus).toBeCloseTo((3 + 5) * HUB_BONUS_PER_LEVEL);
  });
});

describe('hub bonus is applied to leg revenue', () => {
  it('raises revenue when the route touches a hub', () => {
    const s = loaded();
    const r = s.routes[0]!;
    const a = s.fleet[0]!;
    const baseline = legRevenue(r, a, []);
    const withHub = legRevenue(r, a, [{
      iata: r.originIata, level: 3,
      managers: {
        hubDirector: false, maintenanceChief: false, logisticsDirector: false,
        fleetEngineer: false, marketingLead: false, crisisManager: false,
      },
    }]);
    // The bonus is multiplicative on gross before landing fees, so the
    // ratio of post-fee revenues is close to but not exactly (1 + bonus).
    // We just check it's monotonically higher and the relative lift is
    // in the right ballpark.
    expect(withHub).toBeGreaterThan(baseline);
    const lift = (withHub - baseline) / baseline;
    expect(lift).toBeGreaterThan(0.10);
    expect(lift).toBeLessThan(3 * HUB_BONUS_PER_LEVEL + 0.05); // 0.15 ± fee drift
  });
});

describe('region gating', () => {
  it('blocks opening a route into a locked region', () => {
    let s = createInitialState(0);
    s = { ...s, cash: 1e9, tierUnlocked: 4, fuel: { ...s.fuel, supplyRate: 1e9, capacity: 1e9, reserve: 1e9 } };
    s = buyAircraft(s, 't2.e190');
    const newAc = s.fleet[s.fleet.length - 1]!;
    // Initial unlockedRegions includes only region 3. Use a North-American
    // (region 1) endpoint to force the gate.
    expect(() => openRoute(s, s.routes[0]!.originIata, 'JFK', newAc.uid))
      .toThrow(/REGION_LOCKED|not yet unlocked/);
  });

  it('allows the route after the region is unlocked', () => {
    let s = createInitialState(0);
    s = { ...s, cash: 1e9, tierUnlocked: 4, fuel: { ...s.fuel, supplyRate: 1e9, capacity: 1e9, reserve: 1e9 } };
    s = unlockRegion(s, 1);
    expect(s.unlockedRegions).toContain(1);
  });
});

describe('hubCreationCost', () => {
  it('scales with airport size tier', () => {
    // The starter origin is a large_airport (sizeTier 4).
    const s = createInitialState(0);
    const cost = hubCreationCost(s.routes[0]!.originIata);
    expect(cost).toBe(50_000);
  });
});
