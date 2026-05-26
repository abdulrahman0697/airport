/**
 * Route-arc rendering layer (BRD §9.1 "Energised route arcs").
 *
 * Each player route renders as a stroked great-circle path in the
 * airline's tail color, with:
 *  - a glowing aircraft dot at the current leg position
 *  - three continuously-cycling light pulses travelling along the
 *    arc (Phase 10 "energised arcs" treatment)
 *
 * The layer is rebuildable: `setRoutes()` diffs by route id and
 * incrementally creates / updates / removes child graphics. `tick(dt)`
 * advances the pulse animation each frame.
 */
import { Container, Graphics } from 'pixi.js';
import type { Airport } from '../data/airports';
import type { Route } from '../engine/types';
import { greatCirclePath, pointAlongPath } from './geo';

const PULSE_COUNT = 3;
/** ms for a pulse to traverse the full arc end-to-end. */
const PULSE_CYCLE_MS = 4_200;

interface ArcEntry {
  routeId: string;
  pathContainer: Graphics;
  dot: Graphics;
  pulses: Graphics[];
  path: ReturnType<typeof greatCirclePath>;
  legProgress: number;
  legDirection: Route['legDirection'];
}

export class ArcsLayer {
  readonly container = new Container();
  private entries = new Map<string, ArcEntry>();
  private airportByIata = new Map<string, Airport>();
  private tailColor = 0x5ac8fa;
  private now = 0;

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
      this.drawPulses(e);
    }
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
        this.drawDot(existing);
      }
    }
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue;
      entry.pathContainer.destroy();
      entry.dot.destroy();
      for (const p of entry.pulses) p.destroy();
      this.entries.delete(id);
    }
  }

  /** Advance pulse animation. Called every frame from WorldStage's ticker. */
  tick(dtMs: number): void {
    this.now += dtMs;
    for (const e of this.entries.values()) this.drawPulses(e);
  }

  private add(r: Route): void {
    const o = this.airportByIata.get(r.originIata);
    const d = this.airportByIata.get(r.destIata);
    if (!o || !d) return;
    const path = greatCirclePath(o.lat, o.lon, d.lat, d.lon, 48);
    const pathContainer = new Graphics();
    const dot = new Graphics();
    const pulses: Graphics[] = [];
    this.container.addChild(pathContainer);
    for (let i = 0; i < PULSE_COUNT; i++) {
      const g = new Graphics();
      this.container.addChild(g);
      pulses.push(g);
    }
    this.container.addChild(dot);
    const entry: ArcEntry = {
      routeId: r.id,
      pathContainer,
      dot,
      pulses,
      path,
      legProgress: r.legProgress,
      legDirection: r.legDirection,
    };
    this.entries.set(r.id, entry);
    this.drawPath(entry);
    this.drawDot(entry);
    this.drawPulses(entry);
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

  private drawDot(entry: ArcEntry): void {
    const g = entry.dot;
    g.clear();
    const t = entry.legDirection === 'outbound' ? entry.legProgress : 1 - entry.legProgress;
    const p = pointAlongPath(entry.path, t);
    g.circle(p.x, p.y, 6).fill({ color: this.tailColor, alpha: 0.30 });
    g.circle(p.x, p.y, 3.4).fill({ color: this.tailColor, alpha: 0.85 });
    g.circle(p.x, p.y, 1.6).fill({ color: 0xffffff, alpha: 1.0 });
  }

  /**
   * Three light pulses travel from origin → destination on a loop,
   * staggered by 1/N phase so the eye reads constant motion. The
   * pulses use the tail colour and fade in / out at the endpoints
   * so they don't pop.
   */
  private drawPulses(entry: ArcEntry): void {
    const basePhase = (this.now % PULSE_CYCLE_MS) / PULSE_CYCLE_MS;
    for (let i = 0; i < entry.pulses.length; i++) {
      const g = entry.pulses[i]!;
      const t = (basePhase + i / entry.pulses.length) % 1;
      // Soft fade at endpoints so pulses don't appear to spawn from
      // the pin or dive into it.
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
      e.dot.destroy();
      for (const p of e.pulses) p.destroy();
    }
    this.entries.clear();
    this.container.destroy({ children: true });
  }
}
