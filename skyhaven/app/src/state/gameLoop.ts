/**
 * Game loop driver.
 *
 * - Runs a 10 Hz tick interval while the page is visible.
 * - Save scheduler writes at most once per second; every tick marks the
 *   state dirty.
 * - On `visibilitychange → hidden`: stop ticks and await a final flush.
 * - On `pagehide`: best-effort final flush (the OS may kill us mid-write).
 * - On `visibilitychange → visible`: compute elapsed real time since
 *   the persisted `lastSeenTimestamp` and apply a single catch-up tick.
 *
 * The clock is injected so tests can drive it deterministically.
 */

import { createInitialState } from '../engine/initialState';
import { TICK_MS } from '../engine/tick';
import { createSaveScheduler, loadSave } from './persistence';
import { useGameStore } from './store';

export interface GameLoopDeps {
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
  let onPageHide: (() => void) | null = null;
  let onBeforeUnload: (() => void) | null = null;

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
    useGameStore.getState().applyTick({ nowMs: now, dtMs: elapsedMs });
    scheduler?.schedule();
  };

  return {
    async start(): Promise<void> {
      if (intervalId) return;

      const restored = await loadSave(deps.now());
      const initial = restored ?? createInitialState(deps.now());
      useGameStore.getState().setState(initial);

      scheduler = createSaveScheduler(() => {
        const s = useGameStore.getState().state;
        if (!s) throw new Error('gameLoop: scheduler invoked without state');
        return s;
      });

      if (restored) {
        catchUp();
        // Make sure the catch-up cash is persisted before the first tick window.
        await scheduler.flushNow();
      } else {
        // First-ever launch — persist the bootstrap immediately so a
        // force-kill in the next second still has something to load.
        scheduler.schedule();
        await scheduler.flushNow();
      }

      intervalId = setInterval(runTick, TICK_MS);

      onVisibility = (): void => {
        if (document.visibilityState === 'hidden') {
          if (intervalId) { clearInterval(intervalId); intervalId = null; }
          // Await is best-effort; if the OS suspends mid-write the
          // scheduler's periodic write from the previous second will
          // have left a recent save behind.
          void scheduler?.flushNow();
        } else {
          catchUp();
          if (!intervalId) intervalId = setInterval(runTick, TICK_MS);
        }
      };
      onPageHide = (): void => { void scheduler?.flushNow(); };
      onBeforeUnload = (): void => { void scheduler?.flushNow(); };
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('beforeunload', onBeforeUnload);
    },

    async stop(): Promise<void> {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
      if (onVisibility) { document.removeEventListener('visibilitychange', onVisibility); onVisibility = null; }
      if (onPageHide) { window.removeEventListener('pagehide', onPageHide); onPageHide = null; }
      if (onBeforeUnload) { window.removeEventListener('beforeunload', onBeforeUnload); onBeforeUnload = null; }
      if (scheduler) { await scheduler.flushNow(); scheduler.dispose(); scheduler = null; }
    },
  };
}
