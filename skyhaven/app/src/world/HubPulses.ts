/**
 * Owned-hub pulse layer (Design pass D4).
 *
 * For every owned hub, paints a slow expanding ring that fades out
 * over a fixed cycle. Reads as "this airport is operational" — much
 * more inhabited than a static pin. Three concurrent pulses per hub
 * staggered by 1/3 cycle so the effect is continuous.
 */
import { Container, Graphics } from 'pixi.js';
import type { Airport } from '../data/airports';
import { lonLatToWorld, WORLD_WIDTH } from './projection';

const TILE_OFFSETS = [-WORLD_WIDTH, 0, WORLD_WIDTH] as const;
const PULSE_PERIOD_MS = 2_800;
const PULSE_COUNT = 3;
const PULSE_MAX_RADIUS = 26;

export interface HubPulsesLayer {
  container: Container;
  setHubs(iatas: readonly string[], tailColor: number): void;
  tick(dtMs: number): void;
  destroy(): void;
}

export function createHubPulses(airports: readonly Airport[]): HubPulsesLayer {
  const root = new Container();
  root.label = 'hub-pulses';
  root.eventMode = 'none';

  const g = new Graphics();
  root.addChild(g);

  const airportByIata = new Map<string, Airport>();
  for (const a of airports) airportByIata.set(a.iata, a);

  let hubIatas: readonly string[] = [];
  let tailColor = 0x5ac8fa;
  let nowMs = 0;

  function paint(): void {
    g.clear();
    if (hubIatas.length === 0) return;
    const basePhase = (nowMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
    for (const iata of hubIatas) {
      const ap = airportByIata.get(iata);
      if (!ap) continue;
      const { x, y } = lonLatToWorld(ap.lon, ap.lat);
      for (let i = 0; i < PULSE_COUNT; i++) {
        const t = (basePhase + i / PULSE_COUNT) % 1;
        const radius = t * PULSE_MAX_RADIUS;
        const alpha = (1 - t) * 0.55;
        if (alpha <= 0.01) continue;
        for (const off of TILE_OFFSETS) {
          g.circle(x + off, y, radius).stroke({
            color: tailColor,
            alpha,
            width: 1.5,
            alignment: 0.5,
          });
        }
      }
    }
  }

  return {
    container: root,
    setHubs(iatas, color): void {
      hubIatas = iatas;
      tailColor = color;
      paint();
    },
    tick(dtMs): void {
      nowMs += dtMs;
      paint();
    },
    destroy(): void {
      g.destroy();
      root.destroy({ children: true });
    },
  };
}
