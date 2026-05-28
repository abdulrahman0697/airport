/**
 * Deterministic-per-uid aircraft nickname + tail-number generator.
 *
 * The fleet, delivery ceremony, route cards and NetworkSkyView all
 * call this so the same aircraft uid always reads as the same name
 * across surfaces. Tail numbers blend the airline's two-letter code
 * with a hash-derived three-digit suffix so HavenJet shows HJ-104,
 * GulfWing shows GW-872, etc.
 */

const NICKNAMES_FIRST = [
  'Desert', 'Mistral', 'Pearl', 'Atlas', 'Falcon', 'Zephyr', 'Nimbus', 'Crescent',
  'Aurora', 'Phoenix', 'Solano', 'Albatross', 'Stardust', 'Compass', 'Horizon',
  'Skyborne', 'Echo', 'Equinox', 'Skylark', 'Cinder', 'Arabia', 'Levant', 'Ottoman',
  'Caspian', 'Sahara', 'Orient', 'Sirocco', 'Khamsin',
];
const NICKNAMES_SECOND = [
  'Swift', 'Voyager', 'Star', 'Pilgrim', 'Drift', 'Lance', 'Wing', 'Skylight',
  'Beacon', 'Halo', 'Talon', 'Strider', 'Sentinel', 'Dawn', 'Crown', 'Tempo',
  'Tide', 'Spark', 'Compass', 'Bright', 'Rove', 'Trace', 'Pulse', 'Course',
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function aircraftNickname(uid: string): string {
  const h = hash(uid);
  const a = NICKNAMES_FIRST[h % NICKNAMES_FIRST.length]!;
  const h2 = Math.abs(Math.imul(h, 2654435761));
  const b = NICKNAMES_SECOND[h2 % NICKNAMES_SECOND.length]!;
  return `${a} ${b}`;
}

export function aircraftTailNumber(uid: string, airlineCode: string): string {
  const h = hash(uid);
  const num = (h % 900) + 100;
  const code = (airlineCode || 'SH').slice(0, 2).toUpperCase();
  return `${code}-${num}`;
}

/**
 * Flight code for routes — uses the airline's two-letter code as the
 * carrier prefix and the route id hash as the flight number.
 *   HavenJet's first route → HJ101
 */
export function routeFlightCode(routeId: string, airlineCode: string): string {
  const h = hash(routeId);
  const num = (h % 900) + 100;
  const code = (airlineCode || 'SH').slice(0, 2).toUpperCase();
  return `${code}${num}`;
}
