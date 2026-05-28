/**
 * HeroCard primitive (Design pass D5).
 *
 * A side-accented surface that reads as a "row that means business" —
 * used for every list item that's the primary actionable in a panel
 * (Routes, Fleet, Hubs, Friends, Achievements). Three pieces:
 *
 *  - **Accent rail** on the left, 3px wide, tail-color tintable.
 *  - **Body** with title, optional subtitle, free-form right slot.
 *  - **Tap area** that opens a details modal or a context action.
 *
 * Composes cleanly with the Chip primitive — pass chips into the
 * `chips` slot to badge the row.
 */
import type { ReactNode } from 'react';
import { COLOR, MOTION, RADIUS, SPACE } from './tokens';

export interface HeroCardProps {
  /** Optional accent color (defaults to neutral border). */
  accent?: string;
  /** Card title (primary line). */
  title: ReactNode;
  /** Optional subtitle (secondary line). */
  subtitle?: ReactNode;
  /** Chips rendered inline with the title (badges, tier marker, etc). */
  chips?: ReactNode;
  /** Right-side slot (price, gauge, etc). */
  right?: ReactNode;
  /** Body content below the title row (gauges, action buttons, etc). */
  children?: ReactNode;
  /** Whole-card click handler — makes the card interactive. */
  onClick?: () => void;
  /** Disables interactive hover/press styling. */
  inert?: boolean;
  style?: React.CSSProperties;
}

export function HeroCard({
  accent,
  title,
  subtitle,
  chips,
  right,
  children,
  onClick,
  inert,
  style,
}: HeroCardProps) {
  const interactive = !!onClick && !inert;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e): void => {
        if (!interactive) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
      }}
      style={{
        ...cardBase,
        borderLeft: `3px solid ${accent ?? COLOR.border.medium}`,
        cursor: interactive ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={head}>
        <div style={titleCol}>
          <div style={titleRow}>
            <span style={titleText}>{title}</span>
            {chips}
          </div>
          {subtitle && <div style={subtitleText}>{subtitle}</div>}
        </div>
        {right && <div style={rightSlot}>{right}</div>}
      </div>
      {children && <div style={bodySlot}>{children}</div>}
    </div>
  );
}

const cardBase: React.CSSProperties = {
  position: 'relative',
  background: COLOR.bg.glass,
  borderRadius: RADIUS.m,
  border: `1px solid ${COLOR.border.soft}`,
  padding: `${SPACE.m}px ${SPACE.m}px ${SPACE.m}px ${SPACE.m}px`,
  transition: `background ${MOTION.duration.short}ms ${MOTION.easing.snap}`,
};
const head: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: SPACE.s,
  minWidth: 0,
};
const titleCol: React.CSSProperties = { minWidth: 0, flex: 1 };
const titleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACE.s,
  flexWrap: 'wrap',
};
const titleText: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: COLOR.ink.primary,
  letterSpacing: '0.01em',
};
const subtitleText: React.CSSProperties = {
  fontSize: 11,
  color: COLOR.ink.muted,
  marginTop: 4,
};
const rightSlot: React.CSSProperties = { textAlign: 'right', flexShrink: 0 };
const bodySlot: React.CSSProperties = { marginTop: SPACE.s };
