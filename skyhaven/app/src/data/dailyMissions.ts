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
  | 'repair_aircraft'
  | 'upgrade_aircraft'
  | 'buy_aircraft'
  | 'fleet_diversity';

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

// Owner-tuned daily pool (5 templates, 3 roll per day). Every mission
// now shares a 5 / 10 / 15 target ladder so the day's goals read at a
// consistent scale; rewards are flat cash, scaled per template by the
// coefficient below.
//
// Progress note: `buy_aircraft`, `fleet_diversity` and `upgrade_aircraft`
// measure a delta against the day-start snapshot. The reconstructed
// `start` state passed to `progress()` can't represent fleet size /
// type-set / upgrade totals, so the engine (engine/dailyMissions.ts)
// special-cases those three from `DailyMissionSnapshot`. The functions
// here describe the intended semantics and act as the fallback.
export const DAILY_MISSION_TEMPLATES: readonly DailyMissionTemplate[] = [
  {
    id: 'open_routes',
    label: 'Open the Skies',
    description: 'Launch %target% new routes today — expand the network.',
    targets: [5, 10, 15],
    reward: (t) => 1_500 * t,
    progress: (now, start) => Math.max(0, now.routes.length - start.routes.length),
  },
  {
    id: 'repair_aircraft',
    label: 'Hangar Maintenance',
    description: 'Restore %target% aircraft to top condition today.',
    targets: [5, 10, 15],
    reward: (t) => 1_000 * t,
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
    id: 'upgrade_aircraft',
    label: 'Fleet Tune-Up',
    description: 'Spec up your aircraft with %target% upgrade levels today.',
    targets: [5, 10, 15],
    reward: (t) => 1_500 * t,
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
  {
    id: 'buy_aircraft',
    label: 'Hangar Expansion',
    description: 'Add %target% new aircraft to your fleet today.',
    targets: [5, 10, 15],
    reward: (t) => 3_000 * t,
    // Engine special-cases this against the day-start fleet count.
    progress: (now, start) => Math.max(0, now.fleet.length - start.fleet.length),
  },
  {
    id: 'fleet_diversity',
    label: 'Mix It Up',
    description: 'Add %target% new aircraft type(s) to your fleet today.',
    targets: [5, 10, 15],
    reward: (t) => 3_000 * t,
    // Engine special-cases this against the day-start unique-type count.
    progress: (now, start) => {
      const types = (s: SaveState): number => new Set(s.fleet.map((a) => a.defId)).size;
      return Math.max(0, types(now) - types(start));
    },
  },
];

const BY_ID = new Map(DAILY_MISSION_TEMPLATES.map((t) => [t.id, t]));
export function getMissionTemplate(id: MissionTemplateId): DailyMissionTemplate | undefined {
  return BY_ID.get(id);
}

export const DAILY_MISSION_COUNT = 3;
