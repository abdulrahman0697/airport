/**
 * Remote Config client (BRD §4.13, §13.3).
 *
 * Fetches the live economy/feature parameters defined in
 * `skyhaven/remote-config.json` and applies the engine-tunable subset
 * via `applyEngineTuning()`. Everything else (feature flags, ad pacing,
 * offline window, version gate, event schedule) is parsed into a
 * `resolvedConfig` snapshot that the UI/backend can read.
 *
 * Best-effort and non-blocking: a failed fetch (offline, no Blaze, RC
 * not configured) leaves the in-code defaults in place, so the game is
 * fully playable with zero backend. The fetch is throttled in
 * production and effectively live in dev.
 *
 * The `defaultConfig` below MUST mirror the in-code defaults — these are
 * the fallback values used until the console delivers an override, and
 * they're chosen to preserve current shipped behaviour (not necessarily
 * the values in remote-config.json, which is the server-side template an
 * admin edits).
 */
import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
  type RemoteConfig,
} from 'firebase/remote-config';
import { applyEngineTuning } from '../engine/tuning';
import { getFirebaseApp } from './firebase';

export interface ResolvedConfig {
  // Engine economy (also pushed into engine/tuning)
  globalYieldMult: number;
  hubBonusPerLevel: number;
  conditionDecayMult: number;
  fuelDemandMult: number;
  repairCostMult: number;
  // Reserved — parsed and exposed, consumers wired incrementally
  fuelContractCostMult: number;
  fuelCapacityCostMult: number;
  offlineRatePct: number;
  offlineCapHours: number;
  interstitialMinIntervalSec: number;
  rewardedFuelAmount: number;
  minSupportedAppVersion: string;
  // Feature flags (default true client-side to match shipped behaviour)
  featureCargo: boolean;
  featureLeaderboards: boolean;
  featureSocial: boolean;
  featureEvents: boolean;
  /** Raw JSON string of scheduled events (see remote-config.json). */
  eventSchedule: string;
}

const DEFAULTS: ResolvedConfig = {
  globalYieldMult: 1,
  hubBonusPerLevel: 0.05,
  conditionDecayMult: 1,
  fuelDemandMult: 1,
  repairCostMult: 1,
  fuelContractCostMult: 1,
  fuelCapacityCostMult: 1,
  offlineRatePct: 0.5,
  offlineCapHours: 1,
  interstitialMinIntervalSec: 180,
  rewardedFuelAmount: 500,
  minSupportedAppVersion: '0.1.0',
  featureCargo: true,
  featureLeaderboards: true,
  featureSocial: true,
  featureEvents: true,
  eventSchedule: '[]',
};

let resolved: ResolvedConfig = { ...DEFAULTS };
export function getResolvedConfig(): ResolvedConfig {
  return resolved;
}

let rc: RemoteConfig | null = null;
function getRc(): RemoteConfig | null {
  if (rc) return rc;
  try {
    rc = getRemoteConfig(getFirebaseApp());
    // Dev: fetch on every load so console edits show up immediately.
    // Prod: throttle to once an hour to respect quota.
    const dev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false;
    rc.settings.minimumFetchIntervalMillis = dev ? 0 : 3_600_000;
    rc.settings.fetchTimeoutMillis = 15_000;
    // RC requires string defaults; mirror our DEFAULTS.
    rc.defaultConfig = {
      econ_global_yield_mult: String(DEFAULTS.globalYieldMult),
      hub_bonus_per_level: String(DEFAULTS.hubBonusPerLevel),
      condition_decay_rate: String(DEFAULTS.conditionDecayMult),
      fuel_demand_mult: String(DEFAULTS.fuelDemandMult),
      repair_cost_mult: String(DEFAULTS.repairCostMult),
      fuel_contract_cost_mult: String(DEFAULTS.fuelContractCostMult),
      fuel_capacity_cost_mult: String(DEFAULTS.fuelCapacityCostMult),
      offline_rate_pct: String(DEFAULTS.offlineRatePct),
      offline_cap_hours: String(DEFAULTS.offlineCapHours),
      interstitial_min_interval_seconds: String(DEFAULTS.interstitialMinIntervalSec),
      rewarded_fuel_amount: String(DEFAULTS.rewardedFuelAmount),
      min_supported_app_version: DEFAULTS.minSupportedAppVersion,
      feature_flag_cargo: String(DEFAULTS.featureCargo),
      feature_flag_leaderboards: String(DEFAULTS.featureLeaderboards),
      feature_flag_social: String(DEFAULTS.featureSocial),
      feature_flag_events: String(DEFAULTS.featureEvents),
      event_schedule: DEFAULTS.eventSchedule,
    };
    return rc;
  } catch {
    return null;
  }
}

function num(c: RemoteConfig, key: string, fallback: number): number {
  const n = getValue(c, key).asNumber();
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Fetch + activate Remote Config and apply it. Idempotent and
 * best-effort — never throws to the caller.
 */
export async function initRemoteConfig(): Promise<ResolvedConfig> {
  const c = getRc();
  if (!c) return resolved;
  try {
    await fetchAndActivate(c);
    resolved = {
      globalYieldMult: num(c, 'econ_global_yield_mult', DEFAULTS.globalYieldMult),
      hubBonusPerLevel: num(c, 'hub_bonus_per_level', DEFAULTS.hubBonusPerLevel),
      conditionDecayMult: num(c, 'condition_decay_rate', DEFAULTS.conditionDecayMult),
      fuelDemandMult: num(c, 'fuel_demand_mult', DEFAULTS.fuelDemandMult),
      repairCostMult: num(c, 'repair_cost_mult', DEFAULTS.repairCostMult),
      fuelContractCostMult: num(c, 'fuel_contract_cost_mult', DEFAULTS.fuelContractCostMult),
      fuelCapacityCostMult: num(c, 'fuel_capacity_cost_mult', DEFAULTS.fuelCapacityCostMult),
      offlineRatePct: num(c, 'offline_rate_pct', DEFAULTS.offlineRatePct),
      offlineCapHours: num(c, 'offline_cap_hours', DEFAULTS.offlineCapHours),
      interstitialMinIntervalSec: num(c, 'interstitial_min_interval_seconds', DEFAULTS.interstitialMinIntervalSec),
      rewardedFuelAmount: num(c, 'rewarded_fuel_amount', DEFAULTS.rewardedFuelAmount),
      minSupportedAppVersion: getValue(c, 'min_supported_app_version').asString() || DEFAULTS.minSupportedAppVersion,
      featureCargo: getValue(c, 'feature_flag_cargo').asBoolean(),
      featureLeaderboards: getValue(c, 'feature_flag_leaderboards').asBoolean(),
      featureSocial: getValue(c, 'feature_flag_social').asBoolean(),
      featureEvents: getValue(c, 'feature_flag_events').asBoolean(),
      eventSchedule: getValue(c, 'event_schedule').asString() || DEFAULTS.eventSchedule,
    };
    // Push the engine-consumed subset into the pure tuning layer.
    applyEngineTuning({
      globalYieldMult: resolved.globalYieldMult,
      hubBonusPerLevel: resolved.hubBonusPerLevel,
      conditionDecayMult: resolved.conditionDecayMult,
      fuelDemandMult: resolved.fuelDemandMult,
      repairCostMult: resolved.repairCostMult,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] remote config fetch failed; using defaults', err);
  }
  return resolved;
}
