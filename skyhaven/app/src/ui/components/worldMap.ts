/**
 * World map data for the HubPicker's Founder Market Map.
 *
 * The whole world is drawn in an **equirectangular projection** where:
 *
 *   x = longitude + 180     (lon -180° → x 0,  lon 180° → x 360)
 *   y = 90 - latitude       (lat  90° → y 0,  lat -90° → y 180)
 *
 * The host SVG sets its `viewBox` to the lat/lon window of the
 * selected region (projected through the same transform), so all
 * continent paths AND all airport pins land in the right place
 * automatically.
 *
 * Continent / island outlines are stored as arrays of `[lon, lat]`
 * tuples and turned into SVG paths by the `pts()` helper. That keeps
 * the geographic source readable — you can see "Beirut: 35.5, 33.9"
 * rather than guessing at SVG path coordinates. Resolution is ~30–80
 * points per landmass; we trade some coastline detail for an inline
 * file size that ships with the bundle.
 */

export const WORLD_W = 360;
export const WORLD_H = 180;

export function lonToX(lon: number): number { return lon + 180; }
export function latToY(lat: number): number { return 90 - lat; }

type LL = readonly [number, number]; // [lon, lat]

function pts(coords: ReadonlyArray<LL>): string {
  return 'M ' + coords.map(([lon, lat]) =>
    `${(lon + 180).toFixed(2)} ${(90 - lat).toFixed(2)}`,
  ).join(' L ') + ' Z';
}

/* ─── Continent outlines (clockwise, ending where they start) ────── */

// North America — Alaska around to Newfoundland, down to Florida,
// across Mexico, up the Pacific coast.
const NORTH_AMERICA: ReadonlyArray<LL> = [
  [-168, 65.5], [-167, 60], [-165, 60], [-159, 60], [-156, 57], [-152, 60],
  [-148, 61], [-148, 60], [-142, 60], [-140, 60], [-136, 58], [-133, 56],
  [-130, 54], [-128, 52], [-125, 50], [-124, 48], [-124, 46], [-124, 42],
  [-123, 39], [-121, 36], [-118, 34], [-117, 32.5], [-115, 30], [-114, 28],
  [-110, 23], [-107, 23], [-105, 19], [-100, 17], [-95, 16], [-92, 15],
  [-90, 14], [-88, 16], [-87, 17], [-87, 21], [-90, 21], [-92, 19],
  [-92, 21], [-94, 19], [-96, 19], [-96, 21], [-97, 26], [-94, 29],
  [-90, 29], [-89, 30], [-87, 30.5], [-84, 30], [-83, 28], [-82, 27],
  [-80, 25], [-80, 27], [-80, 31], [-79, 33], [-76, 35], [-75, 37],
  [-74, 39], [-72, 41], [-70, 43], [-67, 45], [-65, 44], [-63, 45],
  [-60, 46], [-56, 47], [-53, 47], [-56, 50], [-58, 52], [-62, 56],
  [-64, 58], [-66, 60], [-68, 62], [-73, 62], [-77, 62], [-77, 59],
  [-83, 56], [-83, 62], [-85, 67], [-86, 70], [-90, 72], [-95, 73],
  [-104, 73], [-110, 71], [-118, 71], [-123, 70], [-128, 70], [-132, 70],
  [-135, 69], [-140, 70], [-143, 70], [-146, 70], [-150, 71], [-156, 71],
  [-160, 71], [-165, 68], [-168, 65.5],
];

// Greenland — coarse but recognizable
const GREENLAND: ReadonlyArray<LL> = [
  [-43, 60], [-40, 60], [-36, 62], [-30, 63], [-22, 65], [-21, 70],
  [-22, 75], [-30, 81], [-38, 83], [-45, 83], [-52, 82], [-58, 79],
  [-63, 76], [-65, 73], [-55, 70], [-53, 67], [-49, 65], [-46, 62],
];

