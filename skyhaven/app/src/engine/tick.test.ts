import { describe, expect, it } from 'vitest';
import { TICK_HZ, TICK_MS } from './tick';

describe('tick constants', () => {
  it('runs at 10 Hz', () => {
    expect(TICK_HZ).toBe(10);
    expect(TICK_MS).toBe(100);
  });
});
