/**
 * Bootstrap a fresh airline.
 *
 * Phase 2 starter state: one Tier-1 turboprop on one short regional route.
 * Phase 4: also grants the free starter fuel contract and Level-0 capacity.
 * Phase 9's playable tutorial replaces the canned name / route with the
 * player's choices.
 */

import { AIRCRAFT_DEFS, getAircraftDef } from '../data/aircraft';
import { loadTopAirports, type Airport } from '../data/airports';
import { FUEL_CAPACITY_TIERS } from '../data/fuelCapacity';
import { FUEL_CONTRACTS } from '../data/fuelContracts';
import { haversineKm } from './distance';
import { aircraftBurnRate } from './fuel';
import type { OwnedAircraft, Route, SaveState } from './types';
import { CURRENT_SCHEMA_VERSION } from './types';

const STARTER_AIRLINE_NAME = 'SkyHaven Airlines';
const STARTER_TAIL_COLOR = '#5AC8FA';
const STARTER_CODE = 'SH';
const STARTER_CASH = 25_000;
const STARTER_AIRCRAFT_DEF = 't1.atr42';
const STARTER_CONTRACT = 'fc.starter';

function pickStarterRoute(airports: readonly Airport[], maxKm: number):
  { origin: Airport; dest: Airport; distanceKm: number } | null {
  const europe = airports.filter((a) => a.region === 3 && a.sizeTier === 4);
  const candidates = europe.length >= 2 ? europe : airports.filter((a) => a.sizeTier === 4);
  if (candidates.length < 2) return null;
  let best: { origin: Airport; dest: Airport; distanceKm: number } | null = null;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]!;
      const b = candidates[j]!;
      const d = haversineKm(a.lat, a.lon, b.lat, b.lon);
      if (d >= 200 && d <= maxKm) {
        if (!best || d < best.distanceKm) {
          best = { origin: a, dest: b, distanceKm: d };
        }
      }
    }
    if (best && best.distanceKm < 400) break;
  }
  return best;
}

export function createInitialState(nowMs: number): SaveState {
  const airports = loadTopAirports();
  const def = getAircraftDef(STARTER_AIRCRAFT_DEF) ?? AIRCRAFT_DEFS[0]!;
  const route = pickStarterRoute(airports, def.rangeKm);

  const aircraft: OwnedAircraft = {
    uid: 'ac-0001',
    defId: def.id,
    condition: 100,
    flightHoursAccumulated: 0,
    upgrades: { engine: 0, cabin: 0, fuelEff: 0, marketing: 0 },
    routeId: route ? 'rt-0001' : null,
  };

  const routes: Route[] = route
    ? [{
        id: 'rt-0001',
        originIata: route.origin.iata,
        destIata: route.dest.iata,
        distanceKm: route.distanceKm,
        aircraftUid: aircraft.uid,
        pricing: 'balanced',
        loadFactor: 0.6,
        legProgress: 0,
        legDirection: 'outbound',
      }]
    : [];

  const starterContract = FUEL_CONTRACTS.find((c) => c.id === STARTER_CONTRACT)!;
  const starterCapacity = FUEL_CAPACITY_TIERS[0]!.capacity;
  const starterDemand = routes.length > 0 ? aircraftBurnRate(aircraft) : 0;

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lastSeenTimestamp: nowMs,
    seed: 0xC0FFEE,
    airlineName: STARTER_AIRLINE_NAME,
    tailColor: STARTER_TAIL_COLOR,
    code: STARTER_CODE,
    cash: STARTER_CASH,
    lifetimeEarnings: 0,
    fleet: [aircraft],
    routes,
    hubs: [],
    fuel: {
      reserve: starterCapacity, // start topped off
      capacity: starterCapacity,
      supplyRate: starterContract.supplyRatePerSec,
      demandRate: starterDemand,
      contracts: [STARTER_CONTRACT],
    },
    unlockedRegions: [3],
    tierUnlocked: 1,
    vintage: [],
    ecoRating: 0,
    achievements: [],
  };
}