// South America — Caribbean down to Cape Horn and back up the Pacific
const SOUTH_AMERICA: ReadonlyArray<LL> = [
  [-72, 12], [-68, 11], [-62, 11], [-60, 8], [-55, 6], [-52, 5],
  [-50, 4], [-50, 0], [-48, -2], [-44, -2], [-40, -3], [-37, -5],
  [-35, -8], [-37, -12], [-38, -15], [-39, -18], [-40, -22], [-44, -23],
  [-48, -25], [-48, -28], [-52, -31], [-57, -34], [-58, -38], [-62, -39],
  [-63, -42], [-65, -42], [-66, -45], [-68, -50], [-69, -52], [-70, -55],
  [-71, -54], [-73, -53], [-75, -52], [-74, -48], [-73, -45], [-73, -42],
  [-74, -40], [-74, -36], [-72, -32], [-71, -28], [-71, -23], [-70, -20],
  [-71, -18], [-71, -15], [-75, -14], [-77, -12], [-79, -7], [-81, -5],
  [-81, -3], [-80, -1], [-78, 1], [-78, 4], [-77, 7], [-76, 8],
  [-72, 12],
];

// Africa — Mediterranean across to Suez, down the Red Sea, around
// the Horn, southern Africa, up the Atlantic coast.
const AFRICA: ReadonlyArray<LL> = [
  [-9.5, 30], [-7, 33], [-5, 35], [-2, 35.5], [0, 36], [3, 36.5],
  [8, 37], [11, 37], [12, 33], [15, 32], [20, 31], [25, 31.5],
  [29, 31], [31, 31.5], [33, 31], [33, 28], [35, 24], [37, 22],
  [38, 18], [40, 15], [42.5, 13], [43, 12.5], [45, 11], [48, 11],
  [51, 11], [51, 9], [52, 5], [51, 2], [49, 0], [44, -3],
  [40, -6], [39, -10], [40, -15], [40, -20], [35, -22], [33, -26],
  [32, -28], [28, -33], [22, -34], [19, -34.5], [17, -33], [14, -29],
  [12, -23], [13, -16], [11, -8], [9, -2], [8, 4], [4, 7],
  [-1, 5], [-3, 5], [-5, 5], [-7, 4], [-9, 6], [-14, 11],
  [-17, 14], [-17, 21], [-13, 26], [-12, 28], [-9.5, 30],
];

// Madagascar
const MADAGASCAR: ReadonlyArray<LL> = [
  [49, -12], [50, -16], [50, -20], [46, -25], [44, -23], [44, -18],
  [46, -15], [49, -12],
];

// United Kingdom (Great Britain)
const UK: ReadonlyArray<LL> = [
  [-5, 50], [-2.5, 50.5], [0, 51], [1.5, 51], [1.5, 52.5], [0, 53.5],
  [-3, 54], [-2, 55.5], [-3.5, 57], [-5.5, 58.5], [-5, 58], [-5, 56],
  [-4.5, 54], [-5, 51], [-5, 50],
];

// Ireland
const IRELAND: ReadonlyArray<LL> = [
  [-10, 52], [-7, 52], [-6, 53], [-6, 54.5], [-7, 55], [-9.5, 55],
  [-10, 53.5], [-10, 52],
];

// Iceland
const ICELAND: ReadonlyArray<LL> = [
  [-24, 63.5], [-19, 63.4], [-14, 64], [-13.5, 65.5], [-15, 66.5],
  [-21, 66.5], [-24, 65.5], [-24, 63.5],
];

