/**
 * Simplified world map paths for the HubPicker's Founder Market Map.
 *
 * Each continent / island group is drawn as an SVG path in the
 * **equirectangular projection**, where:
 *
 *   x = longitude + 180     (so lon -180° → x = 0, lon 180° → x = 360)
 *   y = 90 - latitude       (so lat 90° → y = 0 at top, lat -90° → y = 180 at bottom)
 *
 * The whole world fits in a 360 × 180 viewBox. To zoom to a region,
 * the host SVG sets its `viewBox` to the lat/lon bounding box of that
 * region (translated through the same projection). Airport pins use
 * `lonToX(a.lon)` and `latToY(a.lat)` so they land in the correct
 * place over the continents.
 *
 * The outlines are hand-simplified — ~15–35 points per landmass — so
 * the maps read as the continent without being cartographic. Detail
 * is concentrated on the coastlines that anchor each region (e.g.
 * the Arabian peninsula is well-resolved because it dominates the
 * Middle East view).
 */

export const WORLD_W = 360;
export const WORLD_H = 180;

export function lonToX(lon: number): number { return lon + 180; }
export function latToY(lat: number): number { return 90 - lat; }

/**
 * Continent + major-island paths, all expressed in world-projection
 * coords. Each `path` string is a closed polyline ready to drop into
 * a single `<path d="..." />` element.
 */
export const WORLD_PATHS: ReadonlyArray<string> = [
  // ── North America ─────────────────────────────────────────────────
  // Alaska → Arctic Canada → Hudson Bay → Labrador → Newfoundland →
  // East Coast → Florida → Gulf → Mexico → Baja → US/Canada West Coast
  // → back to Alaska.
  'M 13 25 L 20 20 L 52 20 L 85 17 L 97 20 L 105 28 L 115 32 L 126 43 L 118 47 L 107 49 L 102 56 L 100 65 L 92 62 L 88 67 L 90 71 L 85 73 L 78 70 L 73 67 L 68 62 L 65 58 L 61 55 L 57 51 L 55 45 L 53 38 L 47 34 L 40 30 L 28 30 L 15 30 Z',

  // ── Greenland ────────────────────────────────────────────────────
  'M 138 14 L 152 12 L 162 18 L 165 28 L 158 38 L 148 36 L 142 30 L 138 24 Z',

  // ── South America ────────────────────────────────────────────────
  // Caribbean coast → Atlantic (NE Brazil, Rio) → S. Argentina →
  // Tierra del Fuego → Patagonia W → Chile coast → Peru → Ecuador →
  // Colombia.
  'M 108 78 L 122 78 L 130 84 L 138 88 L 145 96 L 145 105 L 141 112 L 137 116 L 132 121 L 125 126 L 118 134 L 113 142 L 109 146 L 106 144 L 107 138 L 107 130 L 109 122 L 110 113 L 105 102 L 100 93 L 101 86 L 105 82 Z',

  // ── Africa ───────────────────────────────────────────────────────
  // Senegal → Morocco → Tunis → Egypt → Bab el-Mandeb → Horn of
  // Africa → East coast → Mozambique → Cape → West coast → Senegal.
  'M 163 76 L 168 70 L 173 60 L 180 56 L 190 53 L 200 56 L 213 59 L 215 66 L 219 72 L 223 77 L 230 76 L 233 80 L 228 88 L 222 92 L 220 96 L 219 102 L 215 110 L 212 119 L 205 125 L 198 124 L 197 116 L 193 105 L 188 95 L 185 86 L 184 78 L 180 72 L 174 75 Z',

  // ── Madagascar ───────────────────────────────────────────────────
  'M 226 112 L 230 116 L 232 124 L 228 132 L 224 130 L 224 120 Z',

  // ── United Kingdom (mainland) ────────────────────────────────────
  'M 175 33 L 179 31 L 181 36 L 180 42 L 177 43 L 174 39 Z',

  // ── Ireland ──────────────────────────────────────────────────────
  'M 169 39 L 173 38 L 174 43 L 171 45 L 168 42 Z',

  // ── Iceland ──────────────────────────────────────────────────────
  'M 162 24 L 168 23 L 170 27 L 165 29 Z',

  // ── Europe (continental — Iberia/France through Eastern Europe to
  //    the Black Sea / Aegean / Italian peninsula). Drawn as a single
  //    closed polygon for simplicity.
  'M 171 54 L 175 51 L 177 47 L 179 47 L 181 49 L 184 46 L 187 43 L 191 38 L 198 35 L 200 32 L 205 28 L 213 24 L 220 22 L 228 23 L 234 26 L 233 32 L 228 33 L 230 38 L 234 44 L 230 46 L 224 47 L 220 47 L 217 50 L 214 51 L 215 55 L 213 56 L 208 53 L 205 52 L 199 55 L 198 60 L 195 58 L 192 56 L 192 54 L 190 52 L 187 51 L 183 50 L 181 53 L 178 53 L 175 56 Z',

  // ── Eurasia: Asia mainland (from Levant through Russia, Siberia,
  //    Korea, China, Indochina, India, Arabia). Drawn as one big
  //    closed polygon so the Asian continent reads as one mass.
  'M 208 49 L 213 54 L 216 60 L 218 64 L 222 68 L 226 75 L 228 76 L 224 78 L 229 80 L 234 80 L 240 71 L 248 67 L 252 70 L 252 76 L 248 80 L 252 84 L 257 86 L 263 80 L 270 72 L 275 70 L 278 74 L 280 80 L 280 86 L 284 89 L 289 84 L 289 76 L 287 70 L 286 64 L 290 60 L 296 56 L 300 52 L 301 48 L 305 48 L 311 44 L 315 38 L 314 32 L 312 28 L 322 25 L 330 25 L 338 24 L 345 22 L 355 18 L 360 14 L 360 22 L 354 28 L 348 32 L 340 36 L 330 38 L 315 40 L 305 42 L 295 44 L 287 46 L 280 46 L 270 44 L 260 42 L 250 40 L 240 38 L 230 38 L 222 41 L 215 45 L 210 47 Z',

  // ── Korean peninsula (small protrusion off Asia) ────────────────
  'M 299 52 L 304 53 L 305 60 L 302 64 L 299 60 Z',

  // ── Japan (4 islands simplified to 2 paths) ─────────────────────
  'M 312 52 L 318 54 L 322 60 L 320 65 L 314 62 L 310 56 Z',
  'M 322 65 L 326 68 L 326 73 L 320 71 Z',

  // ── Taiwan ──────────────────────────────────────────────────────
  'M 301 80 L 304 82 L 304 86 L 301 86 Z',

  // ── Philippines (cluster) ───────────────────────────────────────
  'M 301 88 L 305 90 L 306 96 L 302 100 L 299 96 Z',

  // ── Indonesian archipelago ──────────────────────────────────────
  // Sumatra
  'M 275 96 L 285 100 L 290 106 L 286 108 L 277 104 L 273 100 Z',
  // Java
  'M 286 110 L 295 110 L 300 112 L 294 114 L 287 113 Z',
  // Borneo
  'M 290 96 L 298 96 L 302 102 L 298 106 L 293 104 Z',
  // Sulawesi
  'M 304 100 L 307 102 L 308 106 L 306 106 L 304 103 Z',
  // Papua (western half)
  'M 312 102 L 320 102 L 325 106 L 322 108 L 314 106 Z',

  // ── Australia ───────────────────────────────────────────────────
  'M 290 122 L 300 121 L 312 122 L 320 124 L 326 128 L 328 134 L 324 138 L 318 140 L 308 142 L 298 141 L 290 138 L 286 132 L 287 126 Z',

  // ── New Zealand ─────────────────────────────────────────────────
  'M 350 138 L 352 142 L 350 146 L 347 144 Z',
  'M 352 148 L 354 152 L 351 154 L 350 152 Z',

  // ── Cuba + Hispaniola ───────────────────────────────────────────
  'M 100 62 L 108 63 L 110 65 L 105 65 L 101 64 Z',
  'M 112 66 L 116 67 L 115 69 L 112 68 Z',
];

