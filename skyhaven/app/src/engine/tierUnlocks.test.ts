import { describe, expect, it } from 'vitest';
import { maxTierUnlockedFor } from './tierUnlocks';

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
    expect(maxTierUnlockedFor(50_000_000)).toBe(4);
  });

  it('respects the ceiling argument', () => {
    expect(maxTierUnlockedFor(1e12, 2)).toBe(2);
  });
});
