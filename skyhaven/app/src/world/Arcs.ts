/**
 * Route-arc rendering layer (BRD §9.1 "Energised route arcs").
 *
 * Each player route renders as a stroked great-circle path in the
 * airline's tail color, with a glowing dot indicating the aircraft's
 * current leg position. Phase 5 ships the static visual; the pulsing
 * "light traveling along the arc" treatment lands with Phase 10 polish.
 *
 * The layer is rebuildable: `setRoutes()` diffs by route id and
 * incrementally creates / updates / removes child graphics so we
 * don't allocate every frame.
 */
import { Container, Graphics } from 'pixi.js';
import type { Airport } from '../data/airports';
import type { Route } from '../engine/types';
import { greatCirclePath, pointAlongPath } from './geo';

interface ArcEntry {
  routeId: string;
  pathContainer: Graphics;
  dot: Graphics;
  path: ReturnType<typeof greatCirclePath>;
  legProgress: number;
  legDirection: Route['legDirection'];
}

export class ArcsLayer {
  readonly container = new Container();
  private entries = new Map<string, ArcEntry>();
  private airportByIata = new Map<string, Airport>();
  private tailColor = 0x5ac8fa;

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
      this.drawDot(e);
    }
  }

  setRoutes(routes: readonly Route[]): void {
    const seen = new Set<string>();
    for (const r of routes) {
      seen.add(r.id);
      const existing = this.entries.get(r.id);
      if (!existing) {
        this.add(r);
      } else {
        // Update progress for the dot animation; if endpoints changed,
        // rebuild the path. (In practice endpoints are immutable.)
        if (
          existing.legProgress !== r.legProgress
          || existing.legDirection !== r.legDirection
        ) {
          existing.legProgress = r.legProgress;
          existing.legDirection = r.legDirection;
          this.drawDot(existing);
        }
      }
    }
    // Remove arcs whose routes are gone.
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue;
      entry.pathContainer.destroy();
      entry.dot.destroy();
      this.entries.delete(id);
    }
  }

  private add(r: Route): void {
    const o = this.airportByIata.get(r.originIata);
    const d = this.airportByIata.get(r.destIata);
    if (!o || !d) return;
    const path = greatCirclePath(o.lat, o.lon, d.lat, d.lon, 48);
    const pathContainer = new Graphics();
    const dot = new Graphics();
    this.container.addChild(pathContainer);
    this.container.addChild(dot);
    const entry: ArcEntry = {
      routeId: r.id,
      pathContainer,
      dot,
      path,
      legProgress: r.legProgress,
      legDirection: r.legDirection,
    };
    this.entries.set(r.id, entry);
    this.drawPath(entry);
    this.drawDot(entry);
  }

  private drawPath(entry: ArcEntry): void {
    const g = entry.pathContainer;
    g.clear();
    const { path } = entry;
    if (path.length < 2) return;
    // Halo + core stroke for a glow effect.
    g.moveTo(path[0]!.x, path[0]!.y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i]!.x, path[i]!.y);
    g.stroke({ color: this.tailColor, alpha: 0.18, width: 5, cap: 'round', join: 'round' });
    g.moveTo(path[0]!.x, path[0]!.y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i]!.x, path[i]!.y);
    g.stroke({ color: this.tailColor, alpha: 0.85, width: 1.6, cap: 'round', join: 'round' });
  }

  private drawDot(entry: ArcEntry): void {
    const g = entry.dot;
    g.clear();
    const t = entry.legDirection === 'outbound' ? entry.legProgress : 1 - entry.legProgress;
    const p = pointAlongPath(entry.path, t);
    // Outer halo
    g.circle(p.x, p.y, 5).fill({ color: this.tailColor, alpha: 0.25 });
    g.circle(p.x, p.y, 2.6).fill({ color: 0xffffff, alpha: 0.95 });
  }

  destroy(): void {
    for (const e of this.entries.values()) {
      e.pathContainer.destroy();
      e.dot.destroy();
    }
    this.entries.clear();
    this.container.destroy({ children: true });
  }
}
