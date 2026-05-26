import { Container, Graphics } from 'pixi.js';
import { WORLD_HEIGHT, WORLD_WIDTH } from './projection';

/**
 * Stylised night-Earth basemap placeholder (BRD §9.1).
 *
 * Phase 10 strips the Phase-1 graticule (per owner feedback — the
 * diagonals/grid felt wrong on the world) and ships a faint twinkling
 * city-light field instead. Country outlines and proper land/ocean
 * shading live in a sibling Countries layer (see `Countries.ts`), so
 * this file only handles the night-sky backdrop + ambient stars.
 *
 * The day/night terminator is intentionally absent from Phase 10 — it
 * was reading as visual noise rather than character. Comes back in
 * Phase 10.5 with the proper basemap textures.
 */
export function createBasemap(): Container {
  const root = new Container();
  root.label = 'basemap';

  // Tile the background across ±WORLD_WIDTH so horizontal pan never
  // shows the void behind the world. Phase 10 polish: BRD §9.1 infinite
  // horizontal loop.
  const bg = new Graphics();
  bg.rect(-WORLD_WIDTH, 0, WORLD_WIDTH * 3, WORLD_HEIGHT).fill(0x0b1120);
  root.addChild(bg);

  // Twinkling city-light field — random dim points across the canvas.
  root.addChild(createStarField(1800, 0xC4ECFF, 0.40));

  return root;
}

/** A static deterministic star/city field, tiled across ±WORLD_WIDTH. */
function createStarField(count: number, color: number, maxAlpha: number): Container {
  const layer = new Container();
  layer.label = 'star-field';
  const g = new Graphics();
  let seed = 0xC0FFEE;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };
  for (let i = 0; i < count; i++) {
    const x = rand() * WORLD_WIDTH;
    const y = rand() * WORLD_HEIGHT;
    const r = 0.4 + rand() * 1.2;
    const a = (0.2 + rand() * 0.8) * maxAlpha;
    for (const off of [-WORLD_WIDTH, 0, WORLD_WIDTH]) {
      g.circle(x + off, y, r).fill({ color, alpha: a });
    }
  }
  layer.addChild(g);
  return layer;
}
