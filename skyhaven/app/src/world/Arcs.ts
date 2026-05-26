/**
 * Route-arc rendering layer (BRD §9.1 "Energised route arcs").
 *
 * Each player route renders as:
 *  - a stroked great-circle path in the airline's tail color
 *  - three continuously-cycling light pulses
 *  - a small plane icon at the current leg position, rotated to face
 *    the direction of travel and tappable to show route details
 *
 * The plane glyph is a Pixi Graphics drawn once at creation; we just
 * update its `position` and `rotation` per frame.
 */
import { Container, Graphics } from 'pixi.js';
import type { Airport } from '../data/airports';
import type { Route } from '../engine/types';
import { greatCirclePath, pointAlongPath } from './geo';
import { WORLD_WIDTH } from './projection';

const PULSE_COUNT = 3;
const PULSE_CYCLE_MS = 4_200;
const PLANE_TAP_RADIUS = 18;
// Mirror arc / plane / pulses into the ±WORLD_WIDTH wraparound tiles so
// the infinite horizontal pan stays continuous across the dateline.
const TILE_OFFSETS = [-WORLD_WIDTH, 0, WORLD_WIDTH] as const;

interface ArcEntry {
  routeId: string;
  pathContainer: Graphics;
  planes: Graphics[];
  pulses: Graphics[];
  path: ReturnType<typeof greatCirclePath>;
  legProgress: number;
  legDirection: Route['legDirection'];
}

export type ArcTapHandler = (routeId: string, screen: { x: number; y: number }) => void;

export class ArcsLayer {
  readonly container = new Container();
  private entries = new Map<string, ArcEntry>();
  private airportByIata = new Map<string, Airport>();
  private tailColor = 0x5ac8fa;
  private now = 0;
  private onTap: ArcTapHandler = () => undefined;

  constructor(airports: readonly Airport[]) {
    this.container.label = 'arcs';
    for (const a of airports) this.airportByIata.set(a.iata, a);
  }

  setTailColor(hex: string): void {
    const n = parseInt(hex.replace('#', ''), 16);
    if (!Number.isFinite(n)) return;
    this.tailColor = n;
    for (const e of this.entries.values()) {
      this.drawPath(e);
      for (const p of e.planes) this.drawPlane(p);
      this.updatePulsesNow(e);
    }
  }

  setTapHandler(fn: ArcTapHandler): void {
    this.onTap = fn;
  }

  setRoutes(routes: readonly Route[]): void {
    const seen = new Set<string>();
    for (const r of routes) {
      seen.add(r.id);
      const existing = this.entries.get(r.id);
      if (!existing) {
        this.add(r);
      } else if (
        existing.legProgress !== r.legProgress
        || existing.legDirection !== r.legDirection
      ) {
        existing.legProgress = r.legProgress;
        existing.legDirection = r.legDirection;
        this.positionPlane(existing);
      }
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue;
      entry.pathContainer.destroy();
      for (const p of entry.planes) p.destroy();
      for (const p of entry.pulses) p.destroy();
      this.entries.delete(id);
    }
  }

  tick(dtMs: number): void {
    this.now += dtMs;
    for (const e of this.entries.values()) this.updatePulsesNow(e);
  }

  private add(r: Route): void {
    const o = this.airportByIata.get(r.originIata);
    const d = this.airportByIata.get(r.destIata);
    if (!o || !d) return;
    const path = greatCirclePath(o.lat, o.lon, d.lat, d.lon, 48);
    const pathContainer = new Graphics();
    const planes: Graphics[] = [];
    const pulses: Graphics[] = [];
    this.container.addChild(pathContainer);
    for (let i = 0; i < PULSE_COUNT * TILE_OFFSETS.length; i++) {
      const g = new Graphics();
      this.container.addChild(g);
      pulses.push(g);
    }
    for (let i = 0; i < TILE_OFFSETS.length; i++) {
      const plane = new Graphics();
      this.container.addChild(plane);
      plane.eventMode = 'static';
      plane.cursor = 'pointer';
      plane.hitArea = {
        contains: (px: number, py: number): boolean =>
          px * px + py * py <= PLANE_TAP_RADIUS * PLANE_TAP_RADIUS,
      };
      plane.on('pointertap', (event) => {
        const g = event.global;
        this.onTap(r.id, { x: g.x, y: g.y });
      });
      planes.push(plane);
    }
    const entry: ArcEntry = {
      routeId: r.id,
      pathContainer,
      planes,
      pulses,
      path,
      legProgress: r.legProgress,
      legDirection: r.legDirection,
    };
    this.entries.set(r.id, entry);
    this.drawPath(entry);
    for (const p of planes) this.drawPlane(p);
    this.positionPlane(entry);
    this.updatePulsesNow(entry);
  }

