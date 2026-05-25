import { describe, expect, it } from 'vitest';
import { formatCash } from './format';

describe('formatCash', () => {
  it('shows raw integers under 1000', () => {
    expect(formatCash(0)).toBe('0');
    expect(formatCash(999)).toBe('999');
  });

  it('uses K/M/B/T suffixes', () => {
    expect(formatCash(1234)).toBe('1.23K');
    expect(formatCash(12_345)).toBe('12.3K');
    expect(formatCash(123_456)).toBe('123K');
    expect(formatCash(1_234_567)).toBe('1.23M');
    expect(formatCash(1_234_567_890_000)).toBe('1.23T');
  });

  it('rolls into alpha suffixes past Dc (1e36)', () => {
    expect(formatCash(1e36)).toContain('aa');
    expect(formatCash(1e39)).toContain('ab');
  });

  it('handles negative values', () => {
    expect(formatCash(-2_500)).toBe('-2.50K');
  });
});
