#!/usr/bin/env node
/**
 * Build the world-countries dataset for the Pixi basemap.
 *
 * Input:  scripts/data/countries.geojson (Natural Earth ne_110m, CC0)
 * Output: app/src/data/countries.json
 *         — a compact array of polygons, each as a flat Float32-ish
 *           array of [lon0, lat0, lon1, lat1, …]. We pre-simplify each
 *           ring with Ramer-Douglas-Peucker so the runtime can render
 *           every country in a single Graphics object without choking.
 *
 * Run from skyhaven/: node scripts/build-countries.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, 'data/countries.geojson');
const OUT = resolve(__dirname, '../app/src/data/countries.json');

if (!existsSync(SRC)) {
  console.error(`Missing ${SRC}. Fetch with:`);
  console.error('  curl -sSL -o scripts/data/countries.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson');
  process.exit(1);
}

/** Ramer-Douglas-Peucker on a flat ring of [lon, lat] pairs. */
function simplifyRing(ring, epsilon) {
  if (ring.length <= 4) return ring; // [lon0,lat0,lon1,lat1]
  function dist2(ax, ay, bx, by, px, py) {
    const dx = bx - ax, dy = by - ay;
    const t = dx === 0 && dy === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    const tx = ax + t * dx, ty = ay + t * dy;
    return (px - tx) ** 2 + (py - ty) ** 2;
  }
  const n = ring.length / 2;
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let maxD = 0, idx = -1;
    const ax = ring[i * 2], ay = ring[i * 2 + 1];
    const bx = ring[j * 2], by = ring[j * 2 + 1];
    for (let k = i + 1; k < j; k++) {
      const d = dist2(ax, ay, bx, by, ring[k * 2], ring[k * 2 + 1]);
      if (d > maxD) { maxD = d; idx = k; }
    }
    if (maxD > epsilon * epsilon && idx > 0) {
      keep[idx] = 1;
      stack.push([i, idx]);
      stack.push([idx, j]);
    }
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    if (keep[k]) { out.push(ring[k * 2], ring[k * 2 + 1]); }
  }
  return out;
}

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const out = [];
const EPSILON_DEG = 0.4; // ~44km — coarse enough for the placeholder basemap

for (const feat of raw.features) {
  const geom = feat.geometry;
  if (!geom) continue;
  const polygons = geom.type === 'Polygon' ? [geom.coordinates]
                : geom.type === 'MultiPolygon' ? geom.coordinates
                : [];
  for (const poly of polygons) {
    // First ring is outer, others are holes — for our flat-fill basemap
    // we just take the outer (Natural Earth's 110m has very few holes
    // and they're invisible at this resolution anyway).
    const ring = poly[0];
    if (!ring || ring.length < 4) continue;
    const flat = [];
    for (const [lon, lat] of ring) flat.push(lon, lat);
    const simplified = simplifyRing(flat, EPSILON_DEG);
    if (simplified.length >= 6) out.push(simplified);
  }
}

writeFileSync(OUT, JSON.stringify(out));
const bytes = readFileSync(OUT).length;
console.log(`Wrote ${out.length} polygons → app/src/data/countries.json (${(bytes / 1024).toFixed(1)} KB)`);
