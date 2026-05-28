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
  setLauncherCollapsed: (v: boolean) => void;
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
  /**
   * Aircraft delivery ritual (Design Review v3 — point 12). When an
   * aircraft is bought, set this to the def id; the
   * AircraftDeliveryRitual component listens and plays the three-beat
   * Contract → Hangar → Assign / Park ceremony.
   */
  pendingDelivery: { defId: string; uid: string | null } | null;
  setPendingDelivery: (v: UiStore['pendingDelivery']) => void;
  /**
   * Empire Journey screen visibility (Design Review v3 — point 24).
   * Surfaced from the TierRing tap and the Office panel.
   */
  empireJourneyOpen: boolean;
  setEmpireJourneyOpen: (v: boolean) => void;
  /**
   * Active tutorial spotlight target (Design Review v4 — point 9).
   * When set, the BottomTabs row dims non-matching buttons so the
   * player's tap path is visually guided instead of just described.
   * Stored as the data-tutorial value (e.g. "fleet-tab").
   */
  tutorialTarget: string | null;
  setTutorialTarget: (v: string | null) => void;
  /**
   * In-game push opt-in card (Design Review v4 — point 1). When true,
   * the StayInTouchCard renders. Triggered after the first offline
   * income event — the player has now experienced offline earning,
   * so the value of notifications is concrete.
   */
  stayInTouchCard: boolean;
  setStayInTouchCard: (v: boolean) => void;
  /**
   * Tab to open inside FleetPanel when it's launched. Set from home
   * tiles ("Buy a new aircraft" → 'buy'; "Manage your hangar" → 'owned')
   * and cleared by FleetPanel after it reads it once.
   */
  fleetTabIntent: 'owned' | 'buy' | 'vintage' | null;
  setFleetTabIntent: (v: UiStore['fleetTabIntent']) => void;
  /**
   * Tab to open inside RoutesPanel when it's launched. Set from the
   * home "Upgrade your airport" tile ('hubs') and cleared by RoutesPanel.
   */
  routesTabIntent: 'routes' | 'hubs' | 'regions' | null;
  setRoutesTabIntent: (v: UiStore['routesTabIntent']) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  introDismissed: false,
  dismissIntro: (): void => set({ introDismissed: true }),
  launcherCollapsed: true,
  toggleLauncher: (): void => set((s) => ({ launcherCollapsed: !s.launcherCollapsed })),
  setLauncherCollapsed: (v): void => set({ launcherCollapsed: v }),
  cinematicSeen: false,
  markCinematicSeen: (): void => set({ cinematicSeen: true }),
  mapMode: false,
  setMapMode: (v): void => set({ mapMode: v }),
  airportZoneFocus: null,
  setAirportZoneFocus: (zone): void => set({ airportZoneFocus: zone }),
  opsDrillDown: null,
  setOpsDrillDown: (v): void => set({ opsDrillDown: v }),
  pendingDelivery: null,
  setPendingDelivery: (v): void => set({ pendingDelivery: v }),
  empireJourneyOpen: false,
  setEmpireJourneyOpen: (v): void => set({ empireJourneyOpen: v }),
  tutorialTarget: null,
  setTutorialTarget: (v): void => set({ tutorialTarget: v }),
  stayInTouchCard: false,
  setStayInTouchCard: (v): void => set({ stayInTouchCard: v }),
  fleetTabIntent: null,
  setFleetTabIntent: (v): void => set({ fleetTabIntent: v }),
  routesTabIntent: null,
  setRoutesTabIntent: (v): void => set({ routesTabIntent: v }),
}));
