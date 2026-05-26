import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { WORLD_HEIGHT, WORLD_WIDTH } from './projection';

/**
 * Stylised night-Earth basemap placeholder (BRD §9.1).
 *
 * Phase 10 wraps the Phase-1 grid placeholder with two additional
 * layers to bring it closer to the BRD's "Night Flight" identity
 * without waiting for the proper basemap textures:
 *  - a soft equatorial glow vignette (was Phase 1)
 *  - a faint twinkling star/city-light field for visual density
 *  - a moving day/night terminator drawn as a wide gradient band
 *    that tracks real wall-clock time (subtle, decorative)
 *
 * Real land/ocean shapes and proper city-light textures arrive when
 * the owner supplies the basemap asset set.
 */
export function createBasemap(): Container {
  const root = new Container();
  root.label = 'basemap';

  const bg = new Graphics();
  bg.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill(0x0b1120);
  root.addChild(bg);

  // Lat/lon graticule.
  const grid = new Graphics();
  const minor = 0x1f2a44;
  for (let lon = 0; lon <= WORLD_WIDTH; lon += WORLD_WIDTH / 12) {
    grid.moveTo(lon, 0).lineTo(lon, WORLD_HEIGHT);
  }
  for (let lat = 0; lat <= WORLD_HEIGHT; lat += WORLD_HEIGHT / 6) {
    grid.moveTo(0, lat).lineTo(WORLD_WIDTH, lat);
  }
  grid.stroke({ color: minor, width: 1, alpha: 0.6 });
  const major = new Graphics();
  major
    .moveTo(0, WORLD_HEIGHT / 2)
    .lineTo(WORLD_WIDTH, WORLD_HEIGHT / 2)
    .moveTo(WORLD_WIDTH / 2, 0)
    .lineTo(WORLD_WIDTH / 2, WORLD_HEIGHT)
    .stroke({ color: 0x2d3a5c, width: 1.5, alpha: 0.7 });

  root.addChild(grid);
  root.addChild(major);

  // Equatorial glow vignette.
  const vignette = new Sprite(Texture.WHITE);
  vignette.width = WORLD_WIDTH;
  vignette.height = WORLD_HEIGHT * 0.4;
  vignette.tint = 0x141d36;
  vignette.alpha = 0.35;
  vignette.x = 0;
  vignette.y = WORLD_HEIGHT * 0.3;
  root.addChild(vignette);

  // Twinkling city-light field — random dim points so the night side
  // of the map doesn't read as totally empty between airport pins.
  root.addChild(createStarField(2200, 0xC4ECFF, 0.45));

  // Day/night terminator: a wide, soft vertical band tinted slightly
  // brighter to suggest the day-side. The band slides east-to-west
  // (relative to the world) over a 24-real-hour cycle, anchored to
  // the actual wall clock so the effect feels grounded.
  root.addChild(createTerminator());

  return root;
}

/** A static deterministic star/city field. */
function createStarField(count: number, color: number, maxAlpha: number): Container {
  const layer = new Container();
  layer.label = 'star-field';
  const g = new Graphics();
  // Cheap LCG so the dots are stable across reloads.
  let seed = 0xC0FFEE;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };
  for (let i = 0; i < count; i++) {
    const x = rand() * WORLD_WIDTH;
    const y = rand() * WORLD_HEIGHT;
    const r = 0.5 + rand() * 1.6;
    const a = (0.2 + rand() * 0.8) * maxAlpha;
    g.circle(x, y, r).fill({ color, alpha: a });
  }
  layer.addChild(g);
  return layer;
}

/**
 * Day/night terminator band. Real wall-clock time decides where the
 * day-side glow sits on the world; the band itself is a gradient drawn
 * as a series of overlapping sprites with falling alpha at the edges.
 */
function createTerminator(): Container {
  const layer = new Container();
  layer.label = 'terminator';
  layer.alpha = 0.30;

  // World x of "noon" — the centre of the day-side glow. Computed once
  // at creation. A 24-hour rotation would be nice in Phase 10 polish;
  // for now we just anchor to the time the player launched, which is
  // good enough for the visual character.
  const utcNoonLon = -((new Date().getUTCHours() * 60 + new Date().getUTCMinutes()) / (24 * 60) - 0.5) * 360;
  const noonX = ((utcNoonLon + 180) / 360) * WORLD_WIDTH;

  // Three layered bands of decreasing width / increasing alpha so the
  // edges fall off smoothly. Each is just a tinted Texture.WHITE sprite.
  const widths = [WORLD_WIDTH * 0.50, WORLD_WIDTH * 0.32, WORLD_WIDTH * 0.18];
  const alphas = [0.20, 0.32, 0.55];
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i]!;
    const sprite = new Sprite(Texture.WHITE);
    sprite.tint = 0x2a3a7a;
    sprite.alpha = alphas[i]!;
    sprite.width = w;
    sprite.height = WORLD_HEIGHT;
    sprite.x = noonX - w / 2;
    sprite.y = 0;
    layer.addChild(sprite);

    // Wrap-around copies so the band still shows when noonX is near
    // the edge of the world.
    if (sprite.x < 0) {
      const wrap = new Sprite(Texture.WHITE);
      wrap.tint = sprite.tint;
      wrap.alpha = sprite.alpha;
      wrap.width = w;
      wrap.height = WORLD_HEIGHT;
      wrap.x = sprite.x + WORLD_WIDTH;
      wrap.y = 0;
      layer.addChild(wrap);
    } else if (sprite.x + w > WORLD_WIDTH) {
      const wrap = new Sprite(Texture.WHITE);
      wrap.tint = sprite.tint;
      wrap.alpha = sprite.alpha;
      wrap.width = w;
      wrap.height = WORLD_HEIGHT;
      wrap.x = sprite.x - WORLD_WIDTH;
      wrap.y = 0;
      layer.addChild(wrap);
    }
  }

  return layer;
}
