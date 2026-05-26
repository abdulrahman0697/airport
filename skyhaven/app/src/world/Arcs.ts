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

const PULSE_COUNT = 3;
const PULSE_CYCLE_MS = 4_200;
const PLANE_TAP_RADIUS = 18;

interface ArcEntry {
  routeId: string;
  pathContainer: Graphics;
  plane: Graphics;
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
      this.drawPlane(e);
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
      entry.plane.destroy();
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
    const plane = new Graphics();
    const pulses: Graphics[] = [];
    this.container.addChild(pathContainer);
    for (let i = 0; i < PULSE_COUNT; i++) {
      const g = new Graphics();
      this.container.addChild(g);
      pulses.push(g);
    }
    this.container.addChild(plane);
    const entry: ArcEntry = {
      routeId: r.id,
      pathContainer,
      plane,
      pulses,
      path,
      legProgress: r.legProgress,
      legDirection: r.legDirection,
    };
    this.entries.set(r.id, entry);
    this.drawPath(entry);
    this.drawPlane(entry);
    this.positionPlane(entry);
    this.updatePulsesNow(entry);

    // Plane is tappable.
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
  }

  private drawPath(entry: ArcEntry): void {
    const g = entry.pathContainer;
    g.clear();
    const { path } = entry;
    if (path.length < 2) return;
    g.moveTo(path[0]!.x, path[0]!.y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i]!.x, path[i]!.y);
    g.stroke({ color: this.tailColor, alpha: 0.18, width: 5, cap: 'round', join: 'round' });
    g.moveTo(path[0]!.x, path[0]!.y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i]!.x, path[i]!.y);
    g.stroke({ color: this.tailColor, alpha: 0.85, width: 1.6, cap: 'round', join: 'round' });
  }

  /**
   * Draw the plane glyph centred at (0, 0) pointing right (+x). Per-
   * frame `positionPlane` sets sprite-space position + rotation; the
   * glyph itself is drawn once.
   */
  private drawPlane(entry: ArcEntry): void {
    const g = entry.plane;
    g.clear();
    // Soft halo behind the plane.
    g.circle(0, 0, 8).fill({ color: this.tailColor, alpha: 0.18 });
    // Fuselage — slim triangle pointing right with a wider centre.
    g.moveTo(8, 0)
      .lineTo(-5, 2.5)
      .lineTo(-5, -2.5)
      .closePath()
      .fill({ color: 0xffffff, alpha: 0.97 });
    // Wings — swept back.
    g.moveTo(1, 0)
      .lineTo(-2.5, -6)
      .lineTo(-4, -6)
      .lineTo(-3, 0)
      .lineTo(-4, 6)
      .lineTo(-2.5, 6)
      .closePath()
      .fill({ color: this.tailColor, alpha: 0.95 });
    // Tail fin.
    g.moveTo(-5, 0)
      .lineTo(-7, -3)
      .lineTo(-7, 0)
      .closePath()
      .fill({ color: this.tailColor, alpha: 0.95 });
    g.moveTo(-5, 0)
      .lineTo(-7, 3)
      .lineTo(-7, 0)
      .closePath()
      .fill({ color: this.tailColor, alpha: 0.6 });
  }

  private positionPlane(entry: ArcEntry): void {
    const t = entry.legDirection === 'outbound' ? entry.legProgress : 1 - entry.legProgress;
    const p = pointAlongPath(entry.path, t);
    entry.plane.position.set(p.x, p.y);
    // Compute tangent at t using a forward neighbour.
    const eps = 0.01;
    const tForward = entry.legDirection === 'outbound'
      ? Math.min(0.999, t + eps)
      : Math.max(0.001, t + eps);
    const next = pointAlongPath(entry.path, tForward);
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    if (dx !== 0 || dy !== 0) {
      entry.plane.rotation = Math.atan2(dy, dx);
    }
  }

  private updatePulsesNow(entry: ArcEntry): void {
    const basePhase = (this.now % PULSE_CYCLE_MS) / PULSE_CYCLE_MS;
    for (let i = 0; i < entry.pulses.length; i++) {
      const g = entry.pulses[i]!;
      const t = (basePhase + i / entry.pulses.length) % 1;
      const fade = Math.min(1, Math.min(t, 1 - t) * 6);
      const alpha = 0.85 * fade;
      g.clear();
      if (alpha <= 0.01) continue;
      const p = pointAlongPath(entry.path, t);
      g.circle(p.x, p.y, 3.5).fill({ color: this.tailColor, alpha: alpha * 0.35 });
      g.circle(p.x, p.y, 1.4).fill({ color: this.tailColor, alpha });
    }
  }

  destroy(): void {
    for (const e of this.entries.values()) {
      e.pathContainer.destroy();
      e.plane.destroy();
      for (const p of e.pulses) p.destroy();
    }
    this.entries.clear();
    this.container.destroy({ children: true });
  }
}
