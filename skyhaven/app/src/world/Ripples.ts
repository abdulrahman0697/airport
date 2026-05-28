/**
 * Tap-water ripple layer (Design pass D4).
 *
 * Spawns a quick expanding ring at the requested world coordinate.
 * Each ripple lives ~700 ms — two concentric circles that grow + fade.
 * Idle ripples are cheap; the layer GCs them automatically.
 *
 * WorldStage routes pointer-up taps that aren't on a pin / arc /
 * collectible to `spawn(worldX, worldY)`.
 */
import { Container, Graphics } from 'pixi.js';
import { WORLD_WIDTH } from './projection';

const TILE_OFFSETS = [-WORLD_WIDTH, 0, WORLD_WIDTH] as const;
const RIPPLE_LIFE_MS = 700;
const RIPPLE_MAX_RADIUS = 48;
const MAX_LIVE = 8;

interface Ripple {
  x: number;
  y: number;
  bornMs: number;
}

export interface RipplesLayer {
  container: Container;
  spawn(worldX: number, worldY: number): void;
  tick(dtMs: number): void;
  destroy(): void;
}

export function createRipples(color = 0x5ac8fa): RipplesLayer {
  const root = new Container();
  root.label = 'ripples';
  root.eventMode = 'none';
  const g = new Graphics();
  root.addChild(g);

  const live: Ripple[] = [];
  let nowMs = 0;
  let tint = color;

  function paint(): void {
    g.clear();
    for (const r of live) {
      const t = (nowMs - r.bornMs) / RIPPLE_LIFE_MS;
      if (t < 0 || t > 1) continue;
      const radius = t * RIPPLE_MAX_RADIUS;
      const alpha = (1 - t) * 0.6;
      for (const off of TILE_OFFSETS) {
        g.circle(r.x + off, r.y, radius).stroke({
          color: tint,
          alpha,
          width: 1.6,
        });
        g.circle(r.x + off, r.y, radius * 0.55).stroke({
          color: tint,
          alpha: alpha * 0.7,
          width: 1,
        });
      }
    }
  }

  function gc(): void {
    for (let i = live.length - 1; i >= 0; i--) {
      if (nowMs - live[i]!.bornMs > RIPPLE_LIFE_MS) live.splice(i, 1);
    }
  }

  return {
    container: root,
    spawn(worldX, worldY): void {
      if (live.length >= MAX_LIVE) live.shift();
      live.push({ x: worldX, y: worldY, bornMs: nowMs });
    },
    tick(dtMs): void {
      nowMs += dtMs;
      gc();
      paint();
    },
    destroy(): void {
      g.destroy();
      root.destroy({ children: true });
    },
  };
}
