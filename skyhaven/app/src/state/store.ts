/**
 * Game state store.
 *
 * The store owns the canonical `SaveState`. The engine is invoked
 * imperatively via `applyTick` and the action methods — Zustand is
 * not used as the simulator, it's the *holder*. This keeps the engine
 * pure and Web-Worker-friendly (Phase 9).
 *
 * Actions return the result envelope `{ ok: true } | { ok: false, error }`
 * so the UI never has to wrap calls in try/catch.
 */

import { create } from 'zustand';
import {
  acknowledgeOfflineSummary as acknowledgeOfflineSummaryAction,
  acknowledgeVintageDrop as acknowledgeVintageDropAction,
  ActionError,
  advanceTutorial as advanceTutorialAction,
  applyServerEvents as applyServerEventsAction,
  applyUpgrade as applyUpgradeAction,
  buyAircraft as buyAircraftAction,
  chooseStartingRegion as chooseStartingRegionAction,
  claimCollectible as claimCollectibleAction,
  claimDailyMission as claimDailyMissionAction,
  claimDailyReward as claimDailyRewardAction,
  closeRoute as closeRouteAction,
  completeTutorial as completeTutorialAction,
  createHub as createHubAction,
  creditGift as creditGiftAction,
  dismissHubPick as dismissHubPickAction,
  pickHub as pickHubAction,
  hireManager as hireManagerAction,
  openRoute as openRouteAction,
  repairAircraft as repairAircraftAction,
  resetTutorial as resetTutorialAction,
  setAirlineIdentity as setAirlineIdentityAction,
  setOfflineSummary as setOfflineSummaryAction,
  setRoutePricing as setRoutePricingAction,
  signFuelContract as signFuelContractAction,
  unlockRegion as unlockRegionAction,
  upgradeFuelCapacity as upgradeFuelCapacityAction,
  upgradeHub as upgradeHubAction,
} from '../engine/actions';
import { applyDailyLogin } from '../engine/dailyLogin';
import { tick, type TickContext } from '../engine/tick';
import type { ManagerKind } from '../data/managers';
import type { RoutePricing, SaveState } from '../engine/types';
import type { UpgradeKind } from '../engine/upgrades';

export type ActionResult = { ok: true } | { ok: false; code: string; message: string };

interface GameStore {
  state: SaveState | null;
  setState: (next: SaveState) => void;
  applyTick: (ctx: TickContext) => void;

  buyAircraft: (defId: string) => ActionResult;
  openRoute: (originIata: string, destIata: string, aircraftUid: string, pricing?: RoutePricing) => ActionResult;
  closeRoute: (routeId: string) => ActionResult;
  setRoutePricing: (routeId: string, pricing: RoutePricing) => ActionResult;
  applyUpgrade: (aircraftUid: string, kind: UpgradeKind) => ActionResult;
  repairAircraft: (aircraftUid: string, mode?: 'quick' | 'full' | 'premium') => ActionResult;
  signFuelContract: (contractId: string) => ActionResult;
  upgradeFuelCapacity: () => ActionResult;
  unlockRegion: (regionId: number) => ActionResult;
  createHub: (iata: string) => ActionResult;
  pickHub: (iata: string) => ActionResult;
  dismissHubPick: () => ActionResult;
  chooseStartingRegion: (regionId: number) => ActionResult;
  upgradeHub: (iata: string) => ActionResult;
  hireManager: (iata: string, kind: ManagerKind) => ActionResult;
  claimCollectible: (id: string) => ActionResult;
  acknowledgeVintageDrop: () => ActionResult;

  // Player journey (Phase 9)
  setAirlineIdentity: (name: string, tailColor: string) => ActionResult;
  advanceTutorial: () => ActionResult;
  completeTutorial: () => ActionResult;
  resetTutorial: () => ActionResult;
  acknowledgeOfflineSummary: () => ActionResult;
  claimDailyReward: () => ActionResult;
  claimDailyMission: (missionId: string) => ActionResult;
  /** Credit a claimed friend gift to the local state (Phase 12.3). */
  creditGift: (kind: 'cash' | 'fuel', amount: number) => ActionResult;
  /** Merge server-published events into local activeEvents (Phase 13.1). */
  applyServerEvents: (events: readonly import('../engine/types').ActiveEvent[]) => void;
  setOfflineSummary: (s: { elapsedMs: number; earnings: number } | null) => void;
  /** Apply daily-login streak using the current wall clock. */
  applyDailyLoginNow: () => void;
}

