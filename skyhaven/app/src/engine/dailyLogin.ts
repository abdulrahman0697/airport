/**
 * Daily-login streak rewards (BRD §7).
 *
 * The gameLoop's `start` calls `applyDailyLogin` after restoring the
 * save. The first login of a new calendar day:
 *  - bumps the streak counter (or resets to 1 if a day was missed)
 *  - sets `pendingDailyReward` for the UI modal to claim
 *
 * Rewards scale with streak day (cap at day 7 for now; the long
 * calendar lands with the broader retention pass in Phase 14).
 */
import type { SaveState } from './types';

const STREAK_REWARDS: readonly number[] = [
  0,        // day 0 doesn't exist
  5_000,    // day 1
  10_000,   // day 2
  20_000,   // day 3
  40_000,   // day 4
  75_000,   // day 5
  120_000,  // day 6
  200_000,  // day 7+
];

function isoDate(epochMs: number): string {
  const d = new Date(epochMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isYesterday(prev: string, today: string): boolean {
  // Compare via Date math — handles month/year boundaries.
  const a = new Date(prev + 'T00:00:00Z');
  const b = new Date(today + 'T00:00:00Z');
  const diff = (b.getTime() - a.getTime()) / (24 * 3600 * 1000);
  return Math.round(diff) === 1;
}

export function applyDailyLogin(state: SaveState, nowMs: number): SaveState {
  const today = isoDate(nowMs);
  if (state.lastLoginDate === today) return state;

  let streak: number;
  if (state.lastLoginDate && isYesterday(state.lastLoginDate, today)) {
    streak = state.loginStreak + 1;
  } else {
    streak = 1;
  }
  const dayIndex = Math.min(streak, STREAK_REWARDS.length - 1);
  const amount = STREAK_REWARDS[dayIndex]!;

  return {
    ...state,
    lastLoginDate: today,
    loginStreak: streak,
    // Cash is awarded when the user dismisses the modal so the streak
    // value displayed is the freshly-incremented one.
    pendingDailyReward: { day: streak, amount },
  };
}

export { STREAK_REWARDS };
