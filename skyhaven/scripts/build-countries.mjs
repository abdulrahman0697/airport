#!/usr/bin/env node
/**
 * Build the world-countries dataset for the Pixi basemap.
 *
 * Input:  scripts/data/countries.geojson (Natural Earth ne_110m, CC0)
 * Output: app/src/data/countries.json
 *         — { polygons: [{ iso, region, ring }] }
 *           where `region` is the SkyHaven region 1..9 (same mapping as
 *           the airport build script) and `ring` is a flat coordinate
 *           array [lon0, lat0, lon1, lat1, …].
 *
 * Pre-simplifies each ring with Ramer-Douglas-Peucker so the runtime
 * can render every country in a single Graphics object without choking.
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

// Region mapping by ISO country code — duplicated from
// build-airports.mjs (same source of truth).
const NA = new Set(['US', 'CA', 'MX', 'BM']);
const LATAM = new Set([
  'AR','BO','BR','CL','CO','CR','CU','DO','EC','SV','GT','GY','HN','HT','JM','NI','PA','PE','PR','PY','SR','TT','UY','VE','BS','BB','BZ','GD','LC','VC','AG','DM','KN','TC','KY','VG','AI','MS',
]);
const EUROPE = new Set([
  'AD','AL','AT','BA','BE','BG','BY','CH','CY','CZ','DE','DK','EE','ES','FI','FO','FR','GB','GR','HR','HU','IE','IS','IT','LI','LT','LU','LV','MC','MD','ME','MK','MT','NL','NO','PL','PT','RO','RS','RU','SE','SI','SK','SM','TR','UA','VA','XK','GI','GG','JE','IM','AX',
]);
const MIDDLE_EAST = new Set(['AE','BH','IL','IQ','IR','JO','KW','LB','OM','PS','QA','SA','SY','YE']);
const AFRICA = new Set([
  'AO','BF','BI','BJ','BW','CD','CF','CG','CI','CM','CV','DJ','DZ','EG','EH','ER','ET','GA','GH','GM','GN','GQ','GW','KE','KM','LR','LS','LY','MA','MG','ML','MR','MU','MW','MZ','NA','NE','NG','RE','RW','SC','SD','SH','SL','SN','SO','SS','ST','SZ','TD','TG','TN','TZ','UG','YT','ZA','ZM','ZW',
]);
const SOUTH_ASIA = new Set(['AF','BD','BT','IN','LK','MV','NP','PK']);
const EAST_ASIA = new Set(['CN','HK','JP','KP','KR','MN','MO','TW']);
const SOUTHEAST_ASIA = new Set(['BN','ID','KH','LA','MM','MY','PH','SG','TH','TL','VN']);
const OCEANIA = new Set(['AS','AU','CK','FJ','FM','GU','KI','MH','MP','NC','NR','NU','NZ','PF','PG','PN','PW','SB','TK','TO','TV','VU','WS','WF']);

function regionOf(iso) {
  if (!iso) return 0;
  if (NA.has(iso)) return 1;
  if (LATAM.has(iso)) return 2;
  if (EUROPE.has(iso)) return 3;
  if (MIDDLE_EAST.has(iso)) return 4;
  if (AFRICA.has(iso)) return 5;
  if (SOUTH_ASIA.has(iso)) return 6;
  if (EAST_ASIA.has(iso)) return 7;
  if (SOUTHEAST_ASIA.has(iso)) return 8;
  if (OCEANIA.has(iso)) return 9;
  return 0;
}

/** Ramer-Douglas-Peucker on a flat ring of [lon, lat] pairs. */
function simplifyRing(ring, epsilon) {
  if (ring.length <= 4) return ring;
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
const polygons = [];
const EPSILON_DEG = 0.4;

for (const feat of raw.features) {
  const geom = feat.geometry;
  if (!geom) continue;
  const props = feat.properties ?? {};
  const iso = (props.ISO_A2_EH || props.ISO_A2 || props.iso_a2 || '').toUpperCase();
  const region = regionOf(iso);
  const ringsList = geom.type === 'Polygon' ? [geom.coordinates]
                  : geom.type === 'MultiPolygon' ? geom.coordinates
                  : [];
  for (const poly of ringsList) {
    const ring = poly[0];
    if (!ring || ring.length < 4) continue;
    const flat = [];
    for (const [lon, lat] of ring) flat.push(lon, lat);
    const simplified = simplifyRing(flat, EPSILON_DEG);
    if (simplified.length >= 6) polygons.push({ iso, region, ring: simplified });
  }
}

writeFileSync(OUT, JSON.stringify({ polygons }));
const bytes = readFileSync(OUT).length;
console.log(`Wrote ${polygons.length} polygons → app/src/data/countries.json (${(bytes / 1024).toFixed(1)} KB)`);
const regionDist = polygons.reduce((m, p) => { m[p.region] = (m[p.region] || 0) + 1; return m; }, {});
console.log('Polygons by region:', regionDist);
