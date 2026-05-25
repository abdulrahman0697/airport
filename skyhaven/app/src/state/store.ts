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
  ActionError,
  applyUpgrade as applyUpgradeAction,
  buyAircraft as buyAircraftAction,
  closeRoute as closeRouteAction,
  openRoute as openRouteAction,
  repairAircraft as repairAircraftAction,
  setRoutePricing as setRoutePricingAction,
  signFuelContract as signFuelContractAction,
  upgradeFuelCapacity as upgradeFuelCapacityAction,
} from '../engine/actions';
import { tick, type TickContext } from '../engine/tick';
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
  repairAircraft: (aircraftUid: string) => ActionResult;
  signFuelContract: (contractId: string) => ActionResult;
  upgradeFuelCapacity: () => ActionResult;
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

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  setState: (next): void => set({ state: next }),
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
  repairAircraft: (aircraftUid) =>
    runAction(set, get, (s) => repairAircraftAction(s, aircraftUid)),
  signFuelContract: (contractId) =>
    runAction(set, get, (s) => signFuelContractAction(s, contractId)),
  upgradeFuelCapacity: () =>
    runAction(set, get, (s) => upgradeFuelCapacityAction(s)),
}));

export type { GameStore };

/** Selector helpers — keep React renders narrow. */
export const selectCash = (s: GameStore): number => s.state?.cash ?? 0;
export const selectLifetime = (s: GameStore): number => s.state?.lifetimeEarnings ?? 0;
export const selectAirlineName = (s: GameStore): string => s.state?.airlineName ?? '';
export const selectTailColor = (s: GameStore): string => s.state?.tailColor ?? '#5AC8FA';
export const selectTier = (s: GameStore): number => s.state?.tierUnlocked ?? 1;
export const selectFleet = (s: GameStore) => s.state?.fleet ?? [];
export const selectRoutes = (s: GameStore) => s.state?.routes ?? [];
