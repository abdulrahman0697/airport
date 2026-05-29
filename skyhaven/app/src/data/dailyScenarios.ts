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
  | 'repair_aircraft'
  | 'upgrade_aircraft'
  | 'buy_aircraft'
  | 'fleet_diversity';

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
    templates: ['open_routes', 'buy_aircraft', 'upgrade_aircraft'],
    briefing: 'Demand spikes early. Open new routes, add metal to the ramp, and keep the fleet sharp.',
  },
  {
    id: 'fuel-shock',
    title: 'Fuel Market Shock',
    tagline: 'Spot prices are up 22% today.',
    badge: 'Crisis Controlled',
    accent: 'warn',
    templates: ['upgrade_aircraft', 'repair_aircraft', 'open_routes'],
    briefing: 'Survive a fuel-price spike: tune for efficiency, fix the worn aircraft, and keep the network earning.',
  },
  {
    id: 'cargo-surge',
    title: 'Cargo Surge',
    tagline: 'Pharma + express parcels need moving.',
    badge: 'Cargo Cleared',
    accent: 'gold',
    templates: ['buy_aircraft', 'open_routes', 'fleet_diversity'],
    briefing: 'Add lift fast, open new lanes, and broaden the fleet to cover every parcel run.',
  },
  {
    id: 'premium-day',
    title: 'Premium Day',
    tagline: 'High-yield passengers, your day.',
    badge: 'VIP Delivered',
    accent: 'violet',
    templates: ['upgrade_aircraft', 'fleet_diversity', 'buy_aircraft'],
    briefing: 'Capture business travellers: tune cabins for yield, diversify the fleet, and scale up capacity.',
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
    templates: ['open_routes', 'fleet_diversity', 'buy_aircraft'],
    briefing: 'Open leisure lanes, broaden the fleet for every market, and put more aircraft to work.',
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
