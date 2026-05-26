import { describe, expect, it } from 'vitest';
import { migrate } from './migrations';
import { createInitialState } from './initialState';
import { CURRENT_SCHEMA_VERSION } from './types';

describe('migrate', () => {
  it('passes through a current-version save unchanged', () => {
    const s = createInitialState(123);
    const out = migrate(s, Date.now());
    expect(out).toEqual(s);
  });

  it('refuses to load a save from a newer schema version', () => {
    const future = { ...createInitialState(0), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(() => migrate(future, Date.now())).toThrow(/newer than supported/);
  });

  it('rejects non-objects', () => {
    expect(() => migrate(null, Date.now())).toThrow();
    expect(() => migrate(42, Date.now())).toThrow();
  });

  it('migrates a v1 save up to v2, seeding schedulers in the near future', () => {
    const v1 = {
      ...createInitialState(0),
      schemaVersion: 1,
      activeEvents: undefined,
      collectibles: undefined,
      nextEventCheckMs: undefined,
      nextCollectibleSpawnMs: undefined,
    };
    const now = 1_700_000_000_000;
    const out = migrate(v1, now) as unknown as Record<string, unknown>;
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.activeEvents).toEqual([]);
    expect(out.collectibles).toEqual([]);
    // Crucially: these must be in the future, not 0. Setting them to 0
    // sends the tick into a multi-billion-iteration catch-up loop and
    // hangs the WebView (React error #185 was the user-visible result).
    expect(out.nextEventCheckMs).toBe(now + 60_000);
    expect(out.nextCollectibleSpawnMs).toBe(now + 90_000);
  });
});
