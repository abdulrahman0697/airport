/**
 * Save-game schema migrations.
 *
 * Each entry takes a save at version `from` and returns a save at
 * `from + 1`. The runner walks the chain from the persisted version up
 * to `CURRENT_SCHEMA_VERSION`. Forward-only — we never downgrade a save.
 *
 * Migrations are passed `nowMs` so they can seed timestamp fields (next
 * event check, next collectible spawn, etc.) relative to wall-clock
 * time. Setting these to `0` is a bug: the v6 tick rolls events in a
 * `while (ctx.nowMs >= nextCheckMs)` loop and overshoots by billions
 * of iterations.
 *
 * Every breaking change to `SaveState` adds:
 *   1) A migration here.
 *   2) A bump of `CURRENT_SCHEMA_VERSION` in `types.ts`.
 *   3) A test case in `migrations.test.ts`.
 */

import { CURRENT_SCHEMA_VERSION } from './types';
import type { SaveState } from './types';

type Migration = (
  input: Record<string, unknown>,
  nowMs: number,
) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2 (Phase 6): introduce live events + roaming collectibles.
  // Seed next-check / next-spawn timestamps in the near future so the
  // first post-migration tick doesn't try to catch up the schedule
  // from the Unix epoch.
  1: (s, nowMs) => ({
    ...s,
    schemaVersion: 2,
    activeEvents: [],
    collectibles: [],
    nextEventCheckMs: nowMs + 60_000,
    nextCollectibleSpawnMs: nowMs + 90_000,
  }),
  // v2 → v3 (Phase 6 polish): events now have an `announcedAt` field
  // so the UI can render an explanatory popup before the banner. v2
  // events get `announcedAt = startedAt` so they skip the announce
  // phase and behave exactly as before.
  2: (s) => ({
    ...s,
    schemaVersion: 3,
    activeEvents: (Array.isArray(s.activeEvents) ? s.activeEvents : []).map((e) => {
      const evt = e as Record<string, unknown>;
      return {
        ...evt,
        announcedAt: typeof evt.announcedAt === 'number' ? evt.announcedAt : evt.startedAt,
      };
    }),
  }),
  // v3 → v4 (Phase 8): vintage milestones tracked separately so post-
  // completion cash awards don't double-fire. Existing classics count
  // as already-consumed milestones so the tick doesn't reroll them.
  3: (s) => {
    const existing = (s as Record<string, unknown>).vintageMilestonesConsumed;
    const vintageLen = Array.isArray(s.vintage) ? (s.vintage as unknown[]).length : 0;
    return {
      ...s,
      schemaVersion: 4,
      vintageMilestonesConsumed: typeof existing === 'number' ? existing : vintageLen,
      pendingVintageDrop: null,
    };
  },
  // v4 → v5 (Phase 9): adds tutorial / goal-chain / offline-summary /
  // daily-login fields. Pre-Phase-9 players have already been past the
  // intro experience by definition, so we mark the tutorial and goal
  // chain as completed for them. Daily-login starts fresh.
  4: (s) => ({
    ...s,
    schemaVersion: 5,
    tutorialCompleted: true,
    tutorialStep: 0,
    goalChainStep: 8,
    pendingOfflineSummary: null,
    lastLoginDate: null,
    loginStreak: 0,
    pendingDailyReward: null,
  }),
  // v5 → v6 (Phase 10 polish): hub system rework. Routes must now
  // originate from a hub. To keep existing routes valid we promote
  // each route's origin into a hub (free, level 1) if it isn't one
  // already. New pendingHubPickRegion field defaults to null.
  5: (s) => {
    const routes = (Array.isArray(s.routes) ? s.routes : []) as Array<{ originIata?: string }>;
    const hubs = (Array.isArray(s.hubs) ? s.hubs.slice() : []) as Array<{
      iata: string;
      level: number;
      managers: Record<string, boolean>;
    }>;
    const known = new Set(hubs.map((h) => h.iata));
    const emptyManagers = {
      hubDirector: false, maintenanceChief: false, logisticsDirector: false,
      fleetEngineer: false, marketingLead: false, crisisManager: false,
    };
    for (const r of routes) {
      const iata = r.originIata;
      if (!iata || known.has(iata)) continue;
      hubs.push({ iata, level: 1, managers: { ...emptyManagers } });
      known.add(iata);
    }
    return { ...s, schemaVersion: 6, hubs, pendingHubPickRegion: null };
  },
  // v6 → v7 (Phase 12): adds createdAtMs for leaderboard plausibility
  // (BRD §12.4). Existing players have no recorded start time; we'd
  // rather over-credit session time (looser cap) than under-credit
  // (false-flag legit players), so we default to a year ago. That
  // makes the per-second cap effectively non-binding for old saves
  // while the absolute caps still hold.
  6: (s, nowMs) => ({
    ...s,
    schemaVersion: 7,
    createdAtMs: typeof (s as Record<string, unknown>).createdAtMs === 'number'
      ? (s as Record<string, unknown>).createdAtMs
      : nowMs - 365 * 24 * 60 * 60 * 1000,
  }),
  // v7 → v8 (Phase 14): daily-mission tracking. Default both fields
  // to null so the next tick on the player's day will roll a fresh
  // set against the live state.
  7: (s) => ({
    ...s,
    schemaVersion: 8,
    dailyMissions: null,
    dailyMissionSnapshot: null,
  }),
  // v8 → v9: aircraft become hub-scoped. Each OwnedAircraft gains a
  // homeHubIata field. We back-fill from the aircraft's current route
  // origin if there is one, falling back to the first hub. Aircraft
  // with no route and no hubs stay null (legacy starter case) — the
  // first pickHub call after upgrade will assign them.
  8: (s) => {
    const fleet = (Array.isArray(s.fleet) ? s.fleet : []) as Array<Record<string, unknown>>;
    const routes = (Array.isArray(s.routes) ? s.routes : []) as Array<{
      id: string; originIata: string;
    }>;
    const hubs = (Array.isArray(s.hubs) ? s.hubs : []) as Array<{ iata: string }>;
    const firstHub = hubs[0]?.iata ?? null;
    const routeOriginByAircraft = new Map<string, string>();
    for (const r of routes) {
      // Routes' aircraftUid lives outside the route id; resolve via
      // fleet entries below if necessary.
      void r;
    }
    for (const a of fleet) {
      const routeId = typeof a.routeId === 'string' ? a.routeId : null;
      if (routeId) {
        const r = routes.find((x) => x.id === routeId);
        if (r) routeOriginByAircraft.set(String(a.uid), r.originIata);
      }
    }
    return {
      ...s,
      schemaVersion: 9,
      fleet: fleet.map((a) => ({
        ...a,
        homeHubIata: typeof a.homeHubIata === 'string'
          ? a.homeHubIata
          : (routeOriginByAircraft.get(String(a.uid)) ?? firstHub),
      })),
    };
  },
  // v9 → v10: aircraft upgrades capped at 5 levels per kind (was 10).
  // Older saves may have engine / cabin / marketing values up to 10;
  // clamp them so the new max-level UI doesn't show "8/5" oddities.
  // Players don't lose effect — the per-level coefficient was doubled
  // at the same time so a clamped L5 matches the old L10.
  9: (s) => {
    const fleet = (Array.isArray(s.fleet) ? s.fleet : []) as Array<Record<string, unknown>>;
    return {
      ...s,
      schemaVersion: 10,
      fleet: fleet.map((a) => {
        const u = (a.upgrades ?? {}) as Record<string, number>;
        return {
          ...a,
          upgrades: {
            engine: Math.min(5, Math.max(0, u.engine ?? 0)),
            cabin: Math.min(5, Math.max(0, u.cabin ?? 0)),
            fuelEff: Math.min(5, Math.max(0, u.fuelEff ?? 0)),
            marketing: Math.min(5, Math.max(0, u.marketing ?? 0)),
          },
        };
      }),
    };
  },
};

/**
 * Bring a persisted save up to the current schema. Throws if the save
 * is from a newer version than the running app supports.
 */
export function migrate(raw: unknown, nowMs: number): SaveState {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('migrate: input is not an object');
  }
  let cur = raw as Record<string, unknown>;
  const startVersion = typeof cur.schemaVersion === 'number' ? cur.schemaVersion : 0;
  if (startVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Save schemaVersion ${startVersion} is newer than supported ${CURRENT_SCHEMA_VERSION}. ` +
      'Upgrade the app to load this save.',
    );
  }
  for (let v = startVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`Missing migration ${v} → ${v + 1}`);
    cur = step(cur, nowMs);
  }
  return cur as unknown as SaveState;
}
