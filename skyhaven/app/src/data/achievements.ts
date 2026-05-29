/**
 * Achievement catalogue (BRD §14 / §19 row 14 acceptance).
 *
 * ~60 entries across 6 categories, each with a pure predicate that
 * evaluates against the current SaveState. The engine walks them
 * every tick and unlocks anything whose predicate transitions from
 * false to true; the reward is credited to cash + lifetime earnings.
 *
 * Adding an achievement: append to the appropriate `*_DEFS` array
 * below. The id should stay stable forever (it's persisted in
 * SaveState.achievements). Localization-ready: the `name` and
 * `description` strings are the only user-facing copy and live here.
 */
import type { SaveState } from '../engine/types';

export type AchievementCategory =
  | 'network'
  | 'fleet'
  | 'economy'
  | 'operations'
  | 'mastery'
  | 'milestone';

export interface AchievementDef {
  readonly id: string;
  readonly category: AchievementCategory;
  readonly name: string;
  readonly description: string;
  readonly reward: number;
  readonly predicate: (s: SaveState) => boolean;
}

/** Average aircraft condition across the fleet, 0..100. */
function avgCondition(s: SaveState): number {
  if (s.fleet.length === 0) return 100;
  let total = 0;
  for (const a of s.fleet) total += a.condition;
  return total / s.fleet.length;
}

function uniqueTypes(s: SaveState): number {
  return new Set(s.fleet.map((a) => a.defId)).size;
}

// Pacing philosophy (player feedback): finishing the tutorial should
// award **one** achievement and nothing else. After that, achievements
// fire only at meaningful, hard-earned milestones — never as a
// reaction to a guided action. So every "first X" predicate (own
// one plane, sign one contract, hire one manager) has been removed;
// the first rung in each ladder now requires real growth past where
// the tutorial leaves the player (1 hub, 1 plane, 1 route, 1-2 fuel
// contracts, ~$80K cash, tier 1).
// Reward scaling pass (player feedback "missions and achievements
// give too much money at the beginning"). After the 4× revenue cut,
// the old early-game rewards effectively read as 4× larger relative
// to per-tick income — finishing one achievement could front-load
// hours of revenue. Sub-$1M tiers have been roughly halved; mid
// tiers cut by ~1/3; multi-million prestige rewards left alone.
//
// Second rescale (owner-tuned table): early/route + operations rewards
// pulled down further so they read as small accelerants rather than
// jackpots; the prestige cash/lifetime ladders (Industry Heavyweight
// onward) keep their seven-to-nine-figure payouts.
const NETWORK_DEFS: AchievementDef[] = [
  { id: 'net.route.5',  category: 'network', name: 'Regional Backbone',   description: 'Run 5 simultaneous routes.',   reward:     7_000, predicate: (s) => s.routes.length >= 5 },
  { id: 'net.route.10', category: 'network', name: 'Network Architect',   description: 'Operate 10 active routes.',     reward:    10_000, predicate: (s) => s.routes.length >= 10 },
  { id: 'net.route.20', category: 'network', name: 'Sky Highway',         description: 'Operate 20 active routes.',     reward:    20_000, predicate: (s) => s.routes.length >= 20 },
  { id: 'net.route.40', category: 'network', name: 'Sky Alliance Founder', description: 'Operate 40 active routes.',    reward:    50_000, predicate: (s) => s.routes.length >= 40 },
  { id: 'net.hub.3',    category: 'network', name: 'Hub Builder',          description: 'Operate 3 hubs.',               reward:    30_000, predicate: (s) => s.hubs.length >= 3 },
  { id: 'net.hub.5',    category: 'network', name: 'Continental Carrier',  description: 'Operate 5 hubs.',               reward:    50_000, predicate: (s) => s.hubs.length >= 5 },
  { id: 'net.region.3', category: 'network', name: 'Multi-Region Ops',     description: 'Unlock 3 regions.',             reward:    50_000, predicate: (s) => s.unlockedRegions.length >= 3 },
  { id: 'net.region.6', category: 'network', name: 'Hemisphere Player',    description: 'Unlock 6 regions.',             reward:   150_000, predicate: (s) => s.unlockedRegions.length >= 6 },
  { id: 'net.region.9', category: 'network', name: 'Pole-to-Pole Network', description: 'Unlock all 9 regions.',         reward:   300_000, predicate: (s) => s.unlockedRegions.length >= 9 },
];

