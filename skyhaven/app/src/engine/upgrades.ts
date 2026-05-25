/**
 * Per-aircraft upgrades (BRD §4.7).
 *
 *   Engine I–X        +speed         (5% per level → faster legs, more revenue/sec)
 *   Cabin I–X         +capacity      (5% per level → more revenue/leg)
 *   Fuel Eff I–V      −fuel burn     (10% per level; Phase 4 wires this into demand)
 *   Brand Marketing I–X +load factor (+0.03 per level)
 *
 *   cost(n) = baseCost × 1.15^n
 *
 *   baseCost is a fraction of the aircraft's purchase price so upgrades
 *   scale naturally with the tier the player is on. The Engine and Cabin
 *   upgrade lines feel like meaningful sinks against the next-tier price.
 */
import { getAircraftDef } from '../data/aircraft';
import type { OwnedAircraft } from './types';

export type UpgradeKind = 'engine' | 'cabin' | 'fuelEff' | 'marketing';

export interface UpgradeSpec {
  /** Max level (inclusive). I = level 1, X = level 10, V = level 5. */
  maxLevel: number;
  /** Fraction of purchase cost used as the base for cost(n). */
  baseFraction: number;
  /** Growth factor per level — 1.15 per BRD §4.7. */
  growth: number;
}

export const UPGRADE_SPECS: Record<UpgradeKind, UpgradeSpec> = {
  engine:    { maxLevel: 10, baseFraction: 0.10, growth: 1.15 },
  cabin:     { maxLevel: 10, baseFraction: 0.12, growth: 1.15 },
  fuelEff:   { maxLevel: 5,  baseFraction: 0.18, growth: 1.15 },
  marketing: { maxLevel: 10, baseFraction: 0.08, growth: 1.15 },
};

export const UPGRADE_LABELS: Record<UpgradeKind, string> = {
  engine: 'Engine',
  cabin: 'Cabin',
  fuelEff: 'Fuel Eff',
  marketing: 'Brand Mktg',
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export function romanLevel(n: number): string {
  return n >= 0 && n < ROMAN.length ? ROMAN[n]! : String(n);
}

export function upgradeCost(aircraft: OwnedAircraft, kind: UpgradeKind): number {
  const def = getAircraftDef(aircraft.defId);
  if (!def) return Number.POSITIVE_INFINITY;
  const spec = UPGRADE_SPECS[kind];
  const level = aircraft.upgrades[kind];
  if (level >= spec.maxLevel) return Number.POSITIVE_INFINITY;
  return Math.round(def.basePurchaseCost * spec.baseFraction * Math.pow(spec.growth, level));
}

export function canUpgrade(aircraft: OwnedAircraft, kind: UpgradeKind): boolean {
  return aircraft.upgrades[kind] < UPGRADE_SPECS[kind].maxLevel;
}
