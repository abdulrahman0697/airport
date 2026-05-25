/**
 * Save-game schema migrations.
 *
 * Each entry takes a save at version `from` and returns a save at
 * `from + 1`. The runner walks the chain from the persisted version up
 * to `CURRENT_SCHEMA_VERSION`. Forward-only — we never downgrade a save.
 *
 * Every breaking change to `SaveState` adds:
 *   1) A migration here.
 *   2) A bump of `CURRENT_SCHEMA_VERSION` in `types.ts`.
 *   3) A test case below pinning the migration's input → output shape.
 *
 * The Phase 2 baseline is v1 (no prior schema).
 */

import { CURRENT_SCHEMA_VERSION } from './types';
import type { SaveState } from './types';

type Migration = (input: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {
  // Future migrations land here, e.g.:
  // 1: (s) => ({ ...s, schemaVersion: 2, newField: defaultValue }),
};

/**
 * Bring a persisted save up to the current schema. Throws if the save
 * is from a newer version than the running app supports.
 */
export function migrate(raw: unknown): SaveState {
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
    cur = step(cur);
  }
  return cur as unknown as SaveState;
}
