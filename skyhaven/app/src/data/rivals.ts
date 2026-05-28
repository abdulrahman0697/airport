/**
 * Rival Airlines simulation — Design Review v3, point 20.
 *
 * Showing an empty global leaderboard kills the social fantasy. Until
 * we have real player density, we render a synthetic rival board: a
 * handful of fictional carriers (FalconJet, Atlas Airlink, MetroWings,
 * Northern Light Air, Pacific Crown, Solano Express) ranked around the
 * player's current score so they always have an immediate target.
 *
 * The list is deterministic per (board, seed) but the scores adapt to
 * the player's current value so the comp band feels alive: rivals
 * sit at ±60% of the player's score, with the leader always above.
 */

export interface RivalAirline {
  readonly id: string;
  readonly name: string;
  readonly tail: string;
  readonly code: string;
  readonly motto: string;
}

export const RIVAL_AIRLINES: readonly RivalAirline[] = [
  { id: 'falconjet',    name: 'FalconJet',         tail: '#F59E0B', code: 'FJ', motto: 'Fast, lean, hungry.' },
  { id: 'atlas',        name: 'Atlas Airlink',     tail: '#8B5CF6', code: 'AT', motto: 'Connect the world.' },
  { id: 'metrowings',   name: 'MetroWings',        tail: '#34D399', code: 'MW', motto: 'Cities, closer.' },
  { id: 'northern',     name: 'Northern Light Air',tail: '#5AC8FA', code: 'NL', motto: 'Up, where the sky is wide.' },
  { id: 'pacific',      name: 'Pacific Crown',     tail: '#F4C75B', code: 'PC', motto: 'A crown for every coast.' },
  { id: 'solano',       name: 'Solano Express',    tail: '#F87171', code: 'SE', motto: 'Solana to sunset, every day.' },
  { id: 'kestrel',      name: 'Kestrel Atlantic',  tail: '#A78BFA', code: 'KA', motto: 'Long-haul, the elegant way.' },
  { id: 'mistral',      name: 'Mistral Airways',   tail: '#67E8F9', code: 'MA', motto: 'The wind in your favour.' },
];

/**
 * Build a rival board: ~7 rivals around the player's current score.
 * Returns sorted descending by score. The player is NOT included —
 * the UI inserts them with a "you" pill.
 */
export function buildRivalBoard(playerScore: number, boardKey: string): Array<{
  rival: RivalAirline; score: number;
}> {
  // Deterministic per board so the band feels stable when the player
  // refreshes.
  let h = 2166136261;
  for (let i = 0; i < boardKey.length; i++) {
    h ^= boardKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = (n: number): number => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (Math.abs(h) % 10000) / 10000 * n;
  };

  // Floor so rivals don't all collapse to 0 when the player is new.
  const base = Math.max(playerScore, 1000);

  // Always-on leader plus a band around the player.
  const leaderScore = base * (1.6 + rng(0.6));
  const offsets = [1.05, 0.92, 0.78, 0.64, 0.5, 0.36];

  const seven: Array<{ rival: RivalAirline; score: number }> = [];
  const leaderIdx = Math.floor(rng(RIVAL_AIRLINES.length));
  const leader = RIVAL_AIRLINES[leaderIdx]!;
  seven.push({ rival: leader, score: Math.round(leaderScore) });

  let i = 1;
  for (const off of offsets) {
    const rival = RIVAL_AIRLINES[(leaderIdx + i) % RIVAL_AIRLINES.length]!;
    const jitter = 0.9 + rng(0.2);
    const score = Math.round(base * off * jitter);
    seven.push({ rival, score });
    i++;
  }

  return seven.sort((a, b) => b.score - a.score);
}

/** "Beat X by reaching Y" target the UI surfaces above the rival list. */
export function nextTarget(playerScore: number, board: ReturnType<typeof buildRivalBoard>): {
  rival: RivalAirline; need: number;
} | null {
  const ahead = board.find((b) => b.score > playerScore);
  if (!ahead) return null;
  return { rival: ahead.rival, need: ahead.score - playerScore };
}
