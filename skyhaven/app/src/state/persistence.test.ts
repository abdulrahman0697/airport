import { Preferences } from '@capacitor/preferences';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../engine/initialState';
import { createSaveScheduler, loadSave, writeSave } from './persistence';

// In-memory mock of @capacitor/preferences that matches the web behaviour.
vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => { store.set(key, value); }),
      remove: vi.fn(async ({ key }: { key: string }) => { store.delete(key); }),
      __store: store,
    },
  };
});

const prefsStore = (Preferences as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => {
  prefsStore.clear();
  vi.clearAllMocks();
});

describe('writeSave / loadSave', () => {
  it('round-trips a save', async () => {
    const s = createInitialState(123);
    s.cash = 999_999;
    await writeSave(s);
    const back = await loadSave(Date.now());
    expect(back?.cash).toBe(999_999);
  });

  it('falls back to .bak if the main slot is corrupt', async () => {
    const s = createInitialState(456);
    s.cash = 42;
    await writeSave(s);
    prefsStore.set('skyhaven.savegame.v3', '{not valid json');
    const back = await loadSave(Date.now());
    expect(back?.cash).toBe(42);
  });

  it('returns null when no save exists', async () => {
    expect(await loadSave(Date.now())).toBeNull();
  });
});

describe('createSaveScheduler — the bug the user hit', () => {
  it('actually writes when schedule() is called repeatedly', async () => {
    // Drive a synthetic clock so we can fast-forward through the throttle window.
    vi.useFakeTimers();
    const s = createInitialState(0);
    let cash = 0;
    const scheduler = createSaveScheduler(() => ({ ...s, cash }), 1000);

    // Simulate 30 ticks at 100ms each = 3 seconds of game time, repeatedly
    // marking the state dirty. Under the old debounce logic this would never
    // write because every call reset the timer.
    for (let i = 0; i < 30; i++) {
      cash += 100;
      scheduler.schedule();
      await vi.advanceTimersByTimeAsync(100);
    }

    expect((Preferences.set as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    scheduler.dispose();
    vi.useRealTimers();
  });

  it('flushNow writes immediately', async () => {
    vi.useFakeTimers();
    const s = createInitialState(0);
    let cash = 50_000;
    const scheduler = createSaveScheduler(() => ({ ...s, cash }), 5000);
    scheduler.schedule();
    cash = 75_000;
    await scheduler.flushNow();

    const back = await loadSave(Date.now());
    expect(back?.cash).toBe(75_000);
    scheduler.dispose();
    vi.useRealTimers();
  });
});
