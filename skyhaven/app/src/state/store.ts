/**
 * Game state store.
 *
 * The store owns the canonical `SaveState`. The engine is invoked
 * imperatively via `applyTick` (or `applyOfflineCatchup`) — Zustand is
 * not used as the simulator, it's the *holder*. This keeps the engine
 * pure and Web-Worker-friendly (Phase 9).
 */

import { create } from 'zustand';
import { tick, type TickContext } from '../engine/tick';
import type { SaveState } from '../engine/types';

interface GameStore {
  state: SaveState | null;
  /** Replace the entire state (load / reset / migration). */
  setState: (next: SaveState) => void;
  /** Advance the engine by a TickContext. */
  applyTick: (ctx: TickContext) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  setState: (next): void => set({ state: next }),
  applyTick: (ctx): void => {
    const cur = get().state;
    if (!cur) return;
    set({ state: tick(cur, ctx) });
  },
}));

/** Selector helpers — keep React renders narrow. */
export const selectCash = (s: GameStore): number => s.state?.cash ?? 0;
export const selectAirlineName = (s: GameStore): string => s.state?.airlineName ?? '';
export const selectTailColor = (s: GameStore): string => s.state?.tailColor ?? '#5AC8FA';
