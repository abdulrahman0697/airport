/**
 * Ambient map effects (Design pass D1).
 *
 * Sits between the basemap and the country layer. Adds two
 * deterministic visual flourishes that make the map feel alive
 * without crowding it:
 *
 *  - **Aurora pulse**: a slow band that breathes alpha across the
 *    upper latitudes. Subtle enough not to interfere with airport
 *    pins; vivid enough to read as "Northern Lights".
 *  - **Shooting stars**: tiny meteors arc across the sky on a
 *    deterministic spawn schedule. Each star is a quick fade-in
 *    streak that decays over ~800 ms.
 *
 * Both effects honour prefers-reduced-motion: the layer can be
 * paused via `setReducedMotion(true)` and the visible state freezes.
 */
import { Container, Graphics } from 'pixi.js';
import { WORLD_HEIGHT, WORLD_WIDTH } from './projection';

const AURORA_PERIOD_MS = 9_000;
const SHOOTING_STAR_SPAWN_MS = 2_800;
const SHOOTING_STAR_LIFE_MS = 850;
const MAX_LIVE_STARS = 4;
const TILE_OFFSETS = [-WORLD_WIDTH, 0, WORLD_WIDTH] as const;

interface ShootingStar {
  /** World x at spawn. */
  x0: number;
  /** World y at spawn. */
  y0: number;
  /** Trail vector (world units). */
  dx: number;
  dy: number;
  /** Spawn time in layer-local ms. */
  bornMs: number;
}

export interface AmbientLayer {
  container: Container;
  tick(dtMs: number): void;
  setReducedMotion(reduced: boolean): void;
  destroy(): void;
}

export function createAmbient(): AmbientLayer {
  const root = new Container();
  root.label = 'ambient';
  // Block input on this purely cosmetic layer so pin / collectible
  // taps still propagate through cleanly.
  root.eventMode = 'none';

  const aurora = new Graphics();
  const stars = new Graphics();
  root.addChild(aurora);
  root.addChild(stars);

  let layerMs = 0;
  let nextSpawnMs = 1500;
  let reduced = false;
  const live: ShootingStar[] = [];

  // Deterministic xorshift seeded from a constant — same map, same
  // shooting-star schedule across sessions.
  let seed = 0xBADCAFE | 0;
  const rand = (): number => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };

  function paintAurora(): void {
    aurora.clear();
    const phase = (layerMs % AURORA_PERIOD_MS) / AURORA_PERIOD_MS;
    // Smooth pulse via cosine: 0..1..0 over the period.
    const breathe = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    // Two bands — one near the top, one further down — each tinted
    // slightly differently for a sky-and-sea read.
    const top = 80;
    const bandH = 260;
    for (const off of TILE_OFFSETS) {
      // Top band: green-cyan aurora across the polar latitudes.
      aurora
        .rect(off - 40, top, WORLD_WIDTH + 80, bandH)
        .fill({ color: 0x34D399, alpha: 0.06 + 0.05 * breathe });
      aurora
        .rect(off - 40, top + bandH * 0.35, WORLD_WIDTH + 80, bandH * 0.5)
        .fill({ color: 0x5AC8FA, alpha: 0.04 + 0.06 * breathe });
      // Bottom band: violet-pink wash near the southern aurora belt.
      aurora
        .rect(off - 40, WORLD_HEIGHT - bandH - 40, WORLD_WIDTH + 80, bandH)
        .fill({ color: 0x8B5CF6, alpha: 0.04 + 0.04 * (1 - breathe) });
    }
  }

  function paintStars(): void {
    stars.clear();
    for (const s of live) {
      const t = (layerMs - s.bornMs) / SHOOTING_STAR_LIFE_MS;
      if (t < 0 || t > 1) continue;
      // Streak fades in, peaks at 60%, fades out.
      const fade = t < 0.6 ? t / 0.6 : 1 - (t - 0.6) / 0.4;
      const headX = s.x0 + s.dx * t;
      const headY = s.y0 + s.dy * t;
      const tailX = s.x0 + s.dx * Math.max(0, t - 0.25);
      const tailY = s.y0 + s.dy * Math.max(0, t - 0.25);
      // Tail line.
      for (const off of TILE_OFFSETS) {
        stars
          .moveTo(tailX + off, tailY)
          .lineTo(headX + off, headY)
          .stroke({ color: 0xFFFFFF, alpha: 0.85 * fade, width: 1.4, cap: 'round' });
        stars.circle(headX + off, headY, 1.6).fill({ color: 0xFFFFFF, alpha: 0.95 * fade });
        stars.circle(headX + off, headY, 4).fill({ color: 0x5AC8FA, alpha: 0.35 * fade });
      }
    }
  }

  function spawnIfNeeded(): void {
    if (live.length >= MAX_LIVE_STARS) return;
    if (layerMs < nextSpawnMs) return;
    // Pick a launch point in the upper third of the world.
    const x0 = rand() * WORLD_WIDTH;
    const y0 = 60 + rand() * (WORLD_HEIGHT * 0.35);
    // Streak vector: rightward + downward, randomised length.
    const angle = (-Math.PI / 8) + rand() * (Math.PI / 6); // mostly horizontal
    const speed = 220 + rand() * 180;                       // px over the life
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed * 0.7;
    live.push({ x0, y0, dx, dy, bornMs: layerMs });
    nextSpawnMs = layerMs + SHOOTING_STAR_SPAWN_MS * (0.7 + rand() * 0.6);
  }

  function gc(): void {
    for (let i = live.length - 1; i >= 0; i--) {
      const s = live[i]!;
      if (layerMs - s.bornMs > SHOOTING_STAR_LIFE_MS) live.splice(i, 1);
    }
  }

  paintAurora();

  return {
    container: root,
    tick(dtMs): void {
      if (reduced) return;
      layerMs += dtMs;
      spawnIfNeeded();
      gc();
      paintAurora();
      paintStars();
    },
    setReducedMotion(next): void {
      reduced = next;
      if (reduced) {
        // Freeze the visible state — leave whatever's currently
        // painted on screen as a still frame.
        live.length = 0;
        stars.clear();
      }
    },
    destroy(): void {
      aurora.destroy();
      stars.destroy();
      root.destroy({ children: true });
    },
  };
}
