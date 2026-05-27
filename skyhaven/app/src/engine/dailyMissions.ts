/**
 * Daily mission engine (BRD §14).
 *
 * Two responsibilities:
 *  1. Roll a fresh mission set whenever the local date changes (or on
 *     first-ever play). The roll is deterministic from `(date,
 *     save.seed)` so the same player gets the same set across
 *     devices, and a snapshot of the relevant state fields is taken
 *     so deltas can be measured later.
 *  2. Update each mission's `progress` field every tick by diffing
 *     the live state against that snapshot.
 *
 * Claim is a discrete player action (see `actions.claimDailyMission`)
 * — auto-claim would be friendlier but it'd quietly hide the reward
 * trigger, and BRD §14 wants the satisfying tap.
 */
import {
  DAILY_MISSION_COUNT,
  DAILY_MISSION_TEMPLATES,
  type DailyMissionTemplate,
} from '../data/dailyMissions';
import type { DailyMission, DailyMissionSnapshot, SaveState } from './types';

/** Local-date key (YYYY-MM-DD) for `nowMs`. Uses the device timezone so
 *  the player perceives "today" the way their calendar does. */
export function localDateKey(nowMs: number): string {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function snapshot(state: SaveState, date: string): DailyMissionSnapshot {
  const conditionByUid: Record<string, number> = {};
  let upgradeLevels = 0;
  for (const a of state.fleet) {
    conditionByUid[a.uid] = a.condition;
    const u = a.upgrades;
    upgradeLevels += u.engine + u.cabin + u.fuelEff + u.marketing;
  }
  let managersCount = 0;
  for (const h of state.hubs) {
    for (const v of Object.values(h.managers)) if (v) managersCount++;
  }
  return {
    date,
    routesCount: state.routes.length,
    lifetimeEarnings: state.lifetimeEarnings,
    managersCount,
    upgradeLevels,
    collectiblesCount: state.collectibles.length,
    conditionByUid,
  };
}

/** Tiny deterministic PRNG. Same shape as `engine/events.ts.nextSeed`. */
function nextSeed(seed: number): number {
  let s = seed | 0;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return s | 0;
}
function dateSeed(date: string, base: number): number {
  let s = base | 0;
  for (let i = 0; i < date.length; i++) {
    s ^= date.charCodeAt(i);
    s = nextSeed(s);
  }
  return s;
}

/** Pick K distinct templates from the pool using `seed`. */
function pickTemplates(seed: number, k: number): DailyMissionTemplate[] {
  const pool = DAILY_MISSION_TEMPLATES.slice();
  const out: DailyMissionTemplate[] = [];
  let s = seed | 0;
  while (out.length < k && pool.length > 0) {
    s = nextSeed(s);
    const idx = Math.abs(s) % pool.length;
    out.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return out;
}

function pickTarget(template: DailyMissionTemplate, seed: number): number {
  const s = nextSeed(seed);
  return template.targets[Math.abs(s) % template.targets.length]!;
}

/**
 * If the rolled set is stale (different date) or missing, generate a
 * fresh one and snapshot the baseline. No-op when today's set is
 * already present. Called from the tick.
 */
export function rollIfNeeded(state: SaveState, nowMs: number): SaveState {
  const today = localDateKey(nowMs);
  if (state.dailyMissions && state.dailyMissions.date === today) {
    return state;
  }
  const baseSeed = dateSeed(today, state.seed);
  const templates = pickTemplates(baseSeed, DAILY_MISSION_COUNT);
  const missions: DailyMission[] = templates.map((t, i) => {
    const target = pickTarget(t, baseSeed + i);
    return {
      id: `${today}:${t.id}`,
      templateId: t.id,
      target,
      reward: t.reward(target),
      progress: 0,
      claimed: false,
    };
  });
  return {
    ...state,
    dailyMissions: { date: today, missions },
    dailyMissionSnapshot: snapshot(state, today),
  };
}

/**
 * Recompute every mission's `progress` field. Idempotent and cheap —
 * walks K=3 templates and their predicates. Returns the same state
 * reference if nothing changed.
 */
export function recomputeProgress(state: SaveState): SaveState {
  if (!state.dailyMissions || !state.dailyMissionSnapshot) return state;
  const snap = state.dailyMissionSnapshot;
  const start: SaveState = {
    ...state,
    routes: new Array(snap.routesCount),
    lifetimeEarnings: snap.lifetimeEarnings,
    fleet: state.fleet.map((a) => ({
      ...a,
      condition: snap.conditionByUid[a.uid] ?? a.condition,
      upgrades: { engine: 0, cabin: 0, fuelEff: 0, marketing: 0 },
    })),
    collectibles: new Array(snap.collectiblesCount).fill(null) as never,
    hubs: state.hubs,
  };
  // Manually account for snapshot counters that don't have a clean
  // SaveState equivalent (managers, upgrade levels).
  let mutated = false;
  const nextMissions = state.dailyMissions.missions.map((m) => {
    const tmpl = DAILY_MISSION_TEMPLATES.find((t) => t.id === m.templateId);
    if (!tmpl) return m;
    let progress: number;
    if (m.templateId === 'hire_managers') {
      let managersNow = 0;
      for (const h of state.hubs) for (const v of Object.values(h.managers)) if (v) managersNow++;
      progress = Math.max(0, managersNow - snap.managersCount);
    } else if (m.templateId === 'upgrade_aircraft') {
      let levels = 0;
      for (const a of state.fleet) {
        const u = a.upgrades;
        levels += u.engine + u.cabin + u.fuelEff + u.marketing;
      }
      progress = Math.max(0, levels - snap.upgradeLevels);
    } else {
      progress = tmpl.progress(state, start);
    }
    const capped = Math.min(m.target, Math.max(0, Math.floor(progress)));
    if (capped === m.progress) return m;
    mutated = true;
    return { ...m, progress: capped };
  });
  if (!mutated) return state;
  return { ...state, dailyMissions: { ...state.dailyMissions, missions: nextMissions } };
}
