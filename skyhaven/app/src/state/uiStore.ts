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
}

export const useUiStore = create<UiStore>((set) => ({
  introDismissed: false,
  dismissIntro: (): void => set({ introDismissed: true }),
  launcherCollapsed: false,
  toggleLauncher: (): void => set((s) => ({ launcherCollapsed: !s.launcherCollapsed })),
}));
