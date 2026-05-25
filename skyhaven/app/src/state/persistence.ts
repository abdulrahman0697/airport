/**
 * Save / load via Capacitor Preferences (BRD §14).
 *
 * Atomic-ish write: we write the `.bak` key first, then the main key.
 * If the process dies between, on next load we fall through to the
 * `.bak` and recover the previous save. Both keys carry the same
 * `schemaVersion` so migration is consistent regardless of which we
 * end up restoring.
 *
 * On web (dev preview), `@capacitor/preferences` transparently falls
 * back to `localStorage`. The same flush-on-visibility logic applies.
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
  // .bak first so the main slot is only updated once we're sure the
  // serialised string is valid and the platform accepted the write.
  await Preferences.set({ key: KEY_BAK, value });
  await Preferences.set({ key: KEY_MAIN, value });
}

export async function clearSave(): Promise<void> {
  await Preferences.remove({ key: KEY_MAIN });
  await Preferences.remove({ key: KEY_BAK });
}

/**
 * Debounced save scheduler.
 *
 * `schedule()` queues a flush in `debounceMs` ms; calling again before
 * the timer fires resets it. `flushNow()` bypasses the debounce and is
 * called from `visibilitychange → hidden` so the OS suspending the WebView
 * never strands an unsaved tick.
 */
export function createSaveScheduler(
  getState: () => SaveState,
  debounceMs = 1000,
): { schedule: () => void; flushNow: () => Promise<void>; dispose: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  const doWrite = async (): Promise<void> => {
    const snapshot = getState();
    try {
      await writeSave(snapshot);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[skyhaven] save failed:', err);
    }
  };

  return {
    schedule(): void {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        inFlight = doWrite();
      }, debounceMs);
    },
    async flushNow(): Promise<void> {
      if (timer) { clearTimeout(timer); timer = null; }
      await inFlight;
      inFlight = doWrite();
      await inFlight;
    },
    dispose(): void {
      if (timer) { clearTimeout(timer); timer = null; }
    },
  };
}
