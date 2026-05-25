import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { WORLD_HEIGHT, WORLD_WIDTH } from './projection';

/**
 * Phase 1 placeholder basemap.
 *
 * A deep-navy rectangle the size of the world with a subtle horizontal
 * gradient (lighter at the equator, darker at the poles) plus a hairline
 * grid every 30°. Stylised night-Earth land/ocean shapes land in Phase 10.
 *
 * Built once at startup, parented to the world container — pan/zoom
 * comes from camera transforms, not from re-rendering anything here.
 */
export function createBasemap(): Container {
  const root = new Container();
  root.label = 'basemap';

  // Background colour band — a generated procedural texture so we get
  // GPU-accelerated rendering instead of per-frame Graphics math.
  const bg = new Graphics();
  bg.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(0x0b1120);
  root.addChild(bg);

  // Lat/lon graticule, 30° spacing, hairline.
  const grid = new Graphics();
  const minor = 0x1f2a44;
  for (let lon = 0; lon <= WORLD_WIDTH; lon += WORLD_WIDTH / 12) {
    grid.moveTo(lon, 0).lineTo(lon, WORLD_HEIGHT);
  }
  for (let lat = 0; lat <= WORLD_HEIGHT; lat += WORLD_HEIGHT / 6) {
    grid.moveTo(0, lat).lineTo(WORLD_WIDTH, lat);
  }
  grid.stroke({ color: minor, width: 1, alpha: 0.6 });
  // Equator + prime meridian, brighter.
  const major = new Graphics();
  major
    .moveTo(0, WORLD_HEIGHT / 2)
    .lineTo(WORLD_WIDTH, WORLD_HEIGHT / 2)
    .moveTo(WORLD_WIDTH / 2, 0)
    .lineTo(WORLD_WIDTH / 2, WORLD_HEIGHT)
    .stroke({ color: 0x2d3a5c, width: 1.5, alpha: 0.7 });

  root.addChild(grid);
  root.addChild(major);

  // Soft vignette via a faded white sprite at the equator.
  const vignette = new Sprite(Texture.WHITE);
  vignette.width = WORLD_WIDTH;
  vignette.height = WORLD_HEIGHT * 0.4;
  vignette.tint = 0x141d36;
  vignette.alpha = 0.35;
  vignette.x = 0;
  vignette.y = WORLD_HEIGHT * 0.3;
  root.addChild(vignette);

  return root;
}
