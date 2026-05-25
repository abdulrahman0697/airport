/**
 * Engine state schema (BRD §17.2, extended per planning notes).
 *
 * This is the canonical authoritative state shape. The Zustand store
 * holds an instance; persistence serialises it with `schemaVersion`.
 *
 * Anything added here must also be handled by a migration in
 * `migrations.ts` and bumps `CURRENT_SCHEMA_VERSION`.
 */

export const CURRENT_SCHEMA_VERSION = 1;

export type AircraftCategory = 'passenger' | 'cargo' | 'classic';
export type RoutePricing = 'economy' | 'balanced' | 'premium';

export interface AircraftDef {
  readonly id: string;
  readonly displayName: string;
  readonly tier: number;            // 1..8 for passenger, 0 for cargo/classic
  readonly category: AircraftCategory;
  readonly capacity: number;        // seats (passenger) or cargo units
  readonly rangeKm: number;
  readonly cruiseSpeedKmh: number;  // game-time speed; tuned via TIME_COMPRESSION
  readonly fuelPerHour: number;
  readonly basePurchaseCost: number;
  readonly conditionDecayRate: number;
  readonly artId: string;
}

export interface OwnedAircraft {
  readonly uid: string;
  readonly defId: string;
  /** 0..100. Decays with flight hours; gated by Maintenance Chief (Phase 6). */
  condition: number;
  /** Cumulative flight hours, used for deterministic condition decay. */
  flightHoursAccumulated: number;
  upgrades: {
    engine: number;
    cabin: number;
    fuelEff: number;
    marketing: number;
  };
  /** Assigned route uid, or null if idle in hangar. */
  routeId: string | null;
}

export interface Route {
  readonly id: string;
  readonly originIata: string;
  readonly destIata: string;
  /** Cached great-circle distance in km. */
  readonly distanceKm: number;
  readonly aircraftUid: string;
  pricing: RoutePricing;
  /** 0..1, currently-cached load factor (Brand Marketing × Premium penalty). */
  loadFactor: number;
  /** 0..1 progress through the current leg; flips direction on completion. */
  legProgress: number;
  /** Which way the plane is currently flying. */
  legDirection: 'outbound' | 'inbound';
}

export interface Hub {
  readonly iata: string;
  level: number;
  managers: {
    hubDirector: boolean;
    maintenanceChief: boolean;
    logisticsDirector: boolean;
    fleetEngineer: boolean;
    marketingLead: boolean;
    crisisManager: boolean;
  };
}

export interface FuelState {
  reserve: number;
  capacity: number;
  supplyRate: number;
  demandRate: number;
  contracts: string[];
}

export interface SaveState {
  schemaVersion: number;
  /** Epoch ms of last engine integration. Drives offline catch-up. */
  lastSeenTimestamp: number;
  /** Deterministic PRNG seed for random events. */
  seed: number;

  airlineName: string;
  tailColor: string;
  /** Two-letter airline code, derived from name in onboarding. */
  code: string;

  cash: number;
  lifetimeEarnings: number;

  fleet: OwnedAircraft[];
  routes: Route[];
  hubs: Hub[];
  fuel: FuelState;

  unlockedRegions: number[];
  tierUnlocked: number;

  vintage: string[];
  ecoRating: number;
  achievements: string[];
}