const FLEET_DEFS: AchievementDef[] = [
  { id: 'fleet.size.5',  category: 'fleet', name: 'Real Airline Status',     description: 'Own 5 aircraft.',                            reward:    10_000, predicate: (s) => s.fleet.length >= 5 },
  { id: 'fleet.size.10', category: 'fleet', name: 'Double-Digit Fleet',      description: 'Own 10 aircraft.',                           reward:    15_000, predicate: (s) => s.fleet.length >= 10 },
  { id: 'fleet.size.25', category: 'fleet', name: 'Hangar Tycoon',           description: 'Own 25 aircraft.',                           reward:    50_000, predicate: (s) => s.fleet.length >= 25 },
  { id: 'fleet.size.50', category: 'fleet', name: 'Sky Fleet',               description: 'Own 50 aircraft.',                           reward:   200_000, predicate: (s) => s.fleet.length >= 50 },
  { id: 'fleet.tier.3',  category: 'fleet', name: 'Narrow-body Operator',    description: 'Unlock Tier 3 aircraft.',                    reward:    25_000, predicate: (s) => s.tierUnlocked >= 3 },
  { id: 'fleet.tier.5',  category: 'fleet', name: 'Wide-body Era',           description: 'Unlock Tier 5 aircraft.',                    reward:    40_000, predicate: (s) => s.tierUnlocked >= 5 },
  { id: 'fleet.tier.7',  category: 'fleet', name: 'Heavy Flagship',          description: 'Unlock Tier 7 aircraft.',                    reward:   100_000, predicate: (s) => s.tierUnlocked >= 7 },
  { id: 'fleet.tier.8',  category: 'fleet', name: 'Mega-liner Carrier',      description: 'Unlock Tier 8 mega-liners.',                 reward: 1_000_000, predicate: (s) => s.tierUnlocked >= 8 },
  { id: 'fleet.types.6', category: 'fleet', name: 'Diversified Fleet',       description: 'Own 6 different aircraft types.',            reward:   100_000, predicate: (s) => uniqueTypes(s) >= 6 },
];

const ECONOMY_DEFS: AchievementDef[] = [
  { id: 'econ.cash.1m',   category: 'economy', name: 'Millionaire Operator',  description: 'Hold $1M in cash.',          reward:    30_000, predicate: (s) => s.cash >= 1_000_000 },
  { id: 'econ.cash.10m',  category: 'economy', name: 'Treasury Lifted',       description: 'Hold $10M in cash.',         reward:   150_000, predicate: (s) => s.cash >= 10_000_000 },
  { id: 'econ.cash.100m', category: 'economy', name: 'Industry Heavyweight',  description: 'Hold $100M in cash.',        reward: 1_000_000, predicate: (s) => s.cash >= 100_000_000 },
  { id: 'econ.cash.1b',   category: 'economy', name: 'Billionaire Holder',    description: 'Hold $1B in cash.',          reward: 10_000_000, predicate: (s) => s.cash >= 1_000_000_000 },
  { id: 'econ.life.1m',   category: 'economy', name: 'First Million Earned',  description: 'Earn $1M lifetime.',         reward:    30_000, predicate: (s) => s.lifetimeEarnings >= 1_000_000 },
  { id: 'econ.life.10m',  category: 'economy', name: 'Million Passenger Club', description: 'Earn $10M lifetime.',       reward:   150_000, predicate: (s) => s.lifetimeEarnings >= 10_000_000 },
  { id: 'econ.life.100m', category: 'economy', name: 'Centurion of the Skies', description: 'Earn $100M lifetime.',      reward: 1_000_000, predicate: (s) => s.lifetimeEarnings >= 100_000_000 },
  { id: 'econ.life.1b',   category: 'economy', name: 'Sky Mogul',             description: 'Earn $1B lifetime.',         reward: 10_000_000, predicate: (s) => s.lifetimeEarnings >= 1_000_000_000 },
  { id: 'econ.life.10b',  category: 'economy', name: 'Aviation Legend',       description: 'Earn $10B lifetime.',        reward: 100_000_000, predicate: (s) => s.lifetimeEarnings >= 10_000_000_000 },
];