// Eurasia outer coastline drawn as one closed polygon. Goes clockwise
// from Cape St Vincent, around northern Europe + Russia, down through
// Far East / Korea / China / SE Asia / India, up to Iran, INTO the
// Persian Gulf (the polygon needs to trace this notch so the gulf
// renders as sea, not land), around the Gulf and back out through
// Strait of Hormuz, around the entire Arabian Peninsula, up the Red
// Sea, overland through Israel to the Mediterranean, west through
// Turkey / Greece / Italy / France / Spain, and back to start.
const EURASIA: ReadonlyArray<LL> = [
  // ── Iberia west coast
  [-9.5, 37], [-9, 39], [-9.5, 41], [-9, 42.5], [-8.5, 43.5],
  // ── French Atlantic
  [-3, 43.5], [-1.5, 44], [-1, 46], [-4.7, 48.3], [-1.5, 49.7],
  // ── Channel, Belgium, Netherlands, North Germany, Denmark
  [2, 51], [3, 51.5], [5, 53.5], [7, 53.7], [9.5, 54], [11, 54],
  [9.5, 56], [10.5, 57.7],
  // ── Norway west coast going north, then around to Arctic
  [10.7, 59.5], [5.7, 59], [5, 60.5], [7, 63], [10.5, 63.5],
  [13.5, 66], [16, 68], [19, 69.6], [22, 71], [26, 71.2],
  // ── Russian Arctic
  [33, 70], [40, 67], [47, 67], [52, 70], [60, 70], [70, 73],
  [80, 73], [95, 76], [110, 75], [125, 75], [140, 73], [148, 72],
  [155, 71], [162, 70], [170, 69], [178, 68],
  // ── Far East Russia coming south
  [177, 64], [172, 62], [165, 60], [162, 59], [160, 56],
  [161, 53], [158, 52], [156, 51], [154, 53], [148, 60], [142, 59],
  [142, 53], [140, 54], [139, 51], [135, 47], [132, 43],
  // ── Korean peninsula
  [131, 43], [128, 42], [128, 38.5], [129, 36], [127, 34],
  [126, 35], [126, 37], [124, 37], [121, 39],
  // ── China east coast going south
  [122, 31], [120, 27], [117, 24], [114, 22], [110, 21], [108, 20],
  // ── Vietnam east coast
  [108, 15], [108, 11], [104, 9], [103, 1.5],
  // ── Malay peninsula west / Burma Andaman coast going north
  [100, 5], [98, 8], [97, 16], [94, 16], [94, 20], [92, 22],
  // ── Bangladesh, India east, around to south tip
  [91, 22], [88, 22], [87, 21], [83, 18], [80, 13], [78, 9.5], [76.5, 8.1],
  // ── India west coast going north
  [76, 10], [74, 13], [73, 19], [72.5, 21], [70, 22], [67, 25],
  // ── Pakistan / Iran south coast
  [65, 25], [62, 25], [60, 25.5], [58, 25.5], [56.5, 27.2],
  // ── Enter Persian Gulf on Iran side, sweep around the gulf:
  [54, 27], [52, 29], [50, 30],            // Iran western Gulf coast
  [48.5, 30.4],                            // Iraq head of Gulf
  [48, 29], [49, 27], [50, 26.3],          // Kuwait, Saudi east coast
  // ── Qatar peninsula (a notable tooth into the Gulf)
  [50.7, 26.5], [51, 26.3], [51.5, 26], [51.5, 25.2], [51, 24.7],
  // ── Continue west / south Saudi-UAE coast back out
  [52.5, 24.5], [54.5, 24.5], [55.4, 25.3],
  // ── Around the Musandam (Oman) peninsula sticking up into Hormuz
  [55.7, 25.7], [56.4, 26.3], [56.4, 25.7], [56.2, 25.4],
  // ── Out of the gulf, down Oman east coast (Arabian Sea side)
  [58, 23.5], [58.5, 22.5], [59.5, 22],
  // ── Around south Arabia
  [55, 17.5], [53, 17], [49, 13.5], [45, 12.5], [43.5, 12.5],
  // ── Up Red Sea east coast (Yemen → Saudi)
  [42.7, 15], [42, 17], [40, 22], [38.5, 24.5], [37, 27], [36, 28], [35, 29],
  // ── Gulf of Aqaba head, then overland to Mediterranean (Israel)
  [34.5, 29.5], [34.5, 31], [34.2, 31.4],
  // ── Levant Mediterranean coast going north
  [34.8, 32.1], [35.5, 33.5], [35.7, 34.5], [36, 35.5], [36, 36.4],
  // ── Turkey south Mediterranean coast
  [35.5, 36.7], [33, 36.5], [30, 36.8], [29, 36.5], [27, 38],
  // ── Aegean Turkey going north to Sea of Marmara entrance
  [26.5, 39.5], [26.5, 40.5],
  // ── Greek mainland south coast (cross Aegean to Peloponnese)
  [23, 38], [22, 37], [21, 37.5], [20, 38.5],
  // ── Up Greek west coast (Ionian) into Adriatic east
  [19, 40], [19.5, 42], [17.5, 42.5], [16, 43.5],
  // ── Adriatic loop into Italy east coast (cross at the head)
  [13.5, 45.5], [13, 45], [13, 43], [14, 42], [15.5, 41.5],
  // ── Italy heel
  [18, 40.5], [18.5, 40], [17.5, 39.5], [16, 38.7],
  // ── Italy toe + Calabria
  [16, 38], [15.6, 37.9], [16, 38.3], [14.5, 38.7],
  // ── Italy west coast going north (Tyrrhenian)
  [14, 40], [13, 40.5], [11, 42.5], [10, 43.5],
  // ── Genoa / Italian Riviera into south France
  [8, 44], [5, 43.3], [3, 43.2],
  // ── Spain Mediterranean coast
  [0, 39], [-2, 36.7],
  // ── Strait of Gibraltar / south Iberia
  [-5, 36], [-7, 36.5], [-9.5, 37],
];

