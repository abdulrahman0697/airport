/**
 * AirlineCrest (Design pass D8).
 *
 * A small SVG mark generated deterministically from the airline name
 * + tail color. Used wherever the airline identity appears: Office
 * card, friends rows, leaderboard rows, gift sender pills.
 *
 * Two layers:
 *  1. A hexagonal shield filled with the tail color + a darker
 *     diagonal accent stripe.
 *  2. Up to two initials (first letter of the first one or two words
 *     of the airline name), centred on the shield with a glow.
 *
 * Pure presentation — no game-state dependency beyond the props.
 */
import { COLOR } from './tokens';

export interface AirlineCrestProps {
  /** Airline name; we extract initials from the first two words. */
  name: string;
  /** Tail color hex. */
  tailColor: string;
  /** Rendered size in px. Default 36. */
  size?: number;
  /** Optional title for screen readers. Defaults to the airline name. */
  title?: string;
  style?: React.CSSProperties;
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  // First letter of the first word + first letter of the second word
  // (if any). Handles "SkyHaven Airlines" → "SA" and "SkyHaven" → "SK".
  const parts = trimmed.split(/\s+/).slice(0, 2);
  const first = parts[0] ?? '';
  if (parts.length === 2) {
    const second = parts[1] ?? '';
    const a = first[0] ?? '?';
    const b = second[0] ?? '';
    return (a + b).toUpperCase();
  }
  // Fallback: first two letters of the single word.
  return first.slice(0, 2).toUpperCase();
}

export function AirlineCrest({
  name,
  tailColor,
  size = 36,
  title,
  style,
}: AirlineCrestProps) {
  const id = `crest-${tailColor.replace('#', '').toLowerCase()}`;
  const initials = initialsOf(name);
  const fontSize = Math.round(size * 0.42);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title ?? `${name} crest`}
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tailColor} stopOpacity="0.95" />
          <stop offset="1" stopColor={tailColor} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Hex shield path — 6-sided badge */}
      <path
        d="M 32 4 L 56 18 L 56 46 L 32 60 L 8 46 L 8 18 Z"
        fill={`url(#${id}-fill)`}
        stroke={tailColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Diagonal accent stripe — darker overlay for depth */}
      <path
        d="M 12 38 L 48 14 L 56 18 L 20 42 Z"
        fill={COLOR.bg.deep}
        opacity="0.25"
      />
      {/* Top-left highlight sheen */}
      <path
        d="M 32 4 L 56 18 L 56 22 L 32 8 Z"
        fill={`url(#${id}-shine)`}
      />
      {/* Initials */}
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontWeight="800"
        fontSize={fontSize}
        fill="#F8FAFC"
        style={{
          letterSpacing: '-1px',
          textShadow: `0 1px 0 ${COLOR.bg.deep}`,
        }}
      >
        {initials}
      </text>
    </svg>
  );
}
