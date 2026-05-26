/**
 * Aircraft definitions — Tiers 1–8 + Cargo (Phase 7).
 *
 * Per BRD §4.2: real-world type names only, no liveries or trademarks.
 * Numbers are seed defaults; Remote Config tunes at runtime.
 *
 * Tier 7+ pricing climbs steeply — these are the late-game vanity
 * platforms. T8 mega-liners are runway-gated to category-4 airports
 * (BRD §4.2 / §4.3) and require considerable fuel headroom.
 *
 * Cargo (BRD §4.5): a parallel category, unlocked alongside T5. No
 * pricing, no load factor — always ships full. Revenue per leg is
 * `capacity × distance × yield × hub × event` (no condition penalty
 * thresholds beyond the standard 70/40 bands).
 */
import type { AircraftDef } from '../engine/types';

export const AIRCRAFT_DEFS: readonly AircraftDef[] = [
  // ── Tier 1 — Regional Turboprop ────────────────────────────────────
  { id: 't1.atr42', displayName: 'ATR 42', tier: 1, category: 'passenger',
    capacity: 48, rangeKm: 1450, cruiseSpeedKmh: 500, fuelPerHour: 280,
    basePurchaseCost: 25_000, conditionDecayRate: 0.25, artId: 'placeholder.t1.atr42' },
  { id: 't1.atr72', displayName: 'ATR 72', tier: 1, category: 'passenger',
    capacity: 72, rangeKm: 1500, cruiseSpeedKmh: 510, fuelPerHour: 320,
    basePurchaseCost: 45_000, conditionDecayRate: 0.24, artId: 'placeholder.t1.atr72' },
  { id: 't1.dash8', displayName: 'Dash 8 Q400', tier: 1, category: 'passenger',
    capacity: 78, rangeKm: 2040, cruiseSpeedKmh: 640, fuelPerHour: 380,
    basePurchaseCost: 65_000, conditionDecayRate: 0.23, artId: 'placeholder.t1.dash8' },
  { id: 't1.crj200', displayName: 'CRJ-200', tier: 1, category: 'passenger',
    capacity: 50, rangeKm: 3050, cruiseSpeedKmh: 786, fuelPerHour: 470,
    basePurchaseCost: 80_000, conditionDecayRate: 0.22, artId: 'placeholder.t1.crj200' },
  { id: 't1.saab340', displayName: 'Saab 340', tier: 1, category: 'passenger',
    capacity: 34, rangeKm: 1730, cruiseSpeedKmh: 522, fuelPerHour: 240,
    basePurchaseCost: 18_000, conditionDecayRate: 0.26, artId: 'placeholder.t1.saab340' },

  // ── Tier 2 — Regional Jet ──────────────────────────────────────────
  { id: 't2.e170', displayName: 'E170', tier: 2, category: 'passenger',
    capacity: 78, rangeKm: 3700, cruiseSpeedKmh: 870, fuelPerHour: 720,
    basePurchaseCost: 240_000, conditionDecayRate: 0.22, artId: 'placeholder.t2.e170' },
  { id: 't2.e190', displayName: 'E190', tier: 2, category: 'passenger',
    capacity: 100, rangeKm: 4540, cruiseSpeedKmh: 870, fuelPerHour: 820,
    basePurchaseCost: 360_000, conditionDecayRate: 0.20, artId: 'placeholder.t2.e190' },
  { id: 't2.crj900', displayName: 'CRJ-900', tier: 2, category: 'passenger',
    capacity: 90, rangeKm: 2956, cruiseSpeedKmh: 829, fuelPerHour: 780,
    basePurchaseCost: 320_000, conditionDecayRate: 0.21, artId: 'placeholder.t2.crj900' },
  { id: 't2.arj21', displayName: 'ARJ21', tier: 2, category: 'passenger',
    capacity: 95, rangeKm: 3700, cruiseSpeedKmh: 828, fuelPerHour: 810,
    basePurchaseCost: 310_000, conditionDecayRate: 0.22, artId: 'placeholder.t2.arj21' },
  { id: 't2.spacejet', displayName: 'SpaceJet', tier: 2, category: 'passenger',
    capacity: 88, rangeKm: 3770, cruiseSpeedKmh: 870, fuelPerHour: 770,
    basePurchaseCost: 280_000, conditionDecayRate: 0.20, artId: 'placeholder.t2.spacejet' },

  // ── Tier 3 — Narrow-body ───────────────────────────────────────────
  { id: 't3.a220-100', displayName: 'A220-100', tier: 3, category: 'passenger',
    capacity: 130, rangeKm: 5740, cruiseSpeedKmh: 871, fuelPerHour: 1450,
    basePurchaseCost: 2_400_000, conditionDecayRate: 0.18, artId: 'placeholder.t3.a220-100' },
  { id: 't3.a220-300', displayName: 'A220-300', tier: 3, category: 'passenger',
    capacity: 160, rangeKm: 6700, cruiseSpeedKmh: 871, fuelPerHour: 1580,
    basePurchaseCost: 3_300_000, conditionDecayRate: 0.18, artId: 'placeholder.t3.a220-300' },
  { id: 't3.a319neo', displayName: 'A319', tier: 3, category: 'passenger',
    capacity: 156, rangeKm: 6850, cruiseSpeedKmh: 829, fuelPerHour: 1700,
    basePurchaseCost: 3_800_000, conditionDecayRate: 0.19, artId: 'placeholder.t3.a319neo' },
  { id: 't3.b737-700', displayName: 'B737-700', tier: 3, category: 'passenger',
    capacity: 149, rangeKm: 6230, cruiseSpeedKmh: 828, fuelPerHour: 1820,
    basePurchaseCost: 3_500_000, conditionDecayRate: 0.20, artId: 'placeholder.t3.b737-700' },
  { id: 't3.b737-800', displayName: 'B737-800', tier: 3, category: 'passenger',
    capacity: 189, rangeKm: 5765, cruiseSpeedKmh: 828, fuelPerHour: 1990,
    basePurchaseCost: 4_600_000, conditionDecayRate: 0.20, artId: 'placeholder.t3.b737-800' },

  // ── Tier 4 — Modern Narrow-body ────────────────────────────────────
  { id: 't4.a320neo', displayName: 'A320neo', tier: 4, category: 'passenger',
    capacity: 194, rangeKm: 6300, cruiseSpeedKmh: 833, fuelPerHour: 1820,
    basePurchaseCost: 14_000_000, conditionDecayRate: 0.15, artId: 'placeholder.t4.a320neo' },
  { id: 't4.a321neo', displayName: 'A321neo', tier: 4, category: 'passenger',
    capacity: 244, rangeKm: 7400, cruiseSpeedKmh: 833, fuelPerHour: 1950,
    basePurchaseCost: 18_500_000, conditionDecayRate: 0.15, artId: 'placeholder.t4.a321neo' },
  { id: 't4.a321xlr', displayName: 'A321XLR', tier: 4, category: 'passenger',
    capacity: 244, rangeKm: 8700, cruiseSpeedKmh: 833, fuelPerHour: 2050,
    basePurchaseCost: 21_500_000, conditionDecayRate: 0.15, artId: 'placeholder.t4.a321xlr' },
  { id: 't4.b737max8', displayName: 'B737 MAX 8', tier: 4, category: 'passenger',
    capacity: 210, rangeKm: 6570, cruiseSpeedKmh: 839, fuelPerHour: 1860,
    basePurchaseCost: 15_500_000, conditionDecayRate: 0.16, artId: 'placeholder.t4.b737max8' },
  { id: 't4.b737max10', displayName: 'B737 MAX 10', tier: 4, category: 'passenger',
    capacity: 230, rangeKm: 6110, cruiseSpeedKmh: 839, fuelPerHour: 1960,
    basePurchaseCost: 17_500_000, conditionDecayRate: 0.16, artId: 'placeholder.t4.b737max10' },

  // ── Tier 5 — Wide-body ─────────────────────────────────────────────
  { id: 't5.a330-200', displayName: 'A330-200', tier: 5, category: 'passenger',
    capacity: 247, rangeKm: 13_450, cruiseSpeedKmh: 871, fuelPerHour: 5_700,
    basePurchaseCost: 80_000_000, conditionDecayRate: 0.14, artId: 'placeholder.t5.a330-200' },
  { id: 't5.a330-300', displayName: 'A330-300', tier: 5, category: 'passenger',
    capacity: 290, rangeKm: 11_750, cruiseSpeedKmh: 871, fuelPerHour: 6_100,
    basePurchaseCost: 95_000_000, conditionDecayRate: 0.14, artId: 'placeholder.t5.a330-300' },
  { id: 't5.b767-300', displayName: 'B767-300', tier: 5, category: 'passenger',
    capacity: 269, rangeKm: 11_070, cruiseSpeedKmh: 851, fuelPerHour: 5_900,
    basePurchaseCost: 78_000_000, conditionDecayRate: 0.15, artId: 'placeholder.t5.b767-300' },
  { id: 't5.b787-8', displayName: 'B787-8', tier: 5, category: 'passenger',
    capacity: 242, rangeKm: 13_530, cruiseSpeedKmh: 903, fuelPerHour: 5_400,
    basePurchaseCost: 110_000_000, conditionDecayRate: 0.13, artId: 'placeholder.t5.b787-8' },
  { id: 't5.b787-9', displayName: 'B787-9', tier: 5, category: 'passenger',
    capacity: 296, rangeKm: 14_140, cruiseSpeedKmh: 903, fuelPerHour: 5_800,
    basePurchaseCost: 135_000_000, conditionDecayRate: 0.13, artId: 'placeholder.t5.b787-9' },

  // ── Tier 6 — Modern Wide-body ──────────────────────────────────────
  { id: 't6.a330neo', displayName: 'A330neo', tier: 6, category: 'passenger',
    capacity: 310, rangeKm: 13_300, cruiseSpeedKmh: 882, fuelPerHour: 5_800,
    basePurchaseCost: 180_000_000, conditionDecayRate: 0.12, artId: 'placeholder.t6.a330neo' },
  { id: 't6.a350-900', displayName: 'A350-900', tier: 6, category: 'passenger',
    capacity: 325, rangeKm: 15_372, cruiseSpeedKmh: 903, fuelPerHour: 6_400,
    basePurchaseCost: 240_000_000, conditionDecayRate: 0.11, artId: 'placeholder.t6.a350-900' },
  { id: 't6.a350-1000', displayName: 'A350-1000', tier: 6, category: 'passenger',
    capacity: 369, rangeKm: 16_100, cruiseSpeedKmh: 903, fuelPerHour: 7_000,
    basePurchaseCost: 290_000_000, conditionDecayRate: 0.11, artId: 'placeholder.t6.a350-1000' },
  { id: 't6.b787-10', displayName: 'B787-10', tier: 6, category: 'passenger',
    capacity: 336, rangeKm: 11_910, cruiseSpeedKmh: 903, fuelPerHour: 6_100,
    basePurchaseCost: 230_000_000, conditionDecayRate: 0.12, artId: 'placeholder.t6.b787-10' },
  { id: 't6.b777-300er', displayName: 'B777-300ER', tier: 6, category: 'passenger',
    capacity: 396, rangeKm: 13_650, cruiseSpeedKmh: 905, fuelPerHour: 7_400,
    basePurchaseCost: 275_000_000, conditionDecayRate: 0.12, artId: 'placeholder.t6.b777-300er' },

  // ── Tier 7 — Heavy / Flagship ──────────────────────────────────────
  { id: 't7.a340-600', displayName: 'A340-600', tier: 7, category: 'passenger',
    capacity: 380, rangeKm: 14_350, cruiseSpeedKmh: 881, fuelPerHour: 9_200,
    basePurchaseCost: 480_000_000, conditionDecayRate: 0.13, artId: 'placeholder.t7.a340-600' },
  { id: 't7.b747-400', displayName: 'B747-400', tier: 7, category: 'passenger',
    capacity: 416, rangeKm: 13_490, cruiseSpeedKmh: 933, fuelPerHour: 11_000,
    basePurchaseCost: 520_000_000, conditionDecayRate: 0.14, artId: 'placeholder.t7.b747-400' },
  { id: 't7.b747-8i', displayName: 'B747-8I', tier: 7, category: 'passenger',
    capacity: 467, rangeKm: 14_320, cruiseSpeedKmh: 933, fuelPerHour: 10_600,
    basePurchaseCost: 660_000_000, conditionDecayRate: 0.12, artId: 'placeholder.t7.b747-8i' },
  { id: 't7.b777-8', displayName: 'B777-8', tier: 7, category: 'passenger',
    capacity: 384, rangeKm: 16_200, cruiseSpeedKmh: 905, fuelPerHour: 8_400,
    basePurchaseCost: 590_000_000, conditionDecayRate: 0.11, artId: 'placeholder.t7.b777-8' },
  { id: 't7.a350-1000ulr', displayName: 'A350-1000 ULR', tier: 7, category: 'passenger',
    capacity: 375, rangeKm: 17_900, cruiseSpeedKmh: 903, fuelPerHour: 7_200,
    basePurchaseCost: 540_000_000, conditionDecayRate: 0.10, artId: 'placeholder.t7.a350-1000ulr' },

  // ── Tier 8 — Mega-Liner ────────────────────────────────────────────
  { id: 't8.a380-800', displayName: 'A380-800', tier: 8, category: 'passenger',
    capacity: 525, rangeKm: 15_200, cruiseSpeedKmh: 903, fuelPerHour: 13_500,
    basePurchaseCost: 2_500_000_000, conditionDecayRate: 0.11, artId: 'placeholder.t8.a380-800' },
  { id: 't8.a380plus', displayName: 'A380plus', tier: 8, category: 'passenger',
    capacity: 575, rangeKm: 15_800, cruiseSpeedKmh: 903, fuelPerHour: 13_200,
    basePurchaseCost: 3_200_000_000, conditionDecayRate: 0.10, artId: 'placeholder.t8.a380plus' },
  { id: 't8.b777-9', displayName: 'B777-9', tier: 8, category: 'passenger',
    capacity: 426, rangeKm: 13_500, cruiseSpeedKmh: 905, fuelPerHour: 9_800,
    basePurchaseCost: 2_700_000_000, conditionDecayRate: 0.10, artId: 'placeholder.t8.b777-9' },
  { id: 't8.a380neo', displayName: 'A380neo', tier: 8, category: 'passenger',
    capacity: 550, rangeKm: 16_200, cruiseSpeedKmh: 903, fuelPerHour: 12_400,
    basePurchaseCost: 3_900_000_000, conditionDecayRate: 0.09, artId: 'placeholder.t8.a380neo' },
  { id: 't8.b747-8ulr', displayName: 'B747-8 ULR', tier: 8, category: 'passenger',
    capacity: 580, rangeKm: 16_800, cruiseSpeedKmh: 933, fuelPerHour: 11_900,
    basePurchaseCost: 4_400_000_000, conditionDecayRate: 0.10, artId: 'placeholder.t8.b747-8ulr' },

  // ── Cargo ──────────────────────────────────────────────────────────
  // Cargo aircraft `capacity` represents cargo units, not seats.
  // Available once the player first reaches Tier 5 (BRD §4.5).
  { id: 'cg.b767-300f', displayName: 'B767-300F', tier: 0, category: 'cargo',
    capacity: 52, rangeKm: 6_025, cruiseSpeedKmh: 851, fuelPerHour: 5_900,
    basePurchaseCost: 90_000_000, conditionDecayRate: 0.13, artId: 'placeholder.cargo.b767f' },
  { id: 'cg.a330-200f', displayName: 'A330-200F', tier: 0, category: 'cargo',
    capacity: 70, rangeKm: 7_400, cruiseSpeedKmh: 871, fuelPerHour: 6_200,
    basePurchaseCost: 135_000_000, conditionDecayRate: 0.12, artId: 'placeholder.cargo.a330f' },
  { id: 'cg.md11f', displayName: 'MD-11F', tier: 0, category: 'cargo',
    capacity: 90, rangeKm: 7_240, cruiseSpeedKmh: 876, fuelPerHour: 7_600,
    basePurchaseCost: 160_000_000, conditionDecayRate: 0.15, artId: 'placeholder.cargo.md11f' },
  { id: 'cg.b777f', displayName: 'B777F', tier: 0, category: 'cargo',
    capacity: 102, rangeKm: 9_070, cruiseSpeedKmh: 905, fuelPerHour: 8_100,
    basePurchaseCost: 350_000_000, conditionDecayRate: 0.11, artId: 'placeholder.cargo.b777f' },
  { id: 'cg.a350f', displayName: 'A350F', tier: 0, category: 'cargo',
    capacity: 109, rangeKm: 8_700, cruiseSpeedKmh: 903, fuelPerHour: 7_400,
    basePurchaseCost: 380_000_000, conditionDecayRate: 0.10, artId: 'placeholder.cargo.a350f' },
  { id: 'cg.b747-8f', displayName: 'B747-8F', tier: 0, category: 'cargo',
    capacity: 140, rangeKm: 8_130, cruiseSpeedKmh: 933, fuelPerHour: 10_400,
    basePurchaseCost: 420_000_000, conditionDecayRate: 0.12, artId: 'placeholder.cargo.b747-8f' },
];

const BY_ID = new Map(AIRCRAFT_DEFS.map((a) => [a.id, a]));

export function getAircraftDef(id: string): AircraftDef | undefined {
  return BY_ID.get(id);
}

export function aircraftByTier(tier: number): readonly AircraftDef[] {
  return AIRCRAFT_DEFS.filter((a) => a.tier === tier);
}

export function cargoAircraft(): readonly AircraftDef[] {
  return AIRCRAFT_DEFS.filter((a) => a.category === 'cargo');
}
