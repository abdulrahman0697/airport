import { Container, Graphics } from 'pixi.js';
import { WORLD_HEIGHT, WORLD_WIDTH } from './projection';

/**
 * Parallax cloud layer placeholder (BRD §9.1).
 *
 * Phase 1: a handful of soft cloud puffs drifting east at half-camera
 * speed. Phase 10 swaps to a tileable cloud atlas with proper alpha
 * blending and wind-driven motion responding to live events.
 *
 * The container exposes `parallaxFactor` so the stage can offset it
 * relative to the camera transform.
 */
export interface CloudLayer {
  container: Container;
  /** 0 = locked to camera, 1 = static relative to world. */
  parallaxFactor: number;
  tick: (dtMs: number) => void;
}

export function createClouds(seed = 1337): CloudLayer {
  const container = new Container();
  container.label = 'clouds';
  container.alpha = 0.18;

  // Tiny xorshift PRNG so placement is deterministic across reloads.
  let s = seed >>> 0;
  const rand = (): number => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };

  const puffs: { g: Graphics; vx: number }[] = [];
  for (let i = 0; i < 60; i++) {
    const g = new Graphics();
    const cx = rand() * WORLD_WIDTH;
    const cy = rand() * WORLD_HEIGHT;
    const r = 28 + rand() * 80;
    for (let k = 0; k < 5; k++) {
      const ox = (rand() - 0.5) * r * 1.8;
      const oy = (rand() - 0.5) * r * 0.6;
      const rr = r * (0.5 + rand() * 0.5);
      g.circle(cx + ox, cy + oy, rr).fill({ color: 0xffffff, alpha: 0.05 + rand() * 0.06 });
    }
    container.addChild(g);
    puffs.push({ g, vx: 6 + rand() * 12 });
  }

  return {
    container,
    parallaxFactor: 0.55,
    tick(dtMs) {
      const dt = dtMs / 1000;
      for (const p of puffs) {
        p.g.x += p.vx * dt;
        if (p.g.x > WORLD_WIDTH * 0.6) p.g.x -= WORLD_WIDTH * 1.2;
      }
    },
  };
}
