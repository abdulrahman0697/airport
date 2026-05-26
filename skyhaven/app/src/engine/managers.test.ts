import { describe, expect, it } from 'vitest';
import { ActionError, buyAircraft, createHub, hireManager, openRoute } from './actions';
import { aircraftBurnRate, aircraftEffectiveBurn, totalDemand, withRecomputedDemand } from './fuel';
import { createInitialState } from './initialState';
import { LOGISTICS_DIRECTOR_FUEL_MULT } from './managers';
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

const HUB_BLANK_MANAGERS: Hub['managers'] = {
  hubDirector: false, maintenanceChief: false, logisticsDirector: false,
  fleetEngineer: false, marketingLead: false, crisisManager: false,
};

describe('hireManager', () => {
  it('refuses if no hub at the airport', () => {
    const s = loaded();
    try {
      hireManager(s, 'ZZZ', 'logisticsDirector');
      throw new Error('expected throw');
    } catch (e) {
      expect((e as ActionError).code).toBe('NO_HUB');
    }
  });

  it('refuses double-hiring the same manager', () => {
    const s = { ...loaded(), hubs: [{ iata: 'AAA', level: 1, managers: HUB_BLANK_MANAGERS }] };
    const s1 = hireManager(s, 'AAA', 'logisticsDirector');
    expect(() => hireManager(s1, 'AAA', 'logisticsDirector')).toThrow(/already/);
  });

  it('charges baseCost × hub.level', () => {
    const s = { ...loaded(), hubs: [{ iata: 'AAA', level: 3, managers: HUB_BLANK_MANAGERS }] };
    const before = s.cash;
    const s1 = hireManager(s, 'AAA', 'logisticsDirector');
    expect(before - s1.cash).toBe(40_000 * 3);
  });
});

describe('Logistics Director (BRD §4.11 acceptance)', () => {
  it('cuts the burn rate of hub aircraft by 25%', () => {
    let s = loaded();
    const origin = s.routes[0]!.originIata;
    // Bring the starter origin up to 2 routes so it can become a hub.
    s = buyAircraft(s, 't2.e190');
    const newAc = s.fleet[s.fleet.length - 1]!;
    // Pick any other large EU airport in range.
    const r0 = s.routes[0]!;
    const otherIata = r0.destIata === 'CDG' ? 'AMS' : 'CDG';
    s = openRoute(s, origin, otherIata, newAc.uid);
    s = createHub(s, origin);

    const baseDemand = s.fuel.demandRate;
    const baseTwo = totalDemand(s);
    expect(baseTwo).toBeCloseTo(baseDemand, 4);

    s = hireManager(s, origin, 'logisticsDirector');

    // Both aircraft (starter at this hub + the one we just opened) burn 25% less.
    const afterDemand = totalDemand(s);
    expect(afterDemand).toBeCloseTo(baseDemand * LOGISTICS_DIRECTOR_FUEL_MULT, 4);
    expect(s.fuel.demandRate).toBeCloseTo(afterDemand, 4);
  });

  it('does not affect aircraft on routes that miss the hub', () => {
    let s = loaded();
    // Hub at AAA with Logistics Director.
    s = { ...s, hubs: [{ iata: 'AAA', level: 1, managers: { ...HUB_BLANK_MANAGERS, logisticsDirector: true } }] };
    s = withRecomputedDemand(s);
    // Starter aircraft is on a route that doesn't touch AAA.
    const starter = s.fleet[0]!;
    const burn = aircraftEffectiveBurn(starter, s.routes, s.hubs);
    expect(burn).toBeCloseTo(aircraftBurnRate(starter), 6);
  });
});

describe('Marketing Lead', () => {
  it('adds 5% to the effective load factor of touching routes', async () => {
    const { effectiveLoadFactor } = await import('./economy');
    let s = loaded();
    const route = s.routes[0]!;
    const baseLoad = effectiveLoadFactor(route, [], []);
    const withMktg = effectiveLoadFactor(
      route,
      [{ iata: route.originIata, level: 1, managers: { ...HUB_BLANK_MANAGERS, marketingLead: true } }],
      [],
    );
    expect(withMktg).toBeCloseTo(baseLoad + 0.05, 4);
    void s;
  });
});
