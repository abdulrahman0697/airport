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

export async function loadSave(): Promise<SaveState | null> {
  for (const key of [KEY_MAIN, KEY_BAK] as const) {
    try {
      const { value } = await Preferences.get({ key });
      if (!value) continue;
      const parsed = JSON.parse(value);
      return migrate(parsed);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[skyhaven] failed to load save from ${key}:`, err);
    }
  }
  return null;
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
