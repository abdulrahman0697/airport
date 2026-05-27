/**
 * Leaderboard board definitions (BRD §12.1).
 *
 * Four boards, each tracking a different facet of player progress.
 * Submissions go through the `submitLeaderboardScore` Cloud Function
 * which validates against the per-board plausibility cap below — see
 * `functions/src/leaderboards.ts` for the server-side enforcement.
 *
 * `selector` extracts the score from a SaveState on the client. Keep
 * the math here cheap and deterministic; the server independently
 * sanity-checks the result.
 */
import type { SaveState } from '../engine/types';

export type BoardId = 'lifetime' | 'perMinute' | 'eco' | 'vintage';

export interface BoardDef {
  readonly id: BoardId;
  readonly label: string;
  readonly description: string;
  /** Formats a raw score for UI display. */
  readonly format: (score: number) => string;
  /** Pulls the current score out of a save state. */
  readonly selector: (s: SaveState, perMin: number) => number;
}

import { formatCash } from '../ui/format';

export const BOARDS: readonly BoardDef[] = [
  {
    id: 'lifetime',
    label: 'Lifetime Earnings',
    description: 'Total cash earned over the airline\'s history.',
    format: (n) => `$${formatCash(n)}`,
    selector: (s) => s.lifetimeEarnings,
  },
  {
    id: 'perMinute',
    label: 'Income per Minute',
    description: 'Current revenue rate across every active route.',
    format: (n) => `$${formatCash(n)} /min`,
    selector: (_s, perMin) => perMin,
  },
  {
    id: 'eco',
    label: 'Eco Rating',
    description: 'Sustainability score from cargo / passenger mix.',
    format: (n) => `${Math.round(n)} / 100`,
    selector: (s) => s.ecoRating,
  },
  {
    id: 'vintage',
    label: 'Vintage Collection',
    description: 'Classics rescued from the hangar.',
    format: (n) => `${Math.round(n)} classics`,
    selector: (s) => s.vintage.length,
  },
];

const BY_ID = new Map(BOARDS.map((b) => [b.id, b]));
export function getBoard(id: BoardId): BoardDef | undefined {
  return BY_ID.get(id);
}