function runAction(
  set: (partial: Partial<GameStore>) => void,
  get: () => GameStore,
  fn: (s: SaveState) => SaveState,
): ActionResult {
  const cur = get().state;
  if (!cur) return { ok: false, code: 'NOT_READY', message: 'Game not initialised' };
  try {
    set({ state: fn(cur) });
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionError) return { ok: false, code: err.code, message: err.message };
    // eslint-disable-next-line no-console
    console.error('[skyhaven] action threw unexpected error', err);
    return { ok: false, code: 'UNEXPECTED', message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Defensive normalisation for any state that lands in the store from
 * persistence. The engine's tick already produces valid shapes; this
 * guards against partially-formed saves loaded from older builds.
 */
function normaliseState(next: SaveState): SaveState {
  const activeEvents = Array.isArray(next.activeEvents) ? next.activeEvents : [];
  const collectibles = Array.isArray(next.collectibles) ? next.collectibles : [];
  if (activeEvents === next.activeEvents && collectibles === next.collectibles) return next;
  return { ...next, activeEvents, collectibles };
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  setState: (next): void => set({ state: normaliseState(next) }),
  applyTick: (ctx): void => {
    const cur = get().state;
    if (!cur) return;
    set({ state: tick(cur, ctx) });
  },
  buyAircraft: (defId) => runAction(set, get, (s) => buyAircraftAction(s, defId)),
  openRoute: (originIata, destIata, aircraftUid, pricing) =>
    runAction(set, get, (s) => openRouteAction(s, originIata, destIata, aircraftUid, pricing)),
  closeRoute: (routeId) => runAction(set, get, (s) => closeRouteAction(s, routeId)),
  setRoutePricing: (routeId, pricing) =>
    runAction(set, get, (s) => setRoutePricingAction(s, routeId, pricing)),
  applyUpgrade: (aircraftUid, kind) =>
    runAction(set, get, (s) => applyUpgradeAction(s, aircraftUid, kind)),
  repairAircraft: (aircraftUid, mode) =>
    runAction(set, get, (s) => repairAircraftAction(s, aircraftUid, mode)),
  signFuelContract: (contractId) =>
    runAction(set, get, (s) => signFuelContractAction(s, contractId)),
  upgradeFuelCapacity: () =>
    runAction(set, get, (s) => upgradeFuelCapacityAction(s)),
  unlockRegion: (regionId) =>
    runAction(set, get, (s) => unlockRegionAction(s, regionId)),
  createHub: (iata) =>
    runAction(set, get, (s) => createHubAction(s, iata)),
  pickHub: (iata) =>
    runAction(set, get, (s) => pickHubAction(s, iata)),
  dismissHubPick: () =>
    runAction(set, get, (s) => dismissHubPickAction(s)),
  chooseStartingRegion: (regionId) =>
    runAction(set, get, (s) => chooseStartingRegionAction(s, regionId)),
  upgradeHub: (iata) =>
    runAction(set, get, (s) => upgradeHubAction(s, iata)),
  hireManager: (iata, kind) =>
    runAction(set, get, (s) => hireManagerAction(s, iata, kind)),
  claimCollectible: (id) =>
    runAction(set, get, (s) => claimCollectibleAction(s, id)),
  acknowledgeVintageDrop: () =>
    runAction(set, get, (s) => acknowledgeVintageDropAction(s)),
  setAirlineIdentity: (name, tailColor) =>
    runAction(set, get, (s) => setAirlineIdentityAction(s, name, tailColor)),
  advanceTutorial: () => runAction(set, get, (s) => advanceTutorialAction(s)),
  completeTutorial: () => runAction(set, get, (s) => completeTutorialAction(s)),
  resetTutorial: () => runAction(set, get, (s) => resetTutorialAction(s)),
  acknowledgeOfflineSummary: () =>
    runAction(set, get, (s) => acknowledgeOfflineSummaryAction(s)),
  claimDailyReward: () => runAction(set, get, (s) => claimDailyRewardAction(s)),
  claimDailyMission: (missionId) => runAction(set, get, (s) => claimDailyMissionAction(s, missionId)),
  creditGift: (kind, amount) => runAction(set, get, (s) => creditGiftAction(s, kind, amount)),
  applyServerEvents: (events): void => {
    const cur = get().state;
    if (!cur) return;
    set({ state: applyServerEventsAction(cur, events, Date.now()) });
  },
  setOfflineSummary: (summary): void => {
    const cur = get().state;
    if (!cur) return;
    set({ state: setOfflineSummaryAction(cur, summary) });
  },
  applyDailyLoginNow: (): void => {
    const cur = get().state;
    if (!cur) return;
    set({ state: applyDailyLogin(cur, Date.now()) });
  },
}));