const OPERATIONS_DEFS: AchievementDef[] = [
  { id: 'ops.contracts.3', category: 'operations', name: 'Supply Network',     description: 'Sign 3 fuel contracts.',              reward:    30_000, predicate: (s) => s.fuel.contracts.length >= 3 },
  { id: 'ops.contracts.5', category: 'operations', name: 'Fuel Tycoon',        description: 'Sign 5 fuel contracts.',              reward:   100_000, predicate: (s) => s.fuel.contracts.length >= 5 },
  { id: 'ops.contracts.all', category: 'operations', name: 'Energy Cartel',    description: 'Sign every fuel contract.',           reward:   200_000, predicate: (s) => s.fuel.contracts.length >= 8 },
  { id: 'ops.capacity.3',  category: 'operations', name: 'Industrial Reserve', description: 'Upgrade fuel capacity to tier 3.',    reward:    30_000, predicate: (s) => s.fuel.capacity >= 28_000 },
  { id: 'ops.capacity.5',  category: 'operations', name: 'Strategic Reserve',  description: 'Upgrade fuel capacity to tier 5.',    reward:   100_000, predicate: (s) => s.fuel.capacity >= 250_000 },
  { id: 'ops.managers.5',  category: 'operations', name: 'Building a Team',    description: 'Hire 5 managers across your hubs.',   reward:    10_000, predicate: (s) => totalManagers(s) >= 5 },
  { id: 'ops.managers.15', category: 'operations', name: 'Crew Complete',      description: 'Hire 15 managers across your hubs.',  reward:    25_000, predicate: (s) => totalManagers(s) >= 15 },
  { id: 'ops.hublv.3',     category: 'operations', name: 'Hub Investment',     description: 'Upgrade a hub to level 3.',           reward:    10_000, predicate: (s) => s.hubs.some((h) => h.level >= 3) },
  { id: 'ops.hublv.5',     category: 'operations', name: 'Maxed Hub',          description: 'Upgrade a hub to level 5.',           reward:    20_000, predicate: (s) => s.hubs.some((h) => h.level >= 5) },
];

const MASTERY_DEFS: AchievementDef[] = [
  { id: 'mas.cond.95',     category: 'mastery', name: 'Perfectionist',      description: 'Average fleet condition ≥ 95% (10+ aircraft).', reward:    10_000, predicate: (s) => s.fleet.length >= 10 && avgCondition(s) >= 95 },
  { id: 'mas.eco.50',      category: 'mastery', name: 'Green Skies',        description: 'Reach an Eco rating of 50.',                    reward:    30_000, predicate: (s) => s.ecoRating >= 50 },
  { id: 'mas.eco.75',      category: 'mastery', name: 'Sustainable Carrier', description: 'Reach an Eco rating of 75.',                    reward:    75_000, predicate: (s) => s.ecoRating >= 75 },
  { id: 'mas.eco.100',     category: 'mastery', name: 'Carbon Neutral',     description: 'Reach a perfect Eco rating of 100.',            reward:   150_000, predicate: (s) => s.ecoRating >= 100 },
  { id: 'mas.upg.10',      category: 'mastery', name: 'Master Mechanic',    description: 'Reach 10+ total upgrade levels on one aircraft.', reward:   10_000, predicate: (s) => s.fleet.some((a) => totalUpgrades(a) >= 10) },
  { id: 'mas.upg.25',      category: 'mastery', name: 'Workshop Floor',     description: 'Spend 25+ upgrade levels across the fleet.',    reward:    25_000, predicate: (s) => totalFleetUpgrades(s) >= 25 },
  { id: 'mas.cargo.1',     category: 'mastery', name: 'Freight Forward',    description: 'Open your first cargo route.',                   reward:    30_000, predicate: (s) => s.fleet.some((a) => a.routeId !== null && a.defId.startsWith('cargo.')) },
  { id: 'mas.vintage.3',   category: 'mastery', name: 'Curator',            description: 'Collect 3 vintage classics.',                    reward:    75_000, predicate: (s) => s.vintage.length >= 3 },
  { id: 'mas.vintage.6',   category: 'mastery', name: 'Restoration Wing',   description: 'Collect 6 vintage classics.',                    reward:   300_000, predicate: (s) => s.vintage.length >= 6 },
  { id: 'mas.vintage.12',  category: 'mastery', name: 'Museum Director',    description: 'Collect all 12 vintage classics.',               reward:   500_000, predicate: (s) => s.vintage.length >= 12 },
];

