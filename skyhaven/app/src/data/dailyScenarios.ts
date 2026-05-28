/**
 * Daily Airport Scenarios (Design Review v3 — point 18).
 *
 * Each day rolls a *themed scenario* — three related missions wrapped
 * in a story (Morning Rush, Fuel Market Shock, Cargo Surge, Premium
 * Day, Maintenance Window, Tourism Boom). The scenario picks one
 * mission per category and gives the day a completion badge: "Rush
 * Handled", "Crisis Controlled", "Cargo Cleared", "VIP Delivered",
 * "Hangar Restored", "Boom Captured".
 *
 * The engine still rolls three missions (data/dailyMissions.ts); this
 * file just provides the *scenario context* the UI displays around
 * them. The picker is deterministic on (date, save.seed) so the same
 * device shows the same scenario all day.
 */

export type MissionTemplateId =
  | 'open_routes'
  | 'earn_cash'
  | 'repair_aircraft'
  | 'claim_collectibles'
  | 'hire_managers'
  | 'upgrade_aircraft';

export interface DailyScenario {
  readonly id: string;
  readonly title: string;
  readonly tagline: string;
  readonly badge: string;
  /** Backdrop accent — applied to the scenario card's left bar. */
  readonly accent: 'cyan' | 'gold' | 'success' | 'warn' | 'danger' | 'violet';
  /** Mission templates this scenario emphasises (rolled in order). */
  readonly templates: readonly MissionTemplateId[];
  /** Optional short briefing for the scenario card. */
  readonly briefing: string;
}

export const DAILY_SCENARIOS: readonly DailyScenario[] = [
  {
    id: 'morning-rush',
    title: 'Morning Rush at the Hub',
    tagline: 'Commuters everywhere. Move them fast.',
    badge: 'Rush Handled',
    accent: 'cyan',
    templates: ['open_routes', 'earn_cash', 'upgrade_aircraft'],
    briefing: 'Demand spikes early. Open new routes, push revenue, keep the fleet sharp.',
  },
  {
    id: 'fuel-shock',
    title: 'Fuel Market Shock',
    tagline: 'Spot prices are up 22% today.',
    badge: 'Crisis Controlled',
    accent: 'warn',
    templates: ['earn_cash', 'upgrade_aircraft', 'repair_aircraft'],
    briefing: 'Survive a fuel-price spike: keep margins positive, deploy fuel-efficient aircraft, fix the worn ones.',
  },
  {
    id: 'cargo-surge',
    title: 'Cargo Surge',
    tagline: 'Pharma + express parcels need moving.',
    badge: 'Cargo Cleared',
    accent: 'gold',
    templates: ['claim_collectibles', 'open_routes', 'earn_cash'],
    briefing: 'Sweep loose crates off the map, open lanes, and pad the books with cargo revenue.',
  },
  {
    id: 'premium-day',
    title: 'Premium Day',
    tagline: 'High-yield passengers, your day.',
    badge: 'VIP Delivered',
    accent: 'violet',
    templates: ['earn_cash', 'hire_managers', 'upgrade_aircraft'],
    briefing: 'Capture business travellers: top revenue, hire the right managers, tune cabins for yield.',
  },
  {
    id: 'maintenance-window',
    title: 'Maintenance Window',
    tagline: 'Schedule the hangar; tomorrow runs cleaner.',
    badge: 'Hangar Restored',
    accent: 'success',
    templates: ['repair_aircraft', 'upgrade_aircraft', 'open_routes'],
    briefing: 'Restore the fleet, upgrade where it pays back fastest, then ride the recovery.',
  },
  {
    id: 'tourism-boom',
    title: 'Tourism Boom',
    tagline: 'Holiday traffic is hot — capture it.',
    badge: 'Boom Captured',
    accent: 'cyan',
    templates: ['open_routes', 'claim_collectibles', 'hire_managers'],
    briefing: 'Open leisure lanes, catch event collectibles, and put more hands on deck.',
  },
];

/** Deterministic pick: (date YYYY-MM-DD, seed) → scenario. */
export function scenarioForDate(dateKey: string, seed: number): DailyScenario {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % DAILY_SCENARIOS.length;
  return DAILY_SCENARIOS[idx]!;
}