// Japanese archipelago (Honshu + Hokkaido + Kyushu simplified into 3 islands)
const JAPAN_HOKKAIDO: ReadonlyArray<LL> = [
  [140, 41.5], [143, 41.5], [145, 43.5], [145, 45.5], [142, 45.5],
  [140, 44], [140, 41.5],
];
const JAPAN_HONSHU: ReadonlyArray<LL> = [
  [131, 34], [134, 34], [136, 34.5], [137, 34.5], [139, 35], [140, 35.5],
  [141, 38], [141, 41], [140, 41], [139, 39], [137, 37.5], [134, 35.5],
  [132, 35], [131, 34],
];
const JAPAN_KYUSHU: ReadonlyArray<LL> = [
  [129.5, 31], [131.5, 31], [131.5, 33], [130.5, 33.5], [130, 33.5],
  [129.5, 32.5], [129.5, 31],
];

// Taiwan
const TAIWAN: ReadonlyArray<LL> = [
  [120.5, 22], [121.5, 22], [122, 25], [121.5, 25.5], [120.5, 25],
  [120, 23.5], [120.5, 22],
];

// Philippines (Luzon simplified)
const PHILIPPINES: ReadonlyArray<LL> = [
  [120.5, 13], [121.5, 13.5], [122, 15], [121.5, 17], [120, 18.5],
  [119.5, 16], [120, 14], [120.5, 13],
];

// Sumatra
const SUMATRA: ReadonlyArray<LL> = [
  [95, 5.5], [98, 4], [102, 0], [105, -5], [105.5, -6], [102, -5],
  [99, -2], [96, 2], [95, 5.5],
];

// Java
const JAVA: ReadonlyArray<LL> = [
  [105, -6], [110, -6.5], [114, -7.5], [114.5, -8.5], [110, -8], [106, -7],
  [105, -6],
];

// Borneo
const BORNEO: ReadonlyArray<LL> = [
  [109, 2], [114, 1], [117, 1.5], [119, 4], [118, 7], [115, 7],
  [111, 4], [109, 2],
];

// Sulawesi (simplified to a single blob)
const SULAWESI: ReadonlyArray<LL> = [
  [119, -2], [121, -3], [123, -4], [124, -2], [123, 1], [121, 2],
  [120, 0], [119, -2],
];

