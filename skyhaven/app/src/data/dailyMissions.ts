/**
 * Daily mission templates (BRD §14).
 *
 * Each mission references a template + numeric target. The pool is
 * intentionally small so a player who plays daily sees variety without
 * the same one twice in a week. Three missions roll per day, picked
 * deterministically from `(date, save.seed)` so the choice is stable
 * across devices.
 *
 * Engine evaluates `progress(stateNow, stateAtDayStart)` to decide
 * whether the player has met the target; UI renders the bar.
 */
import type { SaveState } from '../engine/types';

export type MissionTemplateId =
  | 'open_routes'
  | 'earn_cash'
  | 'repair_aircraft'
  | 'claim_collectibles'
  | 'hire_managers'
  | 'upgrade_aircraft';

export interface DailyMissionTemplate {
  readonly id: MissionTemplateId;
  readonly label: string;
  /** Human-readable description; %target% interpolated by the UI. */
  readonly description: string;
  /** Tiered targets — the rolled mission picks one. */
  readonly targets: readonly number[];
  /** Reward as a function of the target picked. */
  readonly reward: (target: number) => number;
  /** Progress today, given current state and the snapshot from day start. */
  readonly progress: (now: SaveState, start: SaveState) => number;
}

export const DAILY_MISSION_TEMPLATES: readonly DailyMissionTemplate[] = [
  {
    id: 'open_routes',
    label: 'Network Builder',
    description: 'Open %target% routes today.',
    targets: [1, 2, 3],
    reward: (t) => 15_000 * t,
    progress: (now, start) => Math.max(0, now.routes.length - start.routes.length),
  },
  {
    id: 'earn_cash',
    label: 'Cash Cow',
    description: 'Earn $%target% today.',
    targets: [100_000, 500_000, 2_000_000],
    reward: (t) => Math.round(t * 0.05),
    progress: (now, start) => Math.max(0, now.lifetimeEarnings - start.lifetimeEarnings),
  },
  {
    id: 'repair_aircraft',
    label: 'Wrench Day',
    description: 'Repair %target% aircraft today.',
    targets: [1, 2, 3],
    reward: (t) => 8_000 * t,
    progress: (now, start) => {
      // Approximate: count aircraft whose condition is materially
      // higher than what we had at day start (i.e., they were repaired).
      const byUid = new Map(start.fleet.map((a) => [a.uid, a.condition]));
      let n = 0;
      for (const a of now.fleet) {
        const before = byUid.get(a.uid);
        if (before !== undefined && a.condition - before >= 20) n++;
      }
      return n;
    },
  },
  {
    id: 'claim_collectibles',
    label: 'Tap Tap',
    description: 'Tap %target% roaming collectibles today.',
    targets: [1, 2, 3],
    reward: (t) => 5_000 * t,
    progress: (now, start) => {
      // Collectibles ids that disappeared since day start, minus any
      // that simply expired by `now`. Cheaper proxy: count fewer
      // collectibles + extra cash earned. We just compare set lengths
      // — false positives on simultaneous spawn/expire are
      // acceptable for a daily mission.
      return Math.max(0, start.collectibles.length - now.collectibles.length);
    },
  },
  {
    id: 'hire_managers',
    label: 'Build the Team',
    description: 'Hire %target% managers today.',
    targets: [1, 2],
    reward: (t) => 20_000 * t,
    progress: (now, start) => {
      const count = (s: SaveState): number => {
        let n = 0;
        for (const h of s.hubs) for (const v of Object.values(h.managers)) if (v) n++;
        return n;
      };
      return Math.max(0, count(now) - count(start));
    },
  },
  {
    id: 'upgrade_aircraft',
    label: 'Tune Up',
    description: 'Apply %target% aircraft upgrade levels today.',
    targets: [1, 3, 5],
    reward: (t) => 12_000 * t,
    progress: (now, start) => {
      const tot = (s: SaveState): number => {
        let n = 0;
        for (const a of s.fleet) {
          const u = a.upgrades;
          n += u.engine + u.cabin + u.fuelEff + u.marketing;
        }
        return n;
      };
      return Math.max(0, tot(now) - tot(start));
    },
  },
];

const BY_ID = new Map(DAILY_MISSION_TEMPLATES.map((t) => [t.id, t]));
export function getMissionTemplate(id: MissionTemplateId): DailyMissionTemplate | undefined {
  return BY_ID.get(id);
}

export const DAILY_MISSION_COUNT = 3;
