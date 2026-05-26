import { describe, expect, it } from 'vitest';
import { formatCash } from './format';

describe('formatCash', () => {
  it('shows raw integers under 1000', () => {
    expect(formatCash(0)).toBe('0');
    expect(formatCash(999)).toBe('999');
  });

  it('uses K/M/B/T suffixes with 4 sig digits', () => {
    expect(formatCash(1234)).toBe('1.234K');
    expect(formatCash(12_345)).toBe('12.35K');
    expect(formatCash(123_456)).toBe('123.5K');
    expect(formatCash(1_234_567)).toBe('1.235M');
    expect(formatCash(1_234_567_890_000)).toBe('1.235T');
  });

  it('rolls into alpha suffixes past Dc (1e36)', () => {
    expect(formatCash(1e36)).toContain('aa');
    expect(formatCash(1e39)).toContain('ab');
  });

  it('handles negative values', () => {
    expect(formatCash(-2_500)).toBe('-2.500K');
  });
});
