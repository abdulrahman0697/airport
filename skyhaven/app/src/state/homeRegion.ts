/**
 * Derive the player's home region (BRD §5.2: "no location permission
 * used — derived from device timezone + locale").
 *
 * We use `Intl.DateTimeFormat().resolvedOptions().timeZone` which is
 * available on every modern WebView. Maps the IANA prefix and (where
 * needed) the specific zone to one of the nine SkyHaven regions:
 *   1 NA · 2 LATAM · 3 EU · 4 ME · 5 AF · 6 S.Asia · 7 E.Asia ·
 *   8 SE.Asia · 9 Oceania
 */

const NORTH_AMERICA = new Set([
  'America/New_York', 'America/Detroit', 'America/Kentucky',
  'America/Indiana', 'America/Chicago', 'America/Menominee',
  'America/Denver', 'America/Phoenix', 'America/Los_Angeles',
  'America/Anchorage', 'America/Juneau', 'America/Sitka',
  'America/Boise', 'America/Toronto', 'America/Vancouver',
  'America/Winnipeg', 'America/Edmonton', 'America/Halifax',
  'America/St_Johns', 'America/Whitehorse', 'America/Yellowknife',
  'America/Iqaluit', 'America/Nipigon', 'America/Rainy_River',
  'America/Regina', 'America/Swift_Current', 'America/Adak',
  'Pacific/Honolulu',
]);

const MIDDLE_EAST = new Set([
  'Asia/Riyadh', 'Asia/Dubai', 'Asia/Qatar', 'Asia/Kuwait',
  'Asia/Bahrain', 'Asia/Tehran', 'Asia/Jerusalem', 'Asia/Amman',
  'Asia/Beirut', 'Asia/Damascus', 'Asia/Baghdad', 'Asia/Muscat',
  'Asia/Aden', 'Asia/Gaza', 'Asia/Hebron', 'Asia/Nicosia',
]);

const SOUTH_ASIA = new Set([
  'Asia/Karachi', 'Asia/Kolkata', 'Asia/Colombo', 'Asia/Dhaka',
  'Asia/Kathmandu', 'Asia/Thimphu', 'Asia/Kabul',
]);

const EAST_ASIA = new Set([
  'Asia/Shanghai', 'Asia/Chongqing', 'Asia/Harbin', 'Asia/Urumqi',
  'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul',
  'Asia/Pyongyang', 'Asia/Ulaanbaatar', 'Asia/Macau',
]);

const SOUTHEAST_ASIA = new Set([
  'Asia/Bangkok', 'Asia/Singapore', 'Asia/Jakarta', 'Asia/Makassar',
  'Asia/Jayapura', 'Asia/Manila', 'Asia/Kuala_Lumpur', 'Asia/Kuching',
  'Asia/Brunei', 'Asia/Ho_Chi_Minh', 'Asia/Phnom_Penh', 'Asia/Vientiane',
  'Asia/Yangon',
]);

const OCEANIA_PREFIXES = ['Australia/', 'Pacific/'];

export function detectHomeRegion(): number {
  let tz = 'Europe/London';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? tz;
  } catch {
    // Some hardened WebView builds don't expose timeZone — accept fallback.
  }

  if (NORTH_AMERICA.has(tz)) return 1;
  if (MIDDLE_EAST.has(tz)) return 4;
  if (SOUTH_ASIA.has(tz)) return 6;
  if (EAST_ASIA.has(tz)) return 7;
  if (SOUTHEAST_ASIA.has(tz)) return 8;
  if (OCEANIA_PREFIXES.some((p) => tz.startsWith(p))) return 9;
  if (tz.startsWith('Africa/')) return 5;
  if (tz.startsWith('Atlantic/Cape_Verde') || tz.startsWith('Indian/')) return 5;
  if (tz.startsWith('America/')) {
    // The North-America set above caught the well-known US/Canada zones.
    // Whatever else falls through under America/* is the Caribbean,
    // Central or South America.
    return 2;
  }
  if (tz.startsWith('Europe/') || tz.startsWith('Atlantic/')) return 3;
  if (tz.startsWith('Asia/')) {
    // Anything Asian that didn't match a more specific set above lands
    // in South Asia by default — covers most Central-Asia zones.
    return 6;
  }
  return 3; // EU default
}
