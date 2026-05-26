/**
 * Bootstrap a fresh airline.
 *
 * Phase 10+ starter state: the player has a single idle Tier-1 turbo-
 * prop and ZERO routes / hubs. The tutorial walks them through naming
 * the airline, picking a home airport (their first hub), securing
 * fuel, and opening their first route. Without that the new-route
 * action can't even succeed — origin must be a hub (BRD §4.3 + locked
 * decision after Phase 10 owner feedback).
 */

import { AIRCRAFT_DEFS, getAircraftDef } from '../data/aircraft';
import { FUEL_CAPACITY_TIERS } from '../data/fuelCapacity';
import { FUEL_CONTRACTS } from '../data/fuelContracts';
import type { OwnedAircraft, SaveState } from './types';
import { CURRENT_SCHEMA_VERSION } from './types';

const STARTER_AIRLINE_NAME = 'SkyHaven Airlines';
const STARTER_TAIL_COLOR = '#5AC8FA';
const STARTER_CODE = 'SH';
// TEMP (Phase 5 testing): bumped from $25K → $2M so the owner can
// exercise region unlocks ($250K+) and hub creation without grinding.
// REVERT TO 25_000 BEFORE PHASE 17 LAUNCH PREP. The BRD §20.5 acceptance
// criterion targets the $25K → $10M growth curve.
const STARTER_CASH = 2_000_000;
const STARTER_AIRCRAFT_DEF = 't1.atr42';
const STARTER_CONTRACT = 'fc.starter';

export function createInitialState(nowMs: number, homeRegion = 3): SaveState {
  const def = getAircraftDef(STARTER_AIRCRAFT_DEF) ?? AIRCRAFT_DEFS[0]!;

  const aircraft: OwnedAircraft = {
    uid: 'ac-0001',
    defId: def.id,
    condition: 100,
    flightHoursAccumulated: 0,
    upgrades: { engine: 0, cabin: 0, fuelEff: 0, marketing: 0 },
    routeId: null,
  };

  const starterContract = FUEL_CONTRACTS.find((c) => c.id === STARTER_CONTRACT)!;
  const starterCapacity = FUEL_CAPACITY_TIERS[0]!.capacity;

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
    routes: [],
    hubs: [],
    fuel: {
      reserve: starterCapacity,
      capacity: starterCapacity,
      supplyRate: starterContract.supplyRatePerSec,
      demandRate: 0,
      contracts: [STARTER_CONTRACT],
    },
    unlockedRegions: [homeRegion],
    tierUnlocked: 1,
    activeEvents: [],
    collectibles: [],
    nextEventCheckMs: nowMs + 60_000,
    nextCollectibleSpawnMs: nowMs + 90_000,
    vintage: [],
    vintageMilestonesConsumed: 0,
    pendingVintageDrop: null,
    ecoRating: 0,
    achievements: [],
    tutorialCompleted: false,
    tutorialStep: 0,
    goalChainStep: 0,
    pendingOfflineSummary: null,
    lastLoginDate: null,
    loginStreak: 0,
    pendingDailyReward: null,
    // Home airport pick is the very first interactive tutorial step —
    // pre-set the home region so the picker knows what to offer.
    pendingHubPickRegion: homeRegion,
  };
}
