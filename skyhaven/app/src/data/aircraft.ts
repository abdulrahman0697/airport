/**
 * Aircraft definitions — Tiers 1–4 (Phase 3).
 *
 * Per BRD §4.2: real-world type names may be referenced; no airline
 * liveries or trademarked logos. The displayName uses the manufacturer
 * type designation only; the `artId` slot is filled with placeholders
 * until the owner supplies the side-view illustrations (Phase 10).
 *
 * Numbers are seed defaults. Every value is Remote-Config-tunable at
 * runtime (BRD §4.13, §13.3) via the economy multipliers.
 *
 * Curve targets (a fresh airline, $25K → $10M):
 *   - T1 unlocked at $0 (start)
 *   - T2 unlocked at $50K lifetime earnings
 *   - T3 unlocked at $500K
 *   - T4 unlocked at $5M
 *
 * The conditionDecayRate is expressed as %-condition per game-hour of
 * flight. With TIME_COMPRESSION=120 (1 game-hour = 30 real seconds),
 * a continuously-flying T1 aircraft hits the 70% penalty threshold
 * after roughly an hour of real-time play. Tuned as texture, not
 * punishment (BRD §4.2).
 */
import type { AircraftDef } from '../engine/types';

export const AIRCRAFT_DEFS: readonly AircraftDef[] = [
  // ── Tier 1 — Regional Turboprop ────────────────────────────────────
  {
    id: 't1.atr42', displayName: 'ATR 42', tier: 1, category: 'passenger',
    capacity: 48, rangeKm: 1450, cruiseSpeedKmh: 500, fuelPerHour: 280,
    basePurchaseCost: 25_000, conditionDecayRate: 0.25, artId: 'placeholder.t1.atr42',
  },
  {
    id: 't1.atr72', displayName: 'ATR 72', tier: 1, category: 'passenger',
    capacity: 72, rangeKm: 1500, cruiseSpeedKmh: 510, fuelPerHour: 320,
    basePurchaseCost: 45_000, conditionDecayRate: 0.24, artId: 'placeholder.t1.atr72',
  },
  {
    id: 't1.dash8', displayName: 'Dash 8 Q400', tier: 1, category: 'passenger',
    capacity: 78, rangeKm: 2040, cruiseSpeedKmh: 640, fuelPerHour: 380,
    basePurchaseCost: 65_000, conditionDecayRate: 0.23, artId: 'placeholder.t1.dash8',
  },
  {
    id: 't1.crj200', displayName: 'CRJ-200', tier: 1, category: 'passenger',
    capacity: 50, rangeKm: 3050, cruiseSpeedKmh: 786, fuelPerHour: 470,
    basePurchaseCost: 80_000, conditionDecayRate: 0.22, artId: 'placeholder.t1.crj200',
  },
  {
    id: 't1.saab340', displayName: 'Saab 340', tier: 1, category: 'passenger',
    capacity: 34, rangeKm: 1730, cruiseSpeedKmh: 522, fuelPerHour: 240,
    basePurchaseCost: 18_000, conditionDecayRate: 0.26, artId: 'placeholder.t1.saab340',
  },

  // ── Tier 2 — Regional Jet ──────────────────────────────────────────
  {
    id: 't2.e170', displayName: 'E170', tier: 2, category: 'passenger',
    capacity: 78, rangeKm: 3700, cruiseSpeedKmh: 870, fuelPerHour: 720,
    basePurchaseCost: 240_000, conditionDecayRate: 0.22, artId: 'placeholder.t2.e170',
  },
  {
    id: 't2.e190', displayName: 'E190', tier: 2, category: 'passenger',
    capacity: 100, rangeKm: 4540, cruiseSpeedKmh: 870, fuelPerHour: 820,
    basePurchaseCost: 360_000, conditionDecayRate: 0.20, artId: 'placeholder.t2.e190',
  },
  {
    id: 't2.crj900', displayName: 'CRJ-900', tier: 2, category: 'passenger',
    capacity: 90, rangeKm: 2956, cruiseSpeedKmh: 829, fuelPerHour: 780,
    basePurchaseCost: 320_000, conditionDecayRate: 0.21, artId: 'placeholder.t2.crj900',
  },
  {
    id: 't2.arj21', displayName: 'ARJ21', tier: 2, category: 'passenger',
    capacity: 95, rangeKm: 3700, cruiseSpeedKmh: 828, fuelPerHour: 810,
    basePurchaseCost: 310_000, conditionDecayRate: 0.22, artId: 'placeholder.t2.arj21',
  },
  {
    id: 't2.spacejet', displayName: 'SpaceJet', tier: 2, category: 'passenger',
    capacity: 88, rangeKm: 3770, cruiseSpeedKmh: 870, fuelPerHour: 770,
    basePurchaseCost: 280_000, conditionDecayRate: 0.20, artId: 'placeholder.t2.spacejet',
  },

  // ── Tier 3 — Narrow-body ───────────────────────────────────────────
  {
    id: 't3.a220-100', displayName: 'A220-100', tier: 3, category: 'passenger',
    capacity: 130, rangeKm: 5740, cruiseSpeedKmh: 871, fuelPerHour: 1450,
    basePurchaseCost: 2_400_000, conditionDecayRate: 0.18, artId: 'placeholder.t3.a220-100',
  },
  {
    id: 't3.a220-300', displayName: 'A220-300', tier: 3, category: 'passenger',
    capacity: 160, rangeKm: 6700, cruiseSpeedKmh: 871, fuelPerHour: 1580,
    basePurchaseCost: 3_300_000, conditionDecayRate: 0.18, artId: 'placeholder.t3.a220-300',
  },
  {
    id: 't3.a319neo', displayName: 'A319', tier: 3, category: 'passenger',
    capacity: 156, rangeKm: 6850, cruiseSpeedKmh: 829, fuelPerHour: 1700,
    basePurchaseCost: 3_800_000, conditionDecayRate: 0.19, artId: 'placeholder.t3.a319neo',
  },
  {
    id: 't3.b737-700', displayName: 'B737-700', tier: 3, category: 'passenger',
    capacity: 149, rangeKm: 6230, cruiseSpeedKmh: 828, fuelPerHour: 1820,
    basePurchaseCost: 3_500_000, conditionDecayRate: 0.20, artId: 'placeholder.t3.b737-700',
  },
  {
    id: 't3.b737-800', displayName: 'B737-800', tier: 3, category: 'passenger',
    capacity: 189, rangeKm: 5765, cruiseSpeedKmh: 828, fuelPerHour: 1990,
    basePurchaseCost: 4_600_000, conditionDecayRate: 0.20, artId: 'placeholder.t3.b737-800',
  },

  // ── Tier 4 — Modern Narrow-body ────────────────────────────────────
  {
    id: 't4.a320neo', displayName: 'A320neo', tier: 4, category: 'passenger',
    capacity: 194, rangeKm: 6300, cruiseSpeedKmh: 833, fuelPerHour: 1820,
    basePurchaseCost: 14_000_000, conditionDecayRate: 0.15, artId: 'placeholder.t4.a320neo',
  },
  {
    id: 't4.a321neo', displayName: 'A321neo', tier: 4, category: 'passenger',
    capacity: 244, rangeKm: 7400, cruiseSpeedKmh: 833, fuelPerHour: 1950,
    basePurchaseCost: 18_500_000, conditionDecayRate: 0.15, artId: 'placeholder.t4.a321neo',
  },
  {
    id: 't4.a321xlr', displayName: 'A321XLR', tier: 4, category: 'passenger',
    capacity: 244, rangeKm: 8700, cruiseSpeedKmh: 833, fuelPerHour: 2050,
    basePurchaseCost: 21_500_000, conditionDecayRate: 0.15, artId: 'placeholder.t4.a321xlr',
  },
  {
    id: 't4.b737max8', displayName: 'B737 MAX 8', tier: 4, category: 'passenger',
    capacity: 210, rangeKm: 6570, cruiseSpeedKmh: 839, fuelPerHour: 1860,
    basePurchaseCost: 15_500_000, conditionDecayRate: 0.16, artId: 'placeholder.t4.b737max8',
  },
  {
    id: 't4.b737max10', displayName: 'B737 MAX 10', tier: 4, category: 'passenger',
    capacity: 230, rangeKm: 6110, cruiseSpeedKmh: 839, fuelPerHour: 1960,
    basePurchaseCost: 17_500_000, conditionDecayRate: 0.16, artId: 'placeholder.t4.b737max10',
  },
];

const BY_ID = new Map(AIRCRAFT_DEFS.map((a) => [a.id, a]));

export function getAircraftDef(id: string): AircraftDef | undefined {
  return BY_ID.get(id);
}

export function aircraftByTier(tier: number): readonly AircraftDef[] {
  return AIRCRAFT_DEFS.filter((a) => a.tier === tier);
}