/**
 * Per-region viewport (the lat/lon window the SVG should crop to).
 * The SVG viewBox is computed from this in the host as:
 *   `${lonToX(lonMin)} ${latToY(latMax)} ${lonMax - lonMin} ${latMax - latMin}`
 * which crops the world to exactly this region in world coordinates.
 */
export interface RegionBBox {
  label: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export const REGION_BBOXES: Record<number, RegionBBox> = {
  1: { label: 'NORTH AMERICA',  latMin:   8, latMax: 72, lonMin: -165, lonMax:  -55 },
  2: { label: 'LATIN AMERICA',  latMin: -56, latMax: 18, lonMin:  -88, lonMax:  -34 },
  3: { label: 'EUROPE',         latMin:  34, latMax: 70, lonMin:  -12, lonMax:   38 },
  4: { label: 'MIDDLE EAST',    latMin:  12, latMax: 42, lonMin:   32, lonMax:   62 },
  5: { label: 'AFRICA',         latMin: -36, latMax: 38, lonMin:  -20, lonMax:   54 },
  6: { label: 'SOUTH ASIA',     latMin:   5, latMax: 38, lonMin:   62, lonMax:   98 },
  7: { label: 'EAST ASIA',      latMin:  18, latMax: 54, lonMin:   98, lonMax:  148 },
  8: { label: 'SOUTHEAST ASIA', latMin: -11, latMax: 24, lonMin:   92, lonMax:  142 },
  9: { label: 'OCEANIA',        latMin: -47, latMax:  0, lonMin:  110, lonMax:  180 },
};
