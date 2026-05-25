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

export function formatCash(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  const neg = n < 0;
  const abs = Math.abs(n);
  if (abs < 1000) return (neg ? '-' : '') + abs.toFixed(0);
  const tier = Math.floor(Math.log10(abs) / 3);
  const suffix = tier < SUFFIXES.length ? SUFFIXES[tier]! : alphaSuffix(tier - SUFFIXES.length);
  const scaled = abs / Math.pow(1000, tier);
  const trimmed = scaled >= 100 ? scaled.toFixed(0)
    : scaled >= 10 ? scaled.toFixed(Math.min(1, decimals))
    : scaled.toFixed(decimals);
  return (neg ? '-' : '') + trimmed + suffix;
}

/** Round per-second rates to a stable readout (one decimal up to 100/s, then integer). */
export function formatRate(perSec: number): string {
  if (!isFinite(perSec)) return '—';
  return formatCash(perSec, perSec >= 100 ? 0 : 1) + '/s';
}
