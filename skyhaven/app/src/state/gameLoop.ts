/**
 * Game loop driver.
 *
 * - Runs a 10 Hz tick interval while the page is visible.
 * - On `visibilitychange → hidden`: flush-save immediately and stop ticks.
 * - On `visibilitychange → visible`: compute elapsed real time since
 *   the last persisted `lastSeenTimestamp` and apply a single catch-up
 *   tick (Phase 9 swaps this for the Web Worker analytic path).
 *
 * The clock is injected so tests can drive it deterministically.
 */

import { createInitialState } from '../engine/initialState';
import { TICK_MS } from '../engine/tick';
import { createSaveScheduler, loadSave } from './persistence';
import { useGameStore } from './store';

export interface GameLoopDeps {
  /** Source of truth for "what real-time is it right now". */
  now: () => number;
}

export interface GameLoop {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

const OFFLINE_CAP_HOURS = 8;
const OFFLINE_CAP_MS = OFFLINE_CAP_HOURS * 3600 * 1000;

export function createGameLoop(deps: GameLoopDeps = { now: () => Date.now() }): GameLoop {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let scheduler: ReturnType<typeof createSaveScheduler> | null = null;
  let onVisibility: (() => void) | null = null;

  const runTick = (): void => {
    const now = deps.now();
    useGameStore.getState().applyTick({ nowMs: now, dtMs: TICK_MS });
    scheduler?.schedule();
  };

  const catchUp = (): void => {
    const cur = useGameStore.getState().state;
    if (!cur) return;
    const now = deps.now();
    const elapsedMs = Math.min(OFFLINE_CAP_MS, Math.max(0, now - cur.lastSeenTimestamp));
    if (elapsedMs <= 0) return;
    // Phase 9 will replace this with the analytic Web-Worker path;
    // for now a single big-dt tick gives correct-enough revenue accrual
    // since the Phase 2 economy is purely linear (no fuel runout, no
    // condition decay, no events). Equivalence with full-tick is tested.
    useGameStore.getState().applyTick({ nowMs: now, dtMs: elapsedMs });
  };

  return {
    async start(): Promise<void> {
      if (intervalId) return;

      const restored = await loadSave();
      const initial = restored ?? createInitialState(deps.now());
      useGameStore.getState().setState(initial);

      // If we restored, account for the time the app was closed.
      if (restored) catchUp();

      scheduler = createSaveScheduler(() => {
        const s = useGameStore.getState().state;
        if (!s) throw new Error('gameLoop: scheduler invoked without state');
        return s;
      });

      intervalId = setInterval(runTick, TICK_MS);

      onVisibility = (): void => {
        if (document.visibilityState === 'hidden') {
          if (intervalId) { clearInterval(intervalId); intervalId = null; }
          void scheduler?.flushNow();
        } else {
          catchUp();
          if (!intervalId) intervalId = setInterval(runTick, TICK_MS);
        }
      };
      document.addEventListener('visibilitychange', onVisibility);
      // Also flush on page-hide for the most reliable native suspension path.
      window.addEventListener('pagehide', () => void scheduler?.flushNow());
    },

    async stop(): Promise<void> {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      if (onVisibility) { document.removeEventListener('visibilitychange', onVisibility); onVisibility = null; }
      if (scheduler) { await scheduler.flushNow(); scheduler.dispose(); scheduler = null; }
    },
  };
}
