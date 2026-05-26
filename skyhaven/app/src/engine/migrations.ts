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
