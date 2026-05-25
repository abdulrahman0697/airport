/**
 * World projection.
 *
 * The Pixi world is rendered in a fixed virtual coordinate space sized
 * to a 2:1 equirectangular plate carrée projection. Lon -180..180 maps
 * to x 0..WORLD_WIDTH; lat 90..-90 maps to y 0..WORLD_HEIGHT.
 *
 * Equirectangular is the right call for Phase 1: zero distortion math,
 * matches the BRD's stylised night-Earth aesthetic (BRD §9.1), and trivial
 * to mip-map. The camera handles pan/zoom in screen space (Camera.ts).
 */

export const WORLD_WIDTH = 4096;
export const WORLD_HEIGHT = 2048;

export interface XY {
  readonly x: number;
  readonly y: number;
}

export function lonLatToWorld(lon: number, lat: number): XY {
  const x = ((lon + 180) / 360) * WORLD_WIDTH;
  const y = ((90 - lat) / 180) * WORLD_HEIGHT;
  return { x, y };
}

export function worldToLonLat(x: number, y: number): { lon: number; lat: number } {
  const lon = (x / WORLD_WIDTH) * 360 - 180;
  const lat = 90 - (y / WORLD_HEIGHT) * 180;
  return { lon, lat };
}
