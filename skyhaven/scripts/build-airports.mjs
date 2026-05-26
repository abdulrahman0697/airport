#!/usr/bin/env node
/**
 * Build the airport dataset from the OurAirports CC0 source.
 *
 * Input:  scripts/data/airports.csv  (place the CSV here; license preserved)
 * Output: app/src/data/airports.top.json   (top ~500 large airports by region)
 *         app/src/data/airports.full.json  (~3000 airports with IATA + scheduled service)
 *
 * Both files are sorted deterministically for stable diffs.
 *
 * Schema fields per BRD §17.2:
 *   iata, lat, lon, city, country, region (1-9), sizeTier (1-5), runwayCategory (1-4)
 *
 * Run from skyhaven/: node scripts/build-airports.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, 'data/airports.csv');
const OUT_TOP = resolve(__dirname, '../app/src/data/airports.top.json');
const OUT_FULL = resolve(__dirname, '../app/src/data/airports.full.json');

if (!existsSync(CSV_PATH)) {
  console.error(`Missing input CSV: ${CSV_PATH}`);
  console.error(`Fetch it: curl -sSL -o scripts/data/airports.csv https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv`);
  process.exit(1);
}

// Region mapping by ISO country code, per BRD §4.4.
//   1 North America   2 Latin America   3 Europe   4 Middle East
//   5 Africa          6 South Asia      7 East Asia 8 Southeast Asia
//   9 Oceania
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

// Curated list of major international hubs whose OurAirports name
// doesn't include the word "International"/"Intl". This list is the
// allow-list referenced by the `isIntl` flag below.
const MAJOR_HUBS = new Set([
  // Europe
  'AMS','LHR','LGW','STN','LTN','LCY','MAN','EDI','GLA','BHX','DUB','SNN',
  'CDG','ORY','LYS','MRS','NCE','TLS','BOD','NTE',
  'FRA','MUC','DUS','HAM','TXL','BER','CGN','STR','HAJ',
  'MAD','BCN','PMI','AGP','VLC','SVQ','BIO',
  'FCO','MXP','LIN','BGY','VCE','NAP','PSA','BLQ',
  'ZRH','GVA','BSL','VIE','BRU','LUX','LIS','OPO','FAO',
  'CPH','ARN','OSL','HEL','KEF','WAW','KRK','GDN','PRG','BUD','OTP','SOF','ATH','SKG',
  'SVO','DME','VKO','LED','IST','SAW','ADB','AYT','ESB',
  // Middle East
  'DXB','AUH','DOH','RUH','JED','DMM','MED','AMM','BEY','KWI','BAH','MCT',
  // North America
  'JFK','LGA','EWR','LAX','SFO','SJC','OAK','ORD','MDW','ATL','DFW','IAH','HOU','DEN','SEA','MIA','MCO','FLL','BOS','PHX','MSP','DTW','PHL','BWI','IAD','DCA','CLT','SAN','LAS','SLC','PDX','TPA','STL','MCI','SMF','RDU','MEM','BNA','AUS','SAT','OMA','IND','CMH','CVG','PIT','BUF','MKE','PVD','MSY','ABQ','JAX','RIC','SDF','TUL','OKC','ELP','ICT',
  'YYZ','YUL','YVR','YYC','YEG','YOW','YHZ','YWG','YQB',
  'MEX','CUN','GDL','MTY','TIJ','PVR','SJD',
  // Latin America
  'GRU','GIG','CGH','BSB','SDU','VCP','POA','REC','FOR','SSA','CNF','BEL','CWB','MAO',
  'EZE','AEP','SCL','LIM','BOG','MDE','CTG','UIO','GYE','CCS','MVD','ASU','LPB','SDQ','PUJ','HAV','SJU','SJO','PTY',
  // Africa
  'JNB','CPT','DUR','LOS','ABV','ACC','ADD','NBO','DAR','EBB','KGL','LUN','HRE','MPM','TNR','CMN','RAK','TUN','ALG','CAI','HRG','SSH','LXR','CAS','DKR','ABJ','LAD',
  // South Asia
  'BOM','DEL','BLR','MAA','HYD','CCU','COK','GOI','TRV','AMD','PNQ','LKO','JAI','VTZ','IXC','CMB','MLE','KTM','DAC','CGP','ZYL','ISB','KHI','LHE','PEW','UET','KBL',
  // East Asia
  'PEK','PKX','PVG','SHA','CAN','SZX','CTU','XIY','KMG','HGH','NKG','WUH','CKG','HRB','SHE','DLC','TSN','HAK','SYX','TAO','XMN','FOC','NNG','CSX','URC','YNT','TYN',
  'HKG','MFM','TPE','TSA','KHH','RMQ',
  'HND','NRT','KIX','ITM','NGO','CTS','FUK','OKA','SDJ','KOJ','HIJ','TOY',
  'ICN','GMP','PUS','CJU','TAE',
  'ULN',
  // Southeast Asia
  'BKK','DMK','HKT','CNX','USM','KBV','HDY','UTP',
  'SIN','KUL','PEN','BKI','KCH','LGK','JHB',
  'CGK','HLP','DPS','SUB','UPG','BPN','MES','SRG','BTH',
  'MNL','CEB','DVO','CRK','KLO','ILO',
  'HAN','SGN','DAD','CXR','VCA','PQC',
  'RGN','MDL','PNH','REP','VTE','LPQ','BWN',
  // Oceania
  'SYD','MEL','BNE','PER','OOL','CNS','ADL','DRW','HBA','AKL','WLG','CHC','ZQN','ROT','DUD','NPL','NAN','NOU','PPT','POM','SUV','APW','HNL','GUM','SPN',
]);

function regionOf(iso) {
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

// RFC 4180 minimal CSV parser sufficient for OurAirports (well-formed CSV).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') { /* skip */ }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const raw = readFileSync(CSV_PATH, 'utf8');
const rows = parseCsv(raw);
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

