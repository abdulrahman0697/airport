/**
 * UI-only state (not persisted). Lives separately from the game store
 * so its updates don't snake into the save file.
 */
import { create } from 'zustand';

interface UiStore {
  introDismissed: boolean;
  dismissIntro: () => void;
  /** SideLauncher collapsed (true = pip only, false = full rail). */
  launcherCollapsed: boolean;
  toggleLauncher: () => void;
  /** First-Takeoff cinematic has played once. */
  cinematicSeen: boolean;
  markCinematicSeen: () => void;
  /**
   * Design Review v3 — point 25. The home airport diorama is the
   * default surface; the world map is one swipe away (Network tab).
   * `mapMode` switches the home overlay off so the player sees the
   * raw map. Default false → home airport is the first thing they see.
   */
  mapMode: boolean;
  setMapMode: (v: boolean) => void;
  /**
   * Per-zone "what's open" inside the airport diorama. A tap on a
   * runway / tower / cargo apron etc. focuses the corresponding zone
   * card.
   */
  airportZoneFocus: string | null;
  setAirportZoneFocus: (zone: string | null) => void;
  /** Quick "operation stat drill-down" — null when nothing focused. */
  opsDrillDown: 'flights' | 'boarding' | 'baggage' | 'passengers' | null;
  setOpsDrillDown: (v: UiStore['opsDrillDown']) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  introDismissed: false,
  dismissIntro: (): void => set({ introDismissed: true }),
  launcherCollapsed: false,
  toggleLauncher: (): void => set((s) => ({ launcherCollapsed: !s.launcherCollapsed })),
  cinematicSeen: false,
  markCinematicSeen: (): void => set({ cinematicSeen: true }),
  mapMode: false,
  setMapMode: (v): void => set({ mapMode: v }),
  airportZoneFocus: null,
  setAirportZoneFocus: (zone): void => set({ airportZoneFocus: zone }),
  opsDrillDown: null,
  setOpsDrillDown: (v): void => set({ opsDrillDown: v }),
}));
