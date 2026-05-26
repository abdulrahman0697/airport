import { describe, expect, it } from 'vitest';
import { migrate } from './migrations';
import { createInitialState } from './initialState';
import { CURRENT_SCHEMA_VERSION } from './types';

describe('migrate', () => {
  it('passes through a current-version save unchanged', () => {
    const s = createInitialState(123);
    const out = migrate(s);
    expect(out).toEqual(s);
  });

  it('refuses to load a save from a newer schema version', () => {
    const future = { ...createInitialState(0), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    expect(() => migrate(future)).toThrow(/newer than supported/);
  });

  it('rejects non-objects', () => {
    expect(() => migrate(null)).toThrow();
    expect(() => migrate(42)).toThrow();
  });

  it('migrates a v1 save (no events / collectibles fields) up to v2', () => {
    const v1 = {
      ...createInitialState(0),
      schemaVersion: 1,
      // Simulate a pre-Phase-6 save with these fields absent.
      activeEvents: undefined,
      collectibles: undefined,
      nextEventCheckMs: undefined,
      nextCollectibleSpawnMs: undefined,
    };
    const out = migrate(v1) as unknown as Record<string, unknown>;
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.activeEvents).toEqual([]);
    expect(out.collectibles).toEqual([]);
    expect(out.nextEventCheckMs).toBe(0);
    expect(out.nextCollectibleSpawnMs).toBe(0);
  });
});
