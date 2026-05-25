import { describe, expect, it } from 'vitest';
import { WORLD_HEIGHT, WORLD_WIDTH, lonLatToWorld, worldToLonLat } from './projection';

describe('projection', () => {
  it('maps the prime meridian / equator to the world centre', () => {
    expect(lonLatToWorld(0, 0)).toEqual({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 });
  });

  it('maps the corners correctly', () => {
    expect(lonLatToWorld(-180, 90)).toEqual({ x: 0, y: 0 });
    expect(lonLatToWorld(180, -90)).toEqual({ x: WORLD_WIDTH, y: WORLD_HEIGHT });
  });

  it('is invertible', () => {
    for (const [lon, lat] of [[0, 0], [-122.4, 37.8], [139.6, 35.7], [-73.9, 40.7]] as const) {
      const w = lonLatToWorld(lon, lat);
      const back = worldToLonLat(w.x, w.y);
      expect(back.lon).toBeCloseTo(lon, 6);
      expect(back.lat).toBeCloseTo(lat, 6);
    }
  });
});