// OurAirports `type`: small_airport / medium_airport / large_airport / heliport / seaplane_base / closed / balloonport
// Map to sizeTier 1..5 (5 = largest, multi-runway international).
const SIZE_TIER = { large_airport: 4, medium_airport: 2, small_airport: 1 };

// Runway category 1..4 — for Phase 1 we approximate from size; refined when runways.csv lands.
const RUNWAY_BY_SIZE = { 4: 4, 2: 3, 1: 2 };

const all = [];
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || row.length < header.length) continue;
  const type = row[idx.type];
  const iata = (row[idx.iata_code] || '').trim().toUpperCase();
  const scheduled = row[idx.scheduled_service];
  const iso = row[idx.iso_country];
  if (!iata || iata.length !== 3) continue;
  if (!(type in SIZE_TIER)) continue;
  if (scheduled !== 'yes') continue;
  const region = regionOf(iso);
  if (!region) continue;

  const lat = parseFloat(row[idx.latitude_deg]);
  const lon = parseFloat(row[idx.longitude_deg]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

  const sizeTier = SIZE_TIER[type];
  const runwayCategory = RUNWAY_BY_SIZE[sizeTier];

  const name = (row[idx.name] || '').trim();
  // OurAirports flags airports as "international" only when the literal
  // word appears in the name, which silently excludes major hubs like
  // Amsterdam Schiphol, London Heathrow, Paris-CDG, Frankfurt, Tokyo
  // Haneda, etc. We fall back to a curated allow-list of recognised
  // international gateways so the hub picker shows them.
  const isIntl = /\b(international|intl)\b/i.test(name) || MAJOR_HUBS.has(iata);

  all.push({
    iata,
    lat: +lat.toFixed(4),
    lon: +lon.toFixed(4),
    city: (row[idx.municipality] || '').trim(),
    country: iso,
    region,
    sizeTier,
    runwayCategory,
    name,
    intl: isIntl,
  });
}

// Dedupe by IATA (some IATA codes appear twice across history — keep the largest).
const byIata = new Map();
for (const a of all) {
  const prev = byIata.get(a.iata);
  if (!prev || a.sizeTier > prev.sizeTier) byIata.set(a.iata, a);
}
const deduped = [...byIata.values()];

// Sort by sizeTier desc, then by IATA for deterministic ordering.
deduped.sort((a, b) => (b.sizeTier - a.sizeTier) || a.iata.localeCompare(b.iata));

// "Top" set = every large_airport with scheduled service (~1,180).
// We previously alphabetically truncated at 500 which silently dropped
// LHR / LAX / MAD and other late-letter hubs. The full large set is
// only ~140 KB gzipped and gives the map honest coverage of major hubs.
const top = deduped.filter((a) => a.sizeTier === 4);
const regionPick = new Map();
for (const a of top) regionPick.set(a.region, (regionPick.get(a.region) || 0) + 1);

top.sort((a, b) => a.iata.localeCompare(b.iata));

writeFileSync(OUT_TOP, JSON.stringify(top) + '\n');
writeFileSync(OUT_FULL, JSON.stringify(deduped) + '\n');

const sizes = (path) => {
  const stat = readFileSync(path);
  return `${(stat.length / 1024).toFixed(1)} KB`;
};
console.log(`Wrote ${top.length} airports → app/src/data/airports.top.json (${sizes(OUT_TOP)})`);
console.log(`Wrote ${deduped.length} airports → app/src/data/airports.full.json (${sizes(OUT_FULL)})`);
const regionCounts = top.reduce((m, a) => { m[a.region] = (m[a.region] || 0) + 1; return m; }, {});
console.log('Top-500 region distribution:', regionCounts);