// Western Papua (New Guinea)
const NEW_GUINEA: ReadonlyArray<LL> = [
  [131, -2], [136, -1], [141, -3], [144, -4], [148, -6], [150, -9],
  [144, -9], [137, -7.5], [132, -4], [131, -2],
];

// Australia
const AUSTRALIA: ReadonlyArray<LL> = [
  [113, -22], [114, -27], [116, -33], [118, -35], [123, -34], [130, -32],
  [133, -32], [137, -35], [140, -38], [144, -38], [148, -38], [150, -37],
  [150, -34], [153, -29], [153, -25], [146, -20], [144, -15], [142, -10],
  [136, -12], [131, -12], [129, -15], [125, -15], [121, -19], [113, -22],
];

// New Zealand North + South
const NZ_NORTH: ReadonlyArray<LL> = [
  [173, -35], [175, -36], [178, -37.5], [178, -40], [175, -41.5],
  [173, -39], [172.5, -37], [173, -35],
];
const NZ_SOUTH: ReadonlyArray<LL> = [
  [167, -47], [170, -46], [173, -42.5], [174, -41.5], [171, -44], [168, -46.5],
  [167, -47],
];

// Cuba
const CUBA: ReadonlyArray<LL> = [
  [-85, 22.5], [-80, 23], [-75, 22], [-74, 20.5], [-78, 21.5], [-82, 22],
  [-85, 22.5],
];

// Hispaniola
const HISPANIOLA: ReadonlyArray<LL> = [
  [-74, 19.5], [-70, 19.5], [-68, 18.5], [-71, 18], [-74, 18.5],
  [-74, 19.5],
];

export const WORLD_PATHS: ReadonlyArray<string> = [
  pts(NORTH_AMERICA),
  pts(GREENLAND),
  pts(SOUTH_AMERICA),
  pts(AFRICA),
  pts(MADAGASCAR),
  pts(EURASIA),
  pts(UK),
  pts(IRELAND),
  pts(ICELAND),
  pts(JAPAN_HOKKAIDO),
  pts(JAPAN_HONSHU),
  pts(JAPAN_KYUSHU),
  pts(TAIWAN),
  pts(PHILIPPINES),
  pts(SUMATRA),
  pts(JAVA),
  pts(BORNEO),
  pts(SULAWESI),
  pts(NEW_GUINEA),
  pts(AUSTRALIA),
  pts(NZ_NORTH),
  pts(NZ_SOUTH),
  pts(CUBA),
  pts(HISPANIOLA),
];

/* ─── Region viewports ────────────────────────────────────────────── */

export interface RegionBBox {
  label: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export const REGION_BBOXES: Record<number, RegionBBox> = {
  1: { label: 'NORTH AMERICA',  latMin:   8, latMax: 72, lonMin: -168, lonMax:  -52 },
  2: { label: 'LATIN AMERICA',  latMin: -56, latMax: 24, lonMin:  -88, lonMax:  -34 },
  3: { label: 'EUROPE',         latMin:  34, latMax: 72, lonMin:  -14, lonMax:   42 },
  4: { label: 'MIDDLE EAST',    latMin:  10, latMax: 44, lonMin:   28, lonMax:   66 },
  5: { label: 'AFRICA',         latMin: -36, latMax: 38, lonMin:  -20, lonMax:   54 },
  6: { label: 'SOUTH ASIA',     latMin:   4, latMax: 38, lonMin:   60, lonMax:   98 },
  7: { label: 'EAST ASIA',      latMin:  16, latMax: 54, lonMin:   96, lonMax:  148 },
  8: { label: 'SOUTHEAST ASIA', latMin: -11, latMax: 25, lonMin:   90, lonMax:  142 },
  9: { label: 'OCEANIA',        latMin: -48, latMax:  2, lonMin:  110, lonMax:  180 },
};
