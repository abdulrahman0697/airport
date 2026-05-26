/**
 * World-countries layer (BRD §9.1, Phase 10).
 *
 * Renders the Natural Earth ne_110m country polygons as two filled
 * Graphics — one for countries in unlocked regions (bright cyan-tinted
 * land) and one for the rest (still readable but dimmer). The split
 * lets the player see at a glance which parts of the world are open
 * for routing.
 *
 * The unlocked layer is rebuilt whenever the set of unlocked regions
 * changes (which only happens on a player action — `unlockRegion`),
 * so the cost is bounded.
 */
import { Container, Graphics } from 'pixi.js';
import { lonLatToWorld, WORLD_WIDTH } from './projection';

import countryData from '../data/countries.json' with { type: 'json' };

// Tile horizontally so panning past the dateline shows continuous land.
const TILE_OFFSETS = [-WORLD_WIDTH, 0, WORLD_WIDTH] as const;

interface CountryPoly { iso: string; region: number; ring: number[] }
const POLYGONS: readonly CountryPoly[] =
  (countryData as { polygons: readonly CountryPoly[] }).polygons;

const LAND_LOCKED_FILL = 0x1F2D58;     // a touch brighter than panel bg
const LAND_LOCKED_STROKE = 0x3A4B82;
const LAND_UNLOCKED_FILL = 0x2C4480;   // noticeably brighter
const LAND_UNLOCKED_STROKE = 0x6FA9FF;

export interface CountriesLayer {
  container: Container;
  setUnlockedRegions(regions: ReadonlySet<number>): void;
  destroy(): void;
}

export function createCountries(): CountriesLayer {
  const root = new Container();
  root.label = 'countries';
  const locked = new Graphics();
  const unlocked = new Graphics();
  root.addChild(locked);
  root.addChild(unlocked);

  let lastSig = '';

  function rebuild(unlockedRegions: ReadonlySet<number>): void {
    locked.clear();
    unlocked.clear();
    for (const off of TILE_OFFSETS) {
      for (const poly of POLYGONS) {
        const target = unlockedRegions.has(poly.region) ? unlocked : locked;
        const r = poly.ring;
        if (r.length < 6) continue;
        const p0 = lonLatToWorld(r[0]!, r[1]!);
        target.moveTo(p0.x + off, p0.y);
        for (let i = 2; i < r.length; i += 2) {
          const p = lonLatToWorld(r[i]!, r[i + 1]!);
          target.lineTo(p.x + off, p.y);
        }
        target.closePath();
      }
    }
    locked.fill({ color: LAND_LOCKED_FILL, alpha: 1.0 });
    locked.stroke({ color: LAND_LOCKED_STROKE, width: 0.7, alpha: 0.6 });
    unlocked.fill({ color: LAND_UNLOCKED_FILL, alpha: 1.0 });
    unlocked.stroke({ color: LAND_UNLOCKED_STROKE, width: 1.1, alpha: 0.85 });
  }

  // Build with no unlocked regions initially. WorldStage calls
  // setUnlockedRegions once the store is loaded.
  rebuild(new Set());

  return {
    container: root,
    setUnlockedRegions(regions: ReadonlySet<number>): void {
      const sig = [...regions].sort().join(',');
      if (sig === lastSig) return;
      lastSig = sig;
      rebuild(regions);
    },
    destroy(): void {
      locked.destroy();
      unlocked.destroy();
      root.destroy({ children: true });
    },
  };
}
