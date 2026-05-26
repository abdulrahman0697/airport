/**
 * Shared test fixtures.
 *
 * The Phase-10 hub rework removed the auto-created starter route and
 * auto-promoted hub from `createInitialState`. Test cases that need
 * "a player partway through the game" should call `loadedTestState()`
 * which adds a hub at LHR and a starter LHR → CDG route. Keeps the
 * pre-rework assumptions valid without touching every test file.
 */
import { haversineKm } from './distance';
import { withRecomputedDemand } from './fuel';
import { emptyHubManagers } from './hubs';
import { createInitialState } from './initialState';
import { loadTopAirports } from '../data/airports';
import type { Route, SaveState } from './types';

/** Generous state for action / behaviour tests. */
export function loadedTestState(): SaveState {
  const base = createInitialState(0, 3);
  const airports = loadTopAirports();
  const lhr = airports.find((a) => a.iata === 'LHR');
  const cdg = airports.find((a) => a.iata === 'CDG');
  const aircraft = base.fleet[0]!;

  const starterRoute: Route | null = (lhr && cdg) ? {
    id: 'rt-0001',
    originIata: 'LHR',
    destIata: 'CDG',
    distanceKm: haversineKm(lhr.lat, lhr.lon, cdg.lat, cdg.lon),
    aircraftUid: aircraft.uid,
    pricing: 'balanced',
    loadFactor: 0.6,
    legProgress: 0,
    legDirection: 'outbound',
  } : null;

  const s: SaveState = {
    ...base,
    cash: 10_000_000_000,
    tierUnlocked: 4,
    lifetimeEarnings: 10_000_000_000,
    unlockedRegions: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    fuel: { ...base.fuel, supplyRate: 1_000_000, capacity: 10_000_000, reserve: 10_000_000 },
    hubs: [{ iata: 'LHR', level: 1, managers: emptyHubManagers() }],
    fleet: starterRoute
      ? [{ ...aircraft, routeId: starterRoute.id }]
      : base.fleet,
    routes: starterRoute ? [starterRoute] : [],
    pendingHubPickRegion: null,
    tutorialCompleted: true,
    // The fixture pre-credits a huge lifetimeEarnings; mark the
    // goal-chain as graduated and the vintage milestones as consumed
    // so the tick doesn't fire a flood of retroactive rewards on the
    // first call and confuse cash-related assertions.
    goalChainStep: 8,
    vintageMilestonesConsumed: 1000,
  };
  return withRecomputedDemand(s);
}
