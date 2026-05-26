/**
 * Save / load via Capacitor Preferences (BRD §14).
 *
 * Atomic-ish write: `.bak` key first, then the main key. If the process
 * dies between, on next load we fall through to `.bak` and recover the
 * previous save. Both keys carry the same `schemaVersion`.
 *
 * On web (dev preview), `@capacitor/preferences` transparently falls
 * back to `localStorage`. The same flush-on-visibility logic applies.
 *
 * Scheduler is a *throttle*, not a debounce: it writes at most once
 * every `intervalMs`, and a dirty state is *guaranteed* to flush within
 * that interval. A debounce is wrong here because every game tick would
 * reset the timer — it would never fire.
 */

import { Preferences } from '@capacitor/preferences';
import { migrate } from '../engine/migrations';
import type { SaveState } from '../engine/types';

const KEY_MAIN = 'skyhaven.savegame';
const KEY_BAK = 'skyhaven.savegame.bak';

export async function loadSave(nowMs: number): Promise<SaveState | null> {
  for (const key of [KEY_MAIN, KEY_BAK] as const) {
    try {
      const { value } = await Preferences.get({ key });
      if (!value) continue;
      const parsed = JSON.parse(value);
      const migrated = migrate(parsed, nowMs);
      return rebaseSchedulerFields(migrated, nowMs);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[skyhaven] failed to load save from ${key}:`, err);
    }
  }
  return null;
}

/**
 * After loading, normalise the new schema fields so the engine and
 * React selectors never have to handle `undefined`. The most subtle
 * symptom is React error #185: a selector like `s.activeEvents ?? []`
 * returns a *new* `[]` literal on every read when the field is
 * undefined, which makes `useSyncExternalStore` see a churning
 * snapshot and re-render in a tight loop.
 *
 * Also corrects scheduler timestamps that are absurdly far in the past
 * (e.g. a save migrated with a buggy v1→v2 that defaulted them to 0)
 * so the next tick doesn't iterate billions of catch-up rolls.
 */
function rebaseSchedulerFields(state: SaveState, nowMs: number): SaveState {
  const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const stale = (ts: unknown): boolean => !isNumber(ts) || ts < nowMs - 24 * 3600 * 1000;
  const activeEvents = Array.isArray(state.activeEvents) ? state.activeEvents : [];
  const collectibles = Array.isArray(state.collectibles) ? state.collectibles : [];
  const nextEventCheckMs = stale(state.nextEventCheckMs) ? nowMs + 60_000 : state.nextEventCheckMs;
  const nextCollectibleSpawnMs = stale(state.nextCollectibleSpawnMs) ? nowMs + 90_000 : state.nextCollectibleSpawnMs;
  if (
    activeEvents === state.activeEvents
    && collectibles === state.collectibles
    && nextEventCheckMs === state.nextEventCheckMs
    && nextCollectibleSpawnMs === state.nextCollectibleSpawnMs
  ) {
    return state;
  }
  return {
    ...state,
    activeEvents,
    collectibles,
    nextEventCheckMs,
    nextCollectibleSpawnMs,
  };
}

export async function writeSave(state: SaveState): Promise<void> {
  const value = JSON.stringify(state);
  await Preferences.set({ key: KEY_BAK, value });
  await Preferences.set({ key: KEY_MAIN, value });
}

export async function clearSave(): Promise<void> {
  await Preferences.remove({ key: KEY_MAIN });
  await Preferences.remove({ key: KEY_BAK });
}

export interface SaveScheduler {
  /** Mark the state dirty; a write will follow within `intervalMs`. */
  schedule(): void;
  /** Write the current state right now and resolve when the write completes. */
  flushNow(): Promise<void>;
  dispose(): void;
}

export function createSaveScheduler(
  getState: () => SaveState,
  intervalMs = 1000,
): SaveScheduler {
  let dirty = false;
  let inFlight: Promise<void> = Promise.resolve();
  let disposed = false;

  const doWrite = async (): Promise<void> => {
    dirty = false;
    const snapshot = getState();
    try {
      await writeSave(snapshot);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[skyhaven] save failed:', err);
      dirty = true; // try again next tick
    }
  };

  const intervalId = setInterval(() => {
    if (!dirty || disposed) return;
    inFlight = doWrite();
  }, intervalMs);

  return {
    schedule(): void {
      dirty = true;
    },
    async flushNow(): Promise<void> {
      await inFlight;
      if (dirty) {
        inFlight = doWrite();
        await inFlight;
      }
    },
    dispose(): void {
      disposed = true;
      clearInterval(intervalId);
    },
  };
}
