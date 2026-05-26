/**
 * UI-only state (not persisted). Lives separately from the game store
 * so its updates don't snake into the save file.
 */
import { create } from 'zustand';

interface UiStore {
  introDismissed: boolean;
  dismissIntro: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  introDismissed: false,
  dismissIntro: (): void => set({ introDismissed: true }),
}));
