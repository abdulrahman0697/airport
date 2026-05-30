/**
 * Live-tunable economy knobs (BRD §4.13, §13.3).
 *
 * These are the subset of economy constants that Remote Config can
 * override at runtime. They live here as a plain mutable object so the
 * pure engine can read them at call time without importing the Firebase
 * (impure) layer — the backend `remoteConfig` module fetches RC and
 * calls `applyEngineTuning()` once on startup.
 *
 * Defaults match the previously-hardcoded values exactly, so behaviour
 * is unchanged until Remote Config delivers an override. Every field is
 * a multiplier of identity (1.0) except `hubBonusPerLevel`, which keeps
 * its historical 0.05 default.
 *
 * Determinism note: these are fixed for the duration of a session once
 * applied, so the tick stays reproducible — they're data inputs, not a
 * clock or RNG.
 */

export interface EngineTuning {
  /** Multiplies all per-leg route revenue (`econ_global_yield_mult`). */
  globalYieldMult: number;
  /** Network bonus added per hub level (`hub_bonus_per_level`). */
  hubBonusPerLevel: number;
  /** Multiplies per-leg condition wear (`condition_decay_rate`). */
  conditionDecayMult: number;
  /** Multiplies total fleet fuel demand (`fuel_demand_mult`). */
  fuelDemandMult: number;
  /** Multiplies aircraft repair cost (`repair_cost_mult`). */
  repairCostMult: number;
}

export const ENGINE_TUNING_DEFAULTS: EngineTuning = {
  globalYieldMult: 1,
  hubBonusPerLevel: 0.05,
  conditionDecayMult: 1,
  // Arrivals & Time update: strict-linear timing halved per-real-second
  // fuel burn. Left at 1 (owner decision) — the fuel gate is now ~2×
  // looser, i.e. a contract supports roughly twice the routes it used to.
  fuelDemandMult: 1,
  repairCostMult: 1,
};

export const TUNING: EngineTuning = { ...ENGINE_TUNING_DEFAULTS };

/**
 * Override tuning from a resolved Remote Config snapshot. Only finite,
 * non-negative numbers are accepted; anything else keeps the current
 * value so a malformed RC payload can never zero out the economy.
 */
export function applyEngineTuning(partial: Partial<EngineTuning>): void {
  for (const key of Object.keys(ENGINE_TUNING_DEFAULTS) as (keyof EngineTuning)[]) {
    const v = partial[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      TUNING[key] = v;
    }
  }
}

/** Reset to defaults — used by tests to isolate from any applied RC. */
export function resetEngineTuning(): void {
  Object.assign(TUNING, ENGINE_TUNING_DEFAULTS);
}
