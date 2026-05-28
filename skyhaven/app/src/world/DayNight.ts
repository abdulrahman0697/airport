/**
 * Day/Night terminator (Design pass D4).
 *
 * A subtle radial gradient that tracks the sun's position across the
 * world. Painted as a half-disc with a soft penumbra so it reads as
 * "sunlit side" without obscuring map content.
 *
 * The sun longitude maps from the device's wall clock — sun is at
 * solar noon (longitude 0) when UTC time is 12:00; rotates 15° west
 * per hour. We render a ~50% alpha warm wash on the day side and
 * leave the night side untouched so the existing star field + aurora
 * continue to feel "lights on".
 *
 * Wall clock read at construction time + once per minute is plenty
 * — the sun moves ~0.25° per minute.
 */
import { Container, Graphics } from 'pixi.js';
import { WORLD_HEIGHT, WORLD_WIDTH } from './projection';

const UPDATE_INTERVAL_MS = 60_000;
const TILE_OFFSETS = [-WORLD_WIDTH, 0, WORLD_WIDTH] as const;

export interface DayNightLayer {
  container: Container;
  tick(dtMs: number): void;
  destroy(): void;
}

/**
 * Sun longitude (-180..180) for a given UTC ms. UTC 12:00 → 0°,
 * UTC 18:00 → -90° (sun west), UTC 06:00 → +90° (sun east).
 */
function sunLongitudeAtUtc(utcMs: number): number {
  const d = new Date(utcMs);
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  // 12:00 UTC = 0°; each hour shifts -15° (sun moves west over time).
  let lon = (12 - hour) * 15;
  // Normalise to (-180, 180].
  while (lon <= -180) lon += 360;
  while (lon > 180) lon -= 360;
  return lon;
}

function lonToWorldX(lon: number): number {
  return ((lon + 180) / 360) * WORLD_WIDTH;
}

export function createDayNight(): DayNightLayer {
  const root = new Container();
  root.label = 'day-night';
  root.eventMode = 'none';

  const day = new Graphics();
  root.addChild(day);

  let acc = 0;
  let lastSunLon = NaN;

  function repaint(): void {
    const lon = sunLongitudeAtUtc(Date.now());
    if (lon === lastSunLon) return;
    lastSunLon = lon;
    const sunX = lonToWorldX(lon);
    // Day side is roughly ±90° from sun-X; we paint a wide ellipse
    // with a soft inner glow.
    const halfWidthWorld = WORLD_WIDTH * 0.30;
    day.clear();
    for (const off of TILE_OFFSETS) {
      // Outer warm wash (sunset orange at edges).
      day
        .ellipse(sunX + off, WORLD_HEIGHT / 2, halfWidthWorld, WORLD_HEIGHT * 0.65)
        .fill({ color: 0xFFB36B, alpha: 0.04 });
      // Inner brighter band (mid-day blue-white).
      day
        .ellipse(sunX + off, WORLD_HEIGHT / 2, halfWidthWorld * 0.55, WORLD_HEIGHT * 0.5)
        .fill({ color: 0xFFE4A8, alpha: 0.05 });
      // Hot core (high-noon shimmer).
      day
        .circle(sunX + off, WORLD_HEIGHT / 2, 80)
        .fill({ color: 0xFFFFFF, alpha: 0.04 });
    }
  }

  repaint();

  return {
    container: root,
    tick(dtMs): void {
      acc += dtMs;
      if (acc >= UPDATE_INTERVAL_MS) {
        acc = 0;
        repaint();
      }
    },
    destroy(): void {
      day.destroy();
      root.destroy({ children: true });
    },
  };
}
