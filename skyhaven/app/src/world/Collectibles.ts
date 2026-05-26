/**
 * Roaming collectibles layer (BRD §4.12).
 *
 * Tap-target sprites drifting on top of the world. The collectible's
 * world position is set by the engine when it spawns; we render a
 * pulsing icon and forward taps to the supplied callback. The render
 * is cheap — at most ~3 collectibles on screen at a time per the
 * tick's spawn budget.
 */
import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { lonLatToWorld } from './projection';
import type { Collectible } from '../engine/types';

const PULSE_PERIOD_MS = 1600;

interface Entry {
  id: string;
  sprite: Sprite;
  reward: Collectible['reward'];
  baseScale: number;
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
      cash: makeIcon(renderer, 0xF4C75B, 0xFCE9A5),
      fuel: makeIcon(renderer, 0x5AC8FA, 0xC4ECFF),
    };
    this.onTap = onTap;
  }

  setCollectibles(items: readonly Collectible[]): void {
    const seen = new Set<string>();
    for (const c of items) {
      seen.add(c.id);
      if (this.entries.has(c.id)) continue;
      const tex = c.reward.kind === 'cash' ? this.textures.cash : this.textures.fuel;
      const sprite = new Sprite(tex);
      const baseScale = 0.6;
      sprite.anchor.set(0.5);
      sprite.scale.set(baseScale);
      const { x, y } = lonLatToWorld(c.lon, c.lat);
      sprite.position.set(x, y);
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';
      sprite.on('pointertap', () => this.onTap(c.id, c.reward));
      this.container.addChild(sprite);
      this.entries.set(c.id, { id: c.id, sprite, reward: c.reward, baseScale });
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue;
      entry.sprite.destroy();
      this.entries.delete(id);
    }
  }

  tick(dtMs: number): void {
    this.now += dtMs;
    const phase = (this.now % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
    const pulse = 1 + Math.sin(phase * Math.PI * 2) * 0.18;
    for (const e of this.entries.values()) {
      e.sprite.scale.set(e.baseScale * pulse);
    }
  }

  destroy(): void {
    for (const e of this.entries.values()) e.sprite.destroy();
    this.entries.clear();
    this.textures.cash.destroy(true);
    this.textures.fuel.destroy(true);
    this.container.destroy({ children: true });
  }
}

/** A round icon with a coloured core and a soft halo. */
function makeIcon(renderer: Renderer, core: number, halo: number): Texture {
  const g = new Graphics();
  const cx = 18;
  g.circle(cx, cx, 16).fill({ color: halo, alpha: 0.2 });
  g.circle(cx, cx, 11).fill({ color: halo, alpha: 0.35 });
  g.circle(cx, cx, 7).fill({ color: core, alpha: 1.0 });
  g.circle(cx, cx, 3).fill({ color: 0xffffff, alpha: 0.9 });
  const t = renderer.generateTexture({ target: g, resolution: 4, antialias: true });
  g.destroy();
  return t;
}
