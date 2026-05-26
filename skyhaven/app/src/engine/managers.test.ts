import { describe, expect, it } from 'vitest';
import { ActionError, buyAircraft, hireManager, openRoute } from './actions';
import { aircraftBurnRate, aircraftEffectiveBurn, totalDemand, withRecomputedDemand } from './fuel';
import { LOGISTICS_DIRECTOR_FUEL_MULT } from './managers';
import { loadedTestState } from './test-fixtures';
import type { Hub } from './types';

function loaded() {
  // Start from the shared fixture, then strip the auto-added LHR hub
  // so the per-test "no hub" scenarios match what they assert. Tests
  // that need a hub add one explicitly.
  const s = loadedTestState();
  return { ...s, hubs: [], fleet: s.fleet.map((a) => ({ ...a, routeId: null })), routes: [] };
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
    // Start from the shared fixture which already has LHR as a hub
    // and an LHR-CDG starter route.
    let s = loadedTestState();
    const origin = s.routes[0]!.originIata; // LHR
    // Add a second aircraft on a second LHR route so the hub aircraft
    // count is two — the LD effect is per-aircraft.
    s = buyAircraft(s, 't2.e190');
    const newAc = s.fleet[s.fleet.length - 1]!;
    const r0 = s.routes[0]!;
    const otherIata = r0.destIata === 'CDG' ? 'AMS' : 'CDG';
    s = openRoute(s, origin, otherIata, newAc.uid);

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
    let s = loadedTestState();
    // Swap in a single hub at AAA (no route touches it) with LD on,
    // and ensure the LHR-CDG starter aircraft burns at the base rate.
    s = { ...s, hubs: [{ iata: 'AAA', level: 1, managers: { ...HUB_BLANK_MANAGERS, logisticsDirector: true } }] };
    s = withRecomputedDemand(s);
    const starter = s.fleet[0]!;
    const burn = aircraftEffectiveBurn(starter, s.routes, s.hubs);
    expect(burn).toBeCloseTo(aircraftBurnRate(starter), 6);
  });
});

describe('Marketing Lead', () => {
  it('adds 5% to the effective load factor of touching routes', async () => {
    const { effectiveLoadFactor } = await import('./economy');
    const s = loadedTestState();
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