  private drawPath(entry: ArcEntry): void {
    const g = entry.pathContainer;
    g.clear();
    const { path } = entry;
    if (path.length < 2) return;
    // Tile the stroke at ±WORLD_WIDTH so paths stay continuous across
    // the dateline wraparound.
    for (const off of TILE_OFFSETS) {
      g.moveTo(path[0]!.x + off, path[0]!.y);
      for (let i = 1; i < path.length; i++) g.lineTo(path[i]!.x + off, path[i]!.y);
      g.stroke({ color: this.tailColor, alpha: 0.18, width: 5, cap: 'round', join: 'round' });
      g.moveTo(path[0]!.x + off, path[0]!.y);
      for (let i = 1; i < path.length; i++) g.lineTo(path[i]!.x + off, path[i]!.y);
      g.stroke({ color: this.tailColor, alpha: 0.85, width: 1.6, cap: 'round', join: 'round' });
    }
  }

  private drawPlane(g: Graphics): void {
    g.clear();
    // Slightly smaller plane than before — reads cleaner on the world.
    g.circle(0, 0, 6).fill({ color: this.tailColor, alpha: 0.18 });
    g.moveTo(6, 0)
      .lineTo(-3.5, 1.8)
      .lineTo(-3.5, -1.8)
      .closePath()
      .fill({ color: 0xffffff, alpha: 0.97 });
    g.moveTo(1, 0)
      .lineTo(-2, -4.5)
      .lineTo(-3, -4.5)
      .lineTo(-2.5, 0)
      .lineTo(-3, 4.5)
      .lineTo(-2, 4.5)
      .closePath()
      .fill({ color: this.tailColor, alpha: 0.95 });
    g.moveTo(-3.5, 0)
      .lineTo(-5, -2.2)
      .lineTo(-5, 0)
      .closePath()
      .fill({ color: this.tailColor, alpha: 0.95 });
    g.moveTo(-3.5, 0)
      .lineTo(-5, 2.2)
      .lineTo(-5, 0)
      .closePath()
      .fill({ color: this.tailColor, alpha: 0.6 });
  }

  private positionPlane(entry: ArcEntry): void {
    const t = entry.legDirection === 'outbound' ? entry.legProgress : 1 - entry.legProgress;
    const p = pointAlongPath(entry.path, t);
    // Heading is the direction the plane is actually flying *now* —
    // on the inbound leg, that's back toward the origin, so we sample
    // the path going the opposite way.
    const eps = 0.01;
    const tProbe = entry.legDirection === 'outbound'
      ? Math.min(0.999, t + eps)
      : Math.max(0.001, t - eps);
    const probe = pointAlongPath(entry.path, tProbe);
    const dx = probe.x - p.x;
    const dy = probe.y - p.y;
    const heading = (dx !== 0 || dy !== 0) ? Math.atan2(dy, dx) : 0;
    for (let i = 0; i < entry.planes.length; i++) {
      const off = TILE_OFFSETS[i]!;
      const plane = entry.planes[i]!;
      plane.position.set(p.x + off, p.y);
      if (dx !== 0 || dy !== 0) plane.rotation = heading;
    }
  }

  private updatePulsesNow(entry: ArcEntry): void {
    const basePhase = (this.now % PULSE_CYCLE_MS) / PULSE_CYCLE_MS;
    // Pulses are laid out as [tile0,pulse0, tile0,pulse1, tile0,pulse2,
    // tile1,pulse0, ...] — wrap-tile index changes every PULSE_COUNT.
    for (let i = 0; i < entry.pulses.length; i++) {
      const g = entry.pulses[i]!;
      const pulseIdx = i % PULSE_COUNT;
      const tileIdx = Math.floor(i / PULSE_COUNT);
      const off = TILE_OFFSETS[tileIdx]!;
      let t = (basePhase + pulseIdx / PULSE_COUNT) % 1;
      if (entry.legDirection === 'inbound') t = 1 - t;
      const fade = Math.min(1, Math.min(t, 1 - t) * 6);
      const alpha = 0.85 * fade;
      g.clear();
      if (alpha <= 0.01) continue;
      const p = pointAlongPath(entry.path, t);
      g.circle(p.x + off, p.y, 3.5).fill({ color: this.tailColor, alpha: alpha * 0.35 });
      g.circle(p.x + off, p.y, 1.4).fill({ color: this.tailColor, alpha });
    }
  }

  destroy(): void {
    for (const e of this.entries.values()) {
      e.pathContainer.destroy();
      for (const p of e.planes) p.destroy();
      for (const p of e.pulses) p.destroy();
    }
    this.entries.clear();
    this.container.destroy({ children: true });
  }
}
