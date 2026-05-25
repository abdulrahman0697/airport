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
});
