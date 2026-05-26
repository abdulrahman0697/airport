/**
 * Engine state schema (BRD §17.2, extended per planning notes).
 *
 * This is the canonical authoritative state shape. The Zustand store
 * holds an instance; persistence serialises it with `schemaVersion`.
 *
 * Anything added here must also be handled by a migration in
 * `migrations.ts` and bumps `CURRENT_SCHEMA_VERSION`.
 */

export const CURRENT_SCHEMA_VERSION = 6;

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

export interface ActiveEvent {
  readonly id: string;
  readonly kind: import('../data/events').EventKind;
  /** null for global events, region id otherwise. */
  readonly regionId: number | null;
  /** Epoch ms when the event was announced (popup phase begins). */
  readonly announcedAt: number;
  /** Epoch ms when the event becomes active (banner + effects begin). */
  readonly startedAt: number;
  /** Real-time duration of the active phase in ms. */
  readonly durationMs: number;
}

export interface Collectible {
  readonly id: string;
  readonly lat: number;
  readonly lon: number;
  /** Epoch ms when this collectible was spawned. */
  readonly spawnedAt: number;
  /** Epoch ms after which the collectible despawns un-claimed. */
  readonly expiresAt: number;
  readonly reward: { kind: 'cash' | 'fuel'; amount: number };
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

  /** Live events currently affecting the airline (Phase 6 §4.12). */
  activeEvents: readonly ActiveEvent[];
  /** Drifting roaming collectibles awaiting a tap (Phase 6 §4.12). */
  collectibles: readonly Collectible[];
  /** Epoch ms after which the next event-spawn roll should happen. */
  nextEventCheckMs: number;
  /** Epoch ms after which the next collectible-spawn roll should happen. */
  nextCollectibleSpawnMs: number;

  /** IDs of collected classic aircraft (BRD §4.9). */
  vintage: string[];
  /**
   * Total lifetime-earning vintage milestones the player has been awarded.
   * Each milestone yields either a new classic or, once the set is full,
   * a cash bonus. Tracked separately from `vintage.length` because the
   * post-completion milestones also count.
   */
  vintageMilestonesConsumed: number;
  /** Most recent un-acknowledged classic drop (UI shows a popup). */
  pendingVintageDrop: string | null;
  /** Eco Rating score 0..100 (BRD §4.10). */
  ecoRating: number;
  achievements: string[];

  // ── Player journey (Phase 9 / BRD §5) ────────────────────────────
  /** Has the player completed the playable tutorial? */
  tutorialCompleted: boolean;
  /** Current step within the tutorial (0..N). */
  tutorialStep: number;
  /**
   * Current step within the early-goal chain (0..8). 8 == graduated.
   * Each goal awards cash on completion; the tick auto-detects them.
   */
  goalChainStep: number;
  /** Cash earned during the most recent catch-up window, awaiting modal ack. */
  pendingOfflineSummary: { elapsedMs: number; earnings: number } | null;
  /** Daily-login bookkeeping. */
  lastLoginDate: string | null; // ISO yyyy-mm-dd
  loginStreak: number;
  /** A daily-login reward awaiting modal ack. */
  pendingDailyReward: { day: number; amount: number } | null;
  /**
   * After unlocking a region the UI prompts for a free hub pick in it.
   * Null when no pick is outstanding.
   */
  pendingHubPickRegion: number | null;
}
