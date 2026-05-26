/**
 * Roaming collectibles layer (BRD §4.12).
 *
 * Tap-target sprites drifting on top of the world. Each collectible
 * carries a per-id velocity (hashed from its id for stability across
 * reloads) and a pulse animation. The icons are baked once per reward
 * kind into a high-resolution texture so the GPU samples them cleanly
 * at any zoom and the visual stays sharp.
 */
import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { lonLatToWorld, WORLD_WIDTH } from './projection';
import type { Collectible } from '../engine/types';

const PULSE_PERIOD_MS = 1500;
/** Visible world-units size of a collectible at neutral pulse. */
const SPRITE_WORLD_SIZE = 64;
/** Max drift from the spawn anchor (world units). */
const DRIFT_RADIUS = 90;
// Mirror each collectible into the ±WORLD_WIDTH wraparound tiles so
// they remain visible across the dateline.
const TILE_OFFSETS = [-WORLD_WIDTH, 0, WORLD_WIDTH] as const;

interface Entry {
  id: string;
  sprites: Sprite[];
  reward: Collectible['reward'];
  anchorX: number;
  anchorY: number;
  /** Per-second drift velocity, world units. */
  vx: number;
  vy: number;
  /** Current drift offset from anchor. */
  dx: number;
  dy: number;
  /** Phase offset (radians) for the pulse — keyed off id so different
   *  collectibles pulse out of sync, which reads more alive. */
  pulsePhase: number;
}

export class CollectiblesLayer {
  readonly container = new Container();
  private entries = new Map<string, Entry>();
  private textures: { cash: Texture; fuel: Texture };
  private onTap: (id: string, reward: Collectible['reward']) => void;
  private now = 0;

  constructor(renderer: Renderer, onTap: (id: string, reward: Collectible['reward']) => void) {
    this.container.label = 'collectibles';
    this.container.eventMode = 'passive';
    this.textures = {
      cash: makeIcon(renderer, 'cash'),
      fuel: makeIcon(renderer, 'fuel'),
    };
    this.onTap = onTap;
  }

  setCollectibles(items: readonly Collectible[]): void {
    const seen = new Set<string>();
    for (const c of items) {
      seen.add(c.id);
      if (this.entries.has(c.id)) continue;

      const tex = c.reward.kind === 'cash' ? this.textures.cash : this.textures.fuel;
      const { x, y } = lonLatToWorld(c.lon, c.lat);
      const sprites: Sprite[] = [];
      for (const off of TILE_OFFSETS) {
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.width = SPRITE_WORLD_SIZE;
        sprite.height = SPRITE_WORLD_SIZE;
        sprite.position.set(x + off, y);
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';
        sprite.hitArea = {
          contains: (px: number, py: number): boolean => px * px + py * py <= 36 * 36,
        };
        sprite.on('pointertap', () => this.onTap(c.id, c.reward));
        this.container.addChild(sprite);
        sprites.push(sprite);
      }

      const h = hashString(c.id);
      const angle = (h % 360) * (Math.PI / 180);
      const speed = 14 + ((h >> 9) % 11); // 14–24 world-units / sec
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed * 0.55; // gentler vertical drift

      this.entries.set(c.id, {
        id: c.id, sprites, reward: c.reward,
        anchorX: x, anchorY: y,
        vx, vy, dx: 0, dy: 0,
        pulsePhase: (h % 1000) / 1000 * Math.PI * 2,
      });
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue;
      for (const s of entry.sprites) s.destroy();
      this.entries.delete(id);
    }
  }

