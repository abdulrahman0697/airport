/**
 * Airport-pins layer (BRD §9.1, Phase 10 polish).
 *
 * Pins are interactive sprites — taps fire an `onTap(airport, screenXY)`
 * callback so the React layer can show an airport detail tooltip.
 *
 * Pin visuals respond to camera zoom:
 *  - **Counter-scaling**: each sprite's display scale is
 *    `baseScale / cameraScale`, clamped, so pins stay around a target
 *    on-screen pixel size at any zoom. Zooming in makes them smaller
 *    (relative to the map), zooming out makes them slightly larger.
 *  - **LOD culling**: at low zoom only every Nth pin is shown so the
 *    map isn't a blob of dots from orbit; full density returns when
 *    zoomed in.
 *
 * Pin colour reflects region-unlock state:
 *  - **Unlocked region** → tail-color tinted sprite
 *  - **Locked region**   → dim grey sprite so the player can still
 *                          see where the next region's airports are
 *                          without confusing them with current targets.
 */
import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import type { Airport } from '../data/airports';
import { lonLatToWorld } from './projection';

interface PinEntry {
  airport: Airport;
  sprite: Sprite;
  /** "Major" pin shown at every zoom level. Smaller pins LOD-cull. */
  major: boolean;
  baseScale: number;
}

export interface AirportPinsLayer {
  container: Container;
  setUnlockedRegions(regions: ReadonlySet<number>, tailColor: number): void;
  /** Per-frame: counter-scale + LOD-cull based on camera scale. */
  tick(cameraScale: number): void;
  destroy(): void;
}

const TEX_SIZE = 96;
const TARGET_SCREEN_PX = 14;
/** Pin sprite world size that yields TARGET_SCREEN_PX when counter-scaled. */
const SPRITE_WORLD_SIZE = 64;
const SCALE_CLAMP_MIN = 0.18;
const SCALE_CLAMP_MAX = 2.4;
/** Below this camera scale every N-th pin is hidden (LOD). */
const LOD_LOW_ZOOM_SCALE = 1.0;
/** Below this even more aggressive cull. */
const LOD_FAR_ZOOM_SCALE = 0.55;

export function createAirportPins(
  airports: readonly Airport[],
  renderer: Renderer,
  initialUnlocked: ReadonlySet<number>,
  initialTailColor: number,
  onTap: (airport: Airport, screen: { x: number; y: number }) => void,
): AirportPinsLayer {
  const container = new Container();
  container.label = 'airport-pins';

  // Two textures: one tail-colored (unlocked) and one dim grey (locked).
  let tailColor = initialTailColor;
  let unlockedTexture = makeTexture(renderer, tailColor, 1.0);
  let lockedTexture = makeTexture(renderer, 0x6B7691, 0.55);

  const entries: PinEntry[] = [];
  for (let aIdx = 0; aIdx < airports.length; aIdx++) {
    const a = airports[aIdx]!;
    const major = aIdx % 6 === 0;
    const initiallyUnlocked = initialUnlocked.has(a.region);
    const tex = initiallyUnlocked ? unlockedTexture : lockedTexture;
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const baseScale = SPRITE_WORLD_SIZE / TEX_SIZE;
    sprite.scale.set(baseScale);
    const { x, y } = lonLatToWorld(a.lon, a.lat);
    sprite.position.set(x, y);

    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    // Generous circular hit area so the pin is easy to tap on a phone.
    sprite.hitArea = {
      contains: (px: number, py: number): boolean => {
        return px * px + py * py <= (TEX_SIZE / 2) * (TEX_SIZE / 2);
      },
    };
    sprite.on('pointertap', (event) => {
      const g = event.global;
      onTap(a, { x: g.x, y: g.y });
    });

    container.addChild(sprite);
    entries.push({ airport: a, sprite, major, baseScale });
  }

  return {
    container,
    setUnlockedRegions(regions, nextTailColor): void {
      if (nextTailColor !== tailColor) {
        tailColor = nextTailColor;
        unlockedTexture.destroy(true);
        unlockedTexture = makeTexture(renderer, tailColor, 1.0);
      }
      for (const e of entries) {
        const isUnlocked = regions.has(e.airport.region);
        e.sprite.texture = isUnlocked ? unlockedTexture : lockedTexture;
      }
    },
    tick(cameraScale): void {
      // Counter-scale to keep pins at ~constant screen size.
      const inv = TARGET_SCREEN_PX / (SPRITE_WORLD_SIZE * cameraScale);
      const finalBaseRatio = SPRITE_WORLD_SIZE / TEX_SIZE; // 64/96
      const counter = Math.max(SCALE_CLAMP_MIN, Math.min(SCALE_CLAMP_MAX, inv * TEX_SIZE / SPRITE_WORLD_SIZE * finalBaseRatio));
      const lodFar = cameraScale < LOD_FAR_ZOOM_SCALE;
      const lodLow = cameraScale < LOD_LOW_ZOOM_SCALE;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]!;
        if (lodFar && !e.major && (i % 4 !== 0)) { e.sprite.visible = false; continue; }
        if (lodLow && !e.major && (i % 2 !== 0)) { e.sprite.visible = false; continue; }
        e.sprite.visible = true;
        e.sprite.scale.set(counter);
      }
    },
    destroy(): void {
      for (const e of entries) e.sprite.destroy();
      entries.length = 0;
      unlockedTexture.destroy(true);
      lockedTexture.destroy(true);
      container.destroy({ children: true });
    },
  };
}

function makeTexture(renderer: Renderer, core: number, opacity: number): Texture {
  const cx = TEX_SIZE / 2;
  const g = new Graphics();
  g.circle(cx, cx, 22).fill({ color: core, alpha: 0.10 * opacity });
  g.circle(cx, cx, 16).fill({ color: core, alpha: 0.20 * opacity });
  g.circle(cx, cx, 10).fill({ color: core, alpha: 0.70 * opacity });
  g.circle(cx, cx, 5.5).fill({ color: 0xffffff, alpha: 0.95 * opacity });
  const tex = renderer.generateTexture({ target: g, resolution: 3, antialias: true });
  g.destroy();
  return tex;
}
