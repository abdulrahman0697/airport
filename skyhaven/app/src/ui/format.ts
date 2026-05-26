/**
 * Idle-game letter-suffix number formatter (BRD §4.1).
 *
 * Ladder: K, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc, then aa, ab, ac…
 * Negative numbers prepend a "-"; sub-thousand values render as-is.
 *
 * Display uses tabular numerals at call sites; this helper only
 * produces the digit string.
 */

const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
];

function alphaSuffix(index: number): string {
  // index 0 → "aa", 1 → "ab", … 25 → "az", 26 → "ba", …
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return 'a' + s;
}

export function formatCash(n: number, decimals = 3): string {
  if (!isFinite(n)) return '—';
  const neg = n < 0;
  const abs = Math.abs(n);
  if (abs < 1000) return (neg ? '-' : '') + abs.toFixed(0);
  const tier = Math.floor(Math.log10(abs) / 3);
  const suffix = tier < SUFFIXES.length ? SUFFIXES[tier]! : alphaSuffix(tier - SUFFIXES.length);
  const scaled = abs / Math.pow(1000, tier);
  // 4 significant digits in the readout — bumps from "1.95K" → "1.953K".
  const trimmed = scaled >= 100 ? scaled.toFixed(Math.max(0, decimals - 2))
    : scaled >= 10 ? scaled.toFixed(Math.max(1, decimals - 1))
    : scaled.toFixed(Math.max(2, decimals));
  return (neg ? '-' : '') + trimmed + suffix;
}

/** Per-minute cash rate (BRD §4.1 — UI prefers /min over /s readout). */
export function formatRate(perSec: number): string {
  if (!isFinite(perSec)) return '—';
  const perMin = perSec * 60;
  return formatCash(perMin) + '/min';
}