  tick(dtMs: number): void {
    this.now += dtMs;
    const dt = dtMs / 1000;
    for (const e of this.entries.values()) {
      // Drift with soft bounce at the radius boundary so collectibles
      // stay near the spawn point and don't wander across the map.
      e.dx += e.vx * dt;
      e.dy += e.vy * dt;
      if (Math.hypot(e.dx, e.dy) > DRIFT_RADIUS) {
        // Reflect velocity along the radial normal so it heads back in.
        const len = Math.hypot(e.dx, e.dy) || 1;
        const nx = e.dx / len;
        const ny = e.dy / len;
        const dot = e.vx * nx + e.vy * ny;
        e.vx -= 2 * dot * nx;
        e.vy -= 2 * dot * ny;
      }
      const phase = (this.now / PULSE_PERIOD_MS) * Math.PI * 2 + e.pulsePhase;
      const pulse = 1 + Math.sin(phase) * 0.12;
      const rotation = Math.sin(phase * 0.3) * 0.06;
      for (let i = 0; i < e.sprites.length; i++) {
        const off = TILE_OFFSETS[i]!;
        const s = e.sprites[i]!;
        s.position.set(e.anchorX + e.dx + off, e.anchorY + e.dy);
        s.scale.set(pulse * (SPRITE_WORLD_SIZE / s.texture.width));
        s.rotation = rotation;
      }
    }
  }

  destroy(): void {
    for (const e of this.entries.values()) for (const s of e.sprites) s.destroy();
    this.entries.clear();
    this.textures.cash.destroy(true);
    this.textures.fuel.destroy(true);
    this.container.destroy({ children: true });
  }
}

/**
 * Build a richly-layered icon for a reward kind. The texture is sized
 * generously and rendered at 4× resolution; the sprite gets scaled
 * down at display time so the GPU has plenty of pixels to sample from
 * at any zoom.
 */
function makeIcon(renderer: Renderer, kind: 'cash' | 'fuel'): Texture {
  const size = 96;          // world-units canvas (4× resolution → 384 backing px)
  const cx = size / 2;
  const cy = size / 2;
  const core = kind === 'cash' ? 0xF4C75B : 0x5AC8FA;
  const accent = kind === 'cash' ? 0xFCE9A5 : 0xC4ECFF;
  const deep = kind === 'cash' ? 0xA86B1A : 0x1E5A82;
  const g = new Graphics();

  // Outer glow rings (alpha falloff).
  g.circle(cx, cy, 44).fill({ color: accent, alpha: 0.06 });
  g.circle(cx, cy, 36).fill({ color: accent, alpha: 0.10 });
  g.circle(cx, cy, 28).fill({ color: accent, alpha: 0.18 });

  // Coin body with rim shadow.
  g.circle(cx, cy, 22).fill({ color: deep, alpha: 0.9 });
  g.circle(cx, cy, 20).fill({ color: core, alpha: 1.0 });
  g.circle(cx, cy, 17).fill({ color: accent, alpha: 0.95 });
  g.circle(cx, cy, 14).fill({ color: core, alpha: 1.0 });

  // Inner glyph — abstract "$" for cash, droplet for fuel.
  if (kind === 'cash') {
    // Stylised "$": a vertical bar plus two horizontal accents.
    g.rect(cx - 1.5, cy - 9, 3, 18).fill({ color: 0xffffff, alpha: 0.95 });
    g.rect(cx - 7, cy - 4, 14, 2.4).fill({ color: 0xffffff, alpha: 0.9 });
    g.rect(cx - 7, cy + 1.5, 14, 2.4).fill({ color: 0xffffff, alpha: 0.9 });
  } else {
    // Droplet: a circle with a tapered triangle on top.
    g.circle(cx, cy + 2, 6).fill({ color: 0xffffff, alpha: 0.95 });
    g.moveTo(cx, cy - 10).lineTo(cx - 5, cy + 1).lineTo(cx + 5, cy + 1).closePath()
      .fill({ color: 0xffffff, alpha: 0.95 });
  }

  // Specular highlight.
  g.circle(cx - 6, cy - 6, 3.5).fill({ color: 0xffffff, alpha: 0.5 });

  const t = renderer.generateTexture({
    target: g,
    resolution: 4,
    antialias: true,
  });
  g.destroy();
  return t;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
