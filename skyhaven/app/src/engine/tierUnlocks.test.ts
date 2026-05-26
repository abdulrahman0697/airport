import { describe, expect, it } from 'vitest';
import { MAX_TIER, maxTierUnlockedFor } from './tierUnlocks';

describe('maxTierUnlockedFor', () => {
  it('starts at tier 1', () => {
    expect(maxTierUnlockedFor(0)).toBe(1);
    expect(maxTierUnlockedFor(49_999)).toBe(1);
  });

  it('unlocks tier 2 at $50K lifetime earnings', () => {
    expect(maxTierUnlockedFor(50_000)).toBe(2);
    expect(maxTierUnlockedFor(499_999)).toBe(2);
  });

  it('unlocks tier 3 at $500K', () => {
    expect(maxTierUnlockedFor(500_000)).toBe(3);
    expect(maxTierUnlockedFor(4_999_999)).toBe(3);
  });

  it('unlocks tier 4 at $5M', () => {
    expect(maxTierUnlockedFor(5_000_000)).toBe(4);
    expect(maxTierUnlockedFor(24_999_999)).toBe(4);
  });

  it('unlocks tier 5 at $25M (Phase 7)', () => {
    expect(maxTierUnlockedFor(25_000_000)).toBe(5);
    expect(maxTierUnlockedFor(149_999_999)).toBe(5);
  });

  it('unlocks tier 6 at $150M (Phase 7)', () => {
    expect(maxTierUnlockedFor(150_000_000)).toBe(6);
  });

  it('unlocks tier 7 at $750M (Phase 7)', () => {
    expect(maxTierUnlockedFor(750_000_000)).toBe(7);
  });

  it('unlocks tier 8 at $4B (Phase 7)', () => {
    expect(maxTierUnlockedFor(4_000_000_000)).toBe(8);
    expect(maxTierUnlockedFor(1e15)).toBe(MAX_TIER);
  });

  it('respects the ceiling argument', () => {
    expect(maxTierUnlockedFor(1e12, 2)).toBe(2);
  });
});