export type { GameStore };

/** Selector helpers — keep React renders narrow. */
export const selectCash = (s: GameStore): number => s.state?.cash ?? 0;
export const selectLifetime = (s: GameStore): number => s.state?.lifetimeEarnings ?? 0;
export const selectAirlineName = (s: GameStore): string => s.state?.airlineName ?? '';
export const selectTailColor = (s: GameStore): string => s.state?.tailColor ?? '#5AC8FA';
export const selectTier = (s: GameStore): number => s.state?.tierUnlocked ?? 1;
// Frozen empty arrays shared by every selector that needs a fallback.
// Using a fresh `[]` literal in `?? []` makes `useSyncExternalStore`
// see a different snapshot on every read and tight-loops the
// re-render path (React error #185).
const EMPTY_OWNED_AIRCRAFT = Object.freeze([]) as readonly SaveState['fleet'][number][];
const EMPTY_ROUTES = Object.freeze([]) as readonly SaveState['routes'][number][];
const EMPTY_HUBS = Object.freeze([]) as readonly SaveState['hubs'][number][];
const EMPTY_NUMBERS = Object.freeze([]) as readonly number[];
const EMPTY_EVENTS = Object.freeze([]) as readonly SaveState['activeEvents'][number][];
const EMPTY_COLLECTIBLES = Object.freeze([]) as readonly SaveState['collectibles'][number][];
const EMPTY_STRINGS = Object.freeze([]) as readonly string[];

export const selectFleet = (s: GameStore) => s.state?.fleet ?? EMPTY_OWNED_AIRCRAFT;
export const selectRoutes = (s: GameStore) => s.state?.routes ?? EMPTY_ROUTES;
export const selectHubs = (s: GameStore) => s.state?.hubs ?? EMPTY_HUBS;
export const selectUnlockedRegions = (s: GameStore) => s.state?.unlockedRegions ?? EMPTY_NUMBERS;
export const selectActiveEvents = (s: GameStore) => s.state?.activeEvents ?? EMPTY_EVENTS;
export const selectCollectibles = (s: GameStore) => s.state?.collectibles ?? EMPTY_COLLECTIBLES;
export const selectVintage = (s: GameStore) => s.state?.vintage ?? EMPTY_STRINGS;
export const selectAchievements = (s: GameStore) => s.state?.achievements ?? EMPTY_STRINGS;
export const selectDailyMissions = (s: GameStore) => s.state?.dailyMissions ?? null;
export const selectEcoRating = (s: GameStore) => s.state?.ecoRating ?? 0;
export const selectPendingVintageDrop = (s: GameStore) => s.state?.pendingVintageDrop ?? null;
// NB: do NOT return composite objects from selectors —
// useSyncExternalStore compares snapshots by reference and a fresh
// `{ completed, step }` literal each call drives the render loop until
// it trips React #185.
export const selectTutorialCompleted = (s: GameStore) => s.state?.tutorialCompleted ?? true;
export const selectTutorialStep = (s: GameStore) => s.state?.tutorialStep ?? 0;
export const selectGoalChainStep = (s: GameStore) => s.state?.goalChainStep ?? 0;
export const selectPendingOfflineSummary = (s: GameStore) => s.state?.pendingOfflineSummary ?? null;
export const selectPendingDailyReward = (s: GameStore) => s.state?.pendingDailyReward ?? null;
export const selectPendingHubPickRegion = (s: GameStore) => s.state?.pendingHubPickRegion ?? null;
