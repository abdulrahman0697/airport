import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import type { Airport } from '../data/airports';
import { lonLatToWorld } from './projection';

/**
 * Render airport pins as sprites against a per-tier baked texture.
 *
 * Why sprites and not Graphics: the Graphics path tessellated ~70k
 * triangles for 1,100 pin pairs on first draw — slow first-paint on
 * mid-range Android, and caching the whole layer to a single texture
 * (the previous defensive fix) made pins blurry on zoom-in.
 *
 * Sprites with a shared texture batch into one draw call per texture
 * and stay sharp at any zoom because the GPU samples the high-res
 * source texture with bilinear filtering rather than magnifying a
 * pre-rasterised quad.
 */
const PIN_PALETTE: Record<number, { fill: number; glow: number; radius: number; alpha: number }> = {
  4: { fill: 0x5ac8fa, glow: 0x5ac8fa, radius: 3.0, alpha: 1.0 },
  3: { fill: 0x8ec5ff, glow: 0x5ac8fa, radius: 2.4, alpha: 0.95 },
  2: { fill: 0xf4c75b, glow: 0xf4c75b, radius: 1.6, alpha: 0.85 },
  1: { fill: 0xb6d4ff, glow: 0x5ac8fa, radius: 1.2, alpha: 0.7 },
};

/** Pad the texture canvas so the halo's edge isn't clipped by sampling. */
const TEX_PADDING = 1;

/** Generate a small texture for one size-tier (halo + core).  */
function makeTierTexture(renderer: Renderer, tier: number): { texture: Texture; worldSize: number } {
  const style = PIN_PALETTE[tier] ?? PIN_PALETTE[1]!;
  const haloR = style.radius * 2.5;
  const worldSize = (haloR + TEX_PADDING) * 2;
  const center = worldSize / 2;
  const g = new Graphics();
  g.circle(center, center, haloR).fill({ color: style.glow, alpha: style.alpha * 0.18 });
  g.circle(center, center, style.radius).fill({ color: style.fill, alpha: style.alpha });
  // resolution 4× the world-space size keeps the source texture sharp
  // at the highest reachable camera zoom (camera caps maxScale at 6×).
  const texture = renderer.generateTexture({
    target: g,
    resolution: 4,
    antialias: true,
  });
  g.destroy();
  return { texture, worldSize };
}

export function createAirportPins(
  airports: readonly Airport[],
  renderer: Renderer,
): Container {
  const root = new Container();
  root.label = 'airport-pins';

  const tiers = new Map<number, { texture: Texture; worldSize: number }>();
  for (const tier of [1, 2, 3, 4]) {
    tiers.set(tier, makeTierTexture(renderer, tier));
  }

  for (const a of airports) {
    const t = tiers.get(a.sizeTier) ?? tiers.get(1)!;
    const sprite = new Sprite(t.texture);
    sprite.anchor.set(0.5);
    sprite.width = t.worldSize;
    sprite.height = t.worldSize;
    const { x, y } = lonLatToWorld(a.lon, a.lat);
    sprite.position.set(x, y);
    root.addChild(sprite);
  }

  return root;
}

/**
 * Build pins across multiple animation frames so the basemap + arcs
 * can paint immediately. Resolves once every pin is attached.
 */
export function createAirportPinsDeferred(
  airports: readonly Airport[],
  renderer: Renderer,
): { root: Container; ready: Promise<void> } {
  const root = new Container();
  root.label = 'airport-pins';

  const tiers = new Map<number, { texture: Texture; worldSize: number }>();
  for (const tier of [1, 2, 3, 4]) {
    tiers.set(tier, makeTierTexture(renderer, tier));
  }

  const CHUNK = 256;
  const ready = new Promise<void>((resolve) => {
    let idx = 0;
    const step = (): void => {
      if (idx >= airports.length) {
        resolve();
        return;
      }
      const end = Math.min(airports.length, idx + CHUNK);
      for (let i = idx; i < end; i++) {
        const a = airports[i]!;
        const t = tiers.get(a.sizeTier) ?? tiers.get(1)!;
        const sprite = new Sprite(t.texture);
        sprite.anchor.set(0.5);
        sprite.width = t.worldSize;
        sprite.height = t.worldSize;
        const { x, y } = lonLatToWorld(a.lon, a.lat);
        sprite.position.set(x, y);
        root.addChild(sprite);
      }
      idx = end;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  return { root, ready };
}
