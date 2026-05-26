import { Container, Graphics } from 'pixi.js';
import type { Airport } from '../data/airports';
import { lonLatToWorld } from './projection';

/**
 * Render airport pins (BRD §9.1).
 *
 * Pins are built into chunked `Graphics` objects (256 pins per chunk
 * — Pixi 8 silently drops draw calls past per-batch limits at the
 * ~1,100-pin scale otherwise). The completed pin container is then
 * cached to a texture (`cacheAsTexture`) so per-frame cost drops to a
 * single textured quad rather than 70k tessellated triangles.
 *
 * Build is split into a deferred-build path so the basemap can paint
 * before pin tessellation runs — first map paint goes from seconds to
 * milliseconds on slower devices.
 */
const PIN_PALETTE: Record<number, { fill: number; glow: number; radius: number; alpha: number }> = {
  4: { fill: 0x5ac8fa, glow: 0x5ac8fa, radius: 3.0, alpha: 1.0 },
  3: { fill: 0x8ec5ff, glow: 0x5ac8fa, radius: 2.4, alpha: 0.95 },
  2: { fill: 0xf4c75b, glow: 0xf4c75b, radius: 1.6, alpha: 0.85 },
  1: { fill: 0xb6d4ff, glow: 0x5ac8fa, radius: 1.2, alpha: 0.7 },
};

const CHUNK_SIZE = 256;

/** Build the pin Graphics chunks synchronously. */
export function createAirportPins(airports: readonly Airport[]): Container {
  const root = new Container();
  root.label = 'airport-pins';
  buildPinsInto(root, airports);
  return root;
}

/**
 * Build the pin chunks across multiple `requestAnimationFrame` callbacks
 * so the rest of the world layer (basemap, clouds) can paint immediately.
 * Resolves once every pin chunk has been attached and the container has
 * been baked to a cached texture.
 */
export function createAirportPinsDeferred(airports: readonly Airport[]): {
  root: Container;
  ready: Promise<void>;
} {
  const root = new Container();
  root.label = 'airport-pins';

  const ready = new Promise<void>((resolve) => {
    let idx = 0;
    const step = (): void => {
      if (idx >= airports.length) {
        bakeAndCache(root);
        resolve();
        return;
      }
      const end = Math.min(airports.length, idx + CHUNK_SIZE);
      buildOneChunk(root, airports, idx, end);
      idx = end;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  return { root, ready };
}

function buildPinsInto(root: Container, airports: readonly Airport[]): void {
  for (let start = 0; start < airports.length; start += CHUNK_SIZE) {
    const end = Math.min(airports.length, start + CHUNK_SIZE);
    buildOneChunk(root, airports, start, end);
  }
  bakeAndCache(root);
}

function buildOneChunk(root: Container, airports: readonly Airport[], start: number, end: number): void {
  const halos = new Graphics();
  const cores = new Graphics();
  for (let i = start; i < end; i++) {
    const a = airports[i]!;
    const { x, y } = lonLatToWorld(a.lon, a.lat);
    const style = PIN_PALETTE[a.sizeTier] ?? PIN_PALETTE[1]!;
    halos.circle(x, y, style.radius * 2.5).fill({ color: style.glow, alpha: style.alpha * 0.18 });
    cores.circle(x, y, style.radius).fill({ color: style.fill, alpha: style.alpha });
  }
  root.addChild(halos);
  root.addChild(cores);
}

function bakeAndCache(root: Container): void {
  // Cache the assembled pin container to a render texture. Per-frame
  // cost drops from "tessellate 70k triangles" to "draw one textured
  // quad". The texture is sized to the container's local bounds at
  // half resolution — pins are small enough that subpixel blur is
  // imperceptible at fitting zoom.
  try {
    root.cacheAsTexture({ resolution: 0.5, antialias: true });
  } catch {
    // Older Pixi versions or unusual renderer states may not support
    // cacheAsTexture; falling through to direct render is a perf hit
    // but visually identical.
  }
}
