/**
 * Great-circle interpolation on the unit sphere (slerp).
 *
 * Given two lat/lon endpoints, `greatCirclePath(...)` returns N sampled
 * points along the great-circle path between them. Used by the route-
 * arc layer to draw curved arcs that don't deform near the poles.
 */
import { lonLatToWorld, type XY, WORLD_WIDTH } from './projection';

const DEG = Math.PI / 180;

interface SamplePoint {
  readonly x: number;
  readonly y: number;
  readonly lon: number;
}

export function greatCirclePath(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  samples = 32,
): readonly XY[] {
  // Convert to radians.
  const φ1 = lat1 * DEG, λ1 = lon1 * DEG;
  const φ2 = lat2 * DEG, λ2 = lon2 * DEG;
  // Angular distance via the haversine formula.
  const dλ = λ2 - λ1;
  const dφ = φ2 - φ1;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  const d = 2 * Math.asin(Math.sqrt(a));
  if (d < 1e-9) return [lonLatToWorld(lon1, lat1), lonLatToWorld(lon2, lat2)];

  const sinD = Math.sin(d);

  // First pass: sample in lon/lat then resolve antimeridian crossings
  // by snapping each sample's longitude to the nearest of the previous
  // (i.e. add ±360°) so the rendered polyline doesn't dash across the map.
  const raw: SamplePoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const A = Math.sin((1 - f) * d) / sinD;
    const B = Math.sin(f * d) / sinD;
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
    const λ = Math.atan2(y, x);
    const lat = φ / DEG;
    let lon = λ / DEG;
    if (raw.length > 0) {
      const prev = raw[raw.length - 1]!;
      while (lon - prev.lon > 180) lon -= 360;
      while (lon - prev.lon < -180) lon += 360;
    }
    const w = lonLatToWorld(lon, lat);
    raw.push({ x: w.x, y: w.y, lon });
  }

  // The samples may run outside the [0, WORLD_WIDTH] x band when the
  // path crosses the antimeridian. Render the polyline anyway — the
  // Pixi container is parented inside the world bounds, so extra-band
  // segments simply clip off-screen. For a future polish pass we can
  // emit two segments split at the antimeridian.
  return raw.map((p) => ({ x: p.x, y: p.y }));
}

/** Position along a sampled path for `t` in [0, 1]. */
export function pointAlongPath(path: readonly XY[], t: number): XY {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0]!;
  const clamped = Math.max(0, Math.min(1, t));
  const idxFloat = clamped * (path.length - 1);
  const i0 = Math.floor(idxFloat);
  const i1 = Math.min(path.length - 1, i0 + 1);
  const f = idxFloat - i0;
  const p0 = path[i0]!;
  const p1 = path[i1]!;
  return { x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f };
}

// `WORLD_WIDTH` is intentionally exported through projection.ts; this
// re-export silences an unused-import warning when callers only need
// the helpers above.
export { WORLD_WIDTH };
