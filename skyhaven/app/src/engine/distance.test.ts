import { describe, expect, it } from 'vitest';
import { haversineKm } from './distance';

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(40, -74, 40, -74)).toBeCloseTo(0, 6);
  });

  it('matches the known LAX → JFK distance (~3,983 km)', () => {
    const d = haversineKm(33.9425, -118.4081, 40.6413, -73.7781);
    expect(d).toBeGreaterThan(3950);
    expect(d).toBeLessThan(4020);
  });

  it('is symmetric', () => {
    const a = haversineKm(51.47, -0.45, 35.55, 139.78);
    const b = haversineKm(35.55, 139.78, 51.47, -0.45);
    expect(a).toBeCloseTo(b, 9);
  });
});
