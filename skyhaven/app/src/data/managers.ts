/**
 * Per-hub managers (BRD §4.11).
 *
 * Each manager is a one-time hire per hub, hub-scoped effects, costs
 * `baseCost × hub.level`. An unstaffed hub still functions — managers
 * are pure optimisation on top.
 */

export type ManagerKind =
  | 'hubDirector'
  | 'maintenanceChief'
  | 'logisticsDirector'
  | 'fleetEngineer'
  | 'marketingLead'
  | 'crisisManager';

export interface ManagerDef {
  readonly kind: ManagerKind;
  readonly name: string;
  readonly tagline: string;
  readonly bio: string;
  readonly baseCost: number;
}

export const MANAGER_DEFS: readonly ManagerDef[] = [
  {
    kind: 'hubDirector',
    name: 'Hub Director',
    tagline: 'Auto-optimises pricing on hub routes',
    bio: 'Reads the spreadsheets so you don\'t have to. Picks economy, balanced, or premium based on route demand.',
    baseCost: 30_000,
  },
  {
    kind: 'maintenanceChief',
    name: 'Maintenance Chief',
    tagline: 'Auto-repairs the hub\'s fleet',
    bio: 'Keeps an eye on every aircraft assigned to the hub and quietly schedules a top-up whenever cash and condition fall out of sync.',
    baseCost: 20_000,
  },
  {
    kind: 'logisticsDirector',
    name: 'Logistics Director',
    tagline: 'Cuts hub fuel use by 25%',
    bio: 'Squeezes 25% more flying out of every barrel and finesses the contracts so the hub never runs dry.',
    baseCost: 40_000,
  },
  {
    kind: 'fleetEngineer',
    name: 'Fleet Engineer',
    tagline: 'Auto-applies affordable upgrades',
    bio: 'Walks the hangar every shift and quietly buys the next-cheapest upgrade your wallet can take.',
    baseCost: 25_000,
  },
  {
    kind: 'marketingLead',
    name: 'Marketing Lead',
    tagline: '+5% load factor for hub routes',
    bio: 'Loyalty card, seat sale, weather permitting — fills the cabin a fraction higher on every leg.',
    baseCost: 30_000,
  },
  {
    kind: 'crisisManager',
    name: 'Crisis Manager',
    tagline: 'Halves negative-event impact',
    bio: 'When the headlines turn ugly, gets on the phone and the worst of it never reaches the timetable.',
    baseCost: 25_000,
  },
];

const BY_KIND = new Map(MANAGER_DEFS.map((m) => [m.kind, m]));

export function getManagerDef(kind: ManagerKind): ManagerDef | undefined {
  return BY_KIND.get(kind);
}

export function managerCost(kind: ManagerKind, hubLevel: number): number {
  const def = BY_KIND.get(kind);
  if (!def) return Number.POSITIVE_INFINITY;
  return def.baseCost * Math.max(1, hubLevel);
}
