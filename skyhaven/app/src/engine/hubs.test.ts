import { describe, expect, it } from 'vitest';
import { loadTopAirports } from '../data/airports';
import { ActionError, createHub, openRoute, upgradeHub, buyAircraft, unlockRegion } from './actions';
import {
  HUB_BONUS_PER_LEVEL,
  hubCreationCost,
  hubUpgradeCost,
  MAX_HUB_LEVEL,
  networkBonusForRoute,
  routesAtAirport,
} from './hubs';
import { legRevenue } from './economy';
import { loadedTestState } from './test-fixtures';
import type { Hub } from './types';

function loaded() {
  return loadedTestState();
}

describe('routesAtAirport', () => {
  it('counts routes that touch either end', () => {
    const s = loaded();
    expect(routesAtAirport(s, s.routes[0]!.originIata)).toBe(1);
    expect(routesAtAirport(s, s.routes[0]!.destIata)).toBe(1);
    expect(routesAtAirport(s, 'ZZZ')).toBe(0);
  });
});

describe('createHub / pickHub (Phase 10 rework)', () => {
  it('rejects creating a hub at an airport that is already one', () => {
    const s = loaded(); // already has LHR as a hub
    try {
      createHub(s, 'LHR');
      throw new Error('expected throw');
    } catch (e) {
      expect((e as ActionError).code).toBe('HUB_EXISTS');
    }
  });

  it('creates a hub at any unlocked airport (no ≥2 route requirement)', () => {
    // The pre-Phase-10 createHub required ≥ 2 routes touching the
    // airport. With the hub rework that gate is gone — any airport in
    // an unlocked region can become a hub for a one-time fee.
    const s = loaded();
    const airports = loadTopAirports();
    const candidate = airports.find((a) =>
      a.iata !== 'LHR' && a.region === 3 && a.sizeTier === 4,
    );
    if (!candidate) throw new Error('no candidate hub airport');
    const before = s.cash;
    const after = createHub(s, candidate.iata);
    expect(after.hubs.find((h) => h.iata === candidate.iata)?.level).toBe(1);
    // Second hub in the same region is paid.
    expect(after.cash).toBeLessThan(before);
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
    let s = loaded();
    // Re-lock the NA region so we can verify the gate fires.
    s = { ...s, unlockedRegions: [3] };
    s = buyAircraft(s, 't2.e190');
    const newAc = s.fleet[s.fleet.length - 1]!;
    expect(() => openRoute(s, 'LHR', 'JFK', newAc.uid))
      .toThrow(/REGION_LOCKED|not yet unlocked/);
  });

  it('allows the route after the region is unlocked', () => {
    let s = loaded();
    s = { ...s, unlockedRegions: [3] };
    s = unlockRegion(s, 1);
    expect(s.unlockedRegions).toContain(1);
  });
});

describe('hubCreationCost', () => {
  it('scales with airport size tier', () => {
    // LHR is a large_airport (sizeTier 4).
    expect(hubCreationCost('LHR')).toBe(50_000);
  });
});
