import { Container, Graphics } from 'pixi.js';
import type { Airport } from '../data/airports';
import { lonLatToWorld } from './projection';

/**
 * Render airport pins as a single batched Graphics object.
 *
 * Phase 1 uses a flat Graphics object — at 500 pins this stays well under
 * one draw call and is GPU-trivial. When the full 3,000-airport set lands
 * we switch to a ParticleContainer with sprite-sheet glyphs for further
 * batching headroom.
 *
 * Pin styling encodes size tier (radius + glow intensity); tier 4 hubs
 * read as bright nodes on the dark map.
 */
const PIN_PALETTE: Record<number, { fill: number; glow: number; radius: number; alpha: number }> = {
  4: { fill: 0x5ac8fa, glow: 0x5ac8fa, radius: 3.0, alpha: 1.0 },
  3: { fill: 0x8ec5ff, glow: 0x5ac8fa, radius: 2.4, alpha: 0.95 },
  2: { fill: 0xf4c75b, glow: 0xf4c75b, radius: 1.6, alpha: 0.85 },
  1: { fill: 0xb6d4ff, glow: 0x5ac8fa, radius: 1.2, alpha: 0.7 },
};

export function createAirportPins(airports: readonly Airport[]): Container {
  const root = new Container();
  root.label = 'airport-pins';

  // Outer halo first so it sits under the core.
  const halos = new Graphics();
  const cores = new Graphics();

  for (const a of airports) {
    const { x, y } = lonLatToWorld(a.lon, a.lat);
    const style = PIN_PALETTE[a.sizeTier] ?? PIN_PALETTE[1]!;
    halos.circle(x, y, style.radius * 2.5).fill({ color: style.glow, alpha: style.alpha * 0.18 });
    cores.circle(x, y, style.radius).fill({ color: style.fill, alpha: style.alpha });
  }

  root.addChild(halos);
  root.addChild(cores);
  return root;
}