const MILESTONE_DEFS: AchievementDef[] = [
  { id: 'mil.tutorial',    category: 'milestone', name: 'First Solo Route',     description: 'Complete the onboarding tutorial.',     reward:     5_000, predicate: (s) => s.tutorialCompleted },
  { id: 'mil.goalchain',   category: 'milestone', name: 'All Missions Cleared', description: 'Complete the early-goal chain.',        reward:    10_000, predicate: (s) => s.goalChainStep >= 8 },
  { id: 'mil.login.3',     category: 'milestone', name: 'Returning Pilot',      description: 'Sign in 3 days in a row.',              reward:     5_000, predicate: (s) => s.loginStreak >= 3 },
  { id: 'mil.login.7',     category: 'milestone', name: 'Week of Service',      description: 'Sign in 7 days in a row.',              reward:    15_000, predicate: (s) => s.loginStreak >= 7 },
  { id: 'mil.login.30',    category: 'milestone', name: 'Loyal Operator',       description: 'Sign in 30 days in a row.',             reward:    25_000, predicate: (s) => s.loginStreak >= 30 },
  { id: 'mil.fuelevent',   category: 'milestone', name: 'Storm Survivor',       description: 'Survive a Fuel Price Spike event.',     reward:     5_000, predicate: () => false /* set by tick on event expiry */ },
];

function totalUpgrades(a: SaveState['fleet'][number]): number {
  const u = a.upgrades;
  return u.engine + u.cabin + u.fuelEff + u.marketing;
}

function totalFleetUpgrades(s: SaveState): number {
  let n = 0;
  for (const a of s.fleet) n += totalUpgrades(a);
  return n;
}

function totalManagers(s: SaveState): number {
  let n = 0;
  for (const h of s.hubs) {
    for (const hired of Object.values(h.managers)) if (hired) n++;
  }
  return n;
}

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  ...NETWORK_DEFS,
  ...FLEET_DEFS,
  ...ECONOMY_DEFS,
  ...OPERATIONS_DEFS,
  ...MASTERY_DEFS,
  ...MILESTONE_DEFS,
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENT_DEFS.length;

const BY_ID = new Map(ACHIEVEMENT_DEFS.map((a) => [a.id, a]));
export function getAchievement(id: string): AchievementDef | undefined {
  return BY_ID.get(id);
}

export function achievementsByCategory(): Record<AchievementCategory, AchievementDef[]> {
  const out: Record<AchievementCategory, AchievementDef[]> = {
    network: [], fleet: [], economy: [], operations: [], mastery: [], milestone: [],
  };
  for (const a of ACHIEVEMENT_DEFS) out[a.category].push(a);
  return out;
}

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  network: 'Network',
  fleet: 'Fleet',
  economy: 'Economy',
  operations: 'Operations',
  mastery: 'Mastery',
  milestone: 'Milestones',
};

/**
 * Cosmetic frame tier driven by # achievements unlocked. Surfaces on
 * the airline identity card in OfficePanel / TopBar so players have a
 * visible badge of their progress. Thresholds chosen so each tier
 * feels earned without being unreachable.
 */
export type FrameTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
export function frameTier(unlockedCount: number): FrameTier {
  if (unlockedCount >= 50) return 'platinum';
  if (unlockedCount >= 30) return 'gold';
  if (unlockedCount >= 15) return 'silver';
  if (unlockedCount >= 5)  return 'bronze';
  return 'none';
}

export const FRAME_COLORS: Record<FrameTier, { primary: string; secondary: string; label: string }> = {
  none:     { primary: '#475569', secondary: '#1E293B', label: '—' },
  bronze:   { primary: '#B08D57', secondary: '#7A5F35', label: 'Bronze' },
  silver:   { primary: '#C0C0C8', secondary: '#7E7E86', label: 'Silver' },
  gold:     { primary: '#F4C75B', secondary: '#B08D2E', label: 'Gold' },
  platinum: { primary: '#E5E4E2', secondary: '#8FA8B5', label: 'Platinum' },
};
