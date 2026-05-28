/**
 * Chip primitive (Design pass D2).
 *
 * A small inline badge used to tag rows with a categorical state
 * (HUB, CARGO, TIER 3, PENDING). Eight semantic tones; each tone
 * derives a fill / border / text colour from tokens.
 *
 * Replaces ~12 ad-hoc badge styles in the codebase as later passes
 * migrate. New surfaces should use this directly.
 */
import { COLOR, RADIUS } from './tokens';

export type ChipTone =
  | 'neutral'
  | 'accent'
  | 'gold'
  | 'success'
  | 'warn'
  | 'danger'
  | 'violet'
  | 'mute';

export interface ChipProps {
  tone?: ChipTone;
  /** Optional override of the accent color (for tail-color tinting). */
  color?: string;
  /** Compact mode for very dense lists. */
  size?: 'xs' | 'sm';
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const PALETTE: Record<ChipTone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: COLOR.ink.secondary, bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.32)' },
  accent:  { fg: COLOR.accent.cyan, bg: 'rgba(90,200,250,0.14)',   border: 'rgba(90,200,250,0.45)' },
  gold:    { fg: COLOR.gold.base,    bg: 'rgba(244,199,91,0.14)',  border: 'rgba(244,199,91,0.45)' },
  success: { fg: COLOR.success,      bg: 'rgba(52,211,153,0.14)',  border: 'rgba(52,211,153,0.45)' },
  warn:    { fg: COLOR.warn,         bg: 'rgba(245,158,11,0.14)',  border: 'rgba(245,158,11,0.45)' },
  danger:  { fg: COLOR.danger,       bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.45)' },
  violet:  { fg: '#A78BFA',          bg: 'rgba(139,92,246,0.14)',  border: 'rgba(139,92,246,0.45)' },
  mute:    { fg: COLOR.ink.faint,    bg: 'rgba(255,255,255,0.04)', border: COLOR.border.soft },
};

export function Chip({
  tone = 'neutral',
  color,
  size = 'sm',
  children,
  style,
}: ChipProps) {
  const p = PALETTE[tone];
  const fg = color ?? p.fg;
  const bg = color ? `${color}22` : p.bg;
  const border = color ? `${color}55` : p.border;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: size === 'xs' ? 9 : 10,
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: fg,
        background: bg,
        border: `1px solid ${border}`,
        padding: size === 'xs' ? '2px 6px' : '3px 8px',
        borderRadius: RADIUS.xs,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
