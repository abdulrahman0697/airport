/**
 * Classic / vintage aircraft (BRD §4.2 + §4.9).
 *
 * Twelve historically significant types, awarded as the player's
 * lifetime earnings cross fixed milestones. Each one carries an
 * original short flavour bio; once collected it grants a permanent
 * +1% global revenue bonus.
 *
 * The set is the long-game completion chase — twelve drops at $10M,
 * $60M, $110M, … $560M lifetime earnings.
 */

export interface ClassicDef {
  readonly id: string;
  readonly displayName: string;
  readonly year: number;
  readonly tagline: string;
  readonly bio: string;
}

export const CLASSIC_DEFS: readonly ClassicDef[] = [
  {
    id: 'cl.dc-3',
    displayName: 'DC-3',
    year: 1936,
    tagline: 'The one that started commercial aviation',
    bio: 'Dependable, simple, everywhere. The aircraft that made airlines a business.',
  },
  {
    id: 'cl.constellation',
    displayName: 'Lockheed Constellation',
    year: 1943,
    tagline: 'Triple-tail icon of the propliner era',
    bio: 'Pressurised, fast, and unmistakable. The transatlantic flagship before the jets arrived.',
  },
  {
    id: 'cl.dc-6',
    displayName: 'DC-6',
    year: 1946,
    tagline: 'The piston liner that wouldn\'t die',
    bio: 'Heavy haul work and freight runs decades after its passenger career ended.',
  },
  {
    id: 'cl.b707',
    displayName: 'B707-320',
    year: 1958,
    tagline: 'The first jet that mattered',
    bio: 'New York to London in eight hours. The world shrunk to the size of a cabin window.',
  },
  {
    id: 'cl.vc10',
    displayName: 'Vickers VC10',
    year: 1962,
    tagline: 'Tail-mounted four-jet elegance',
    bio: 'Hot-and-high performance that opened African and Caribbean routes the 707 couldn\'t serve.',
  },
  {
    id: 'cl.b727',
    displayName: 'B727-200',
    year: 1963,
    tagline: 'The first trijet workhorse',
    bio: 'Three engines, T-tail, built for short runways. Backbone of US domestic service for a generation.',
  },
  {
    id: 'cl.concorde',
    displayName: 'Concorde',
    year: 1969,
    tagline: 'Mach 2 over the Atlantic',
    bio: 'Three hours, twenty minutes. Champagne at sixty thousand feet. Still the high-water mark.',
  },
  {
    id: 'cl.tu-144',
    displayName: 'Tu-144',
    year: 1968,
    tagline: 'Concorde\'s Cold-War shadow',
    bio: 'First supersonic transport to fly. Beautiful, ambitious, and ultimately grounded.',
  },
  {
    id: 'cl.b747-100',
    displayName: 'B747-100',
    year: 1969,
    tagline: 'Queen of the Skies',
    bio: 'The hump. The staircase. The 400-seat cabin that built the modern long-haul network.',
  },
  {
    id: 'cl.dc-10',
    displayName: 'DC-10',
    year: 1970,
    tagline: 'Widebody trijet that paid for itself',
    bio: 'Range, payload, three engines for ETOPS-free routing. Still flies cargo to this day.',
  },
  {
    id: 'cl.l-1011',
    displayName: 'L-1011 TriStar',
    year: 1968,
    tagline: 'The pilot\'s widebody',
    bio: 'Active controls and a hush-quiet cabin. Lockheed\'s last airliner — and the best of them.',
  },
  {
    id: 'cl.b747sp',
    displayName: 'B747SP',
    year: 1975,
    tagline: 'Short-fuselage, ultra-long-range Queen',
    bio: 'Built to fly New York to Tokyo nonstop in the seventies. Rare, distinctive, sublime.',
  },
];

const BY_ID = new Map(CLASSIC_DEFS.map((c) => [c.id, c]));

export function getClassicDef(id: string): ClassicDef | undefined {
  return BY_ID.get(id);
}

/** Lifetime-earnings milestone schedule. */
export const VINTAGE_FIRST_MILESTONE = 10_000_000;
export const VINTAGE_MILESTONE_STEP = 50_000_000;
/** Post-completion cash bonus when a milestone fires but every classic is owned. */
export const VINTAGE_POST_COMPLETION_BONUS = 1_000_000;
