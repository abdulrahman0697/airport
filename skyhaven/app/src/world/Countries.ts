/**
 * World-countries layer (BRD §9.1, Phase 10).
 *
 * Renders the Natural Earth ne_110m country polygons as a single
 * filled Graphics. The fill is a faint navy-violet (lighter than the
 * ocean) so continents read as solid land masses; the outline is a
 * thin cyan-grey so coastlines pop without overwhelming the pins.
 *
 * Layer is built once and never changes — pure decoration.
 */
import { Container, Graphics } from 'pixi.js';
import { lonLatToWorld } from './projection';

import countryData from '../data/countries.json' with { type: 'json' };

const POLYGONS: readonly (readonly number[])[] = countryData as readonly (readonly number[])[];

const LAND_FILL = 0x111A2E;
const LAND_OUTLINE = 0x2D3A5C;

export function createCountries(): Container {
  const root = new Container();
  root.label = 'countries';

  const g = new Graphics();
  for (const ring of POLYGONS) {
    if (ring.length < 6) continue;
    // ring is a flat [lon0, lat0, lon1, lat1, …]
    const p0 = lonLatToWorld(ring[0]!, ring[1]!);
    g.moveTo(p0.x, p0.y);
    for (let i = 2; i < ring.length; i += 2) {
      const p = lonLatToWorld(ring[i]!, ring[i + 1]!);
      g.lineTo(p.x, p.y);
    }
    g.closePath();
  }
  g.fill({ color: LAND_FILL, alpha: 1.0 });
  g.stroke({ color: LAND_OUTLINE, width: 0.8, alpha: 0.65 });

  root.addChild(g);
  return root;
}
