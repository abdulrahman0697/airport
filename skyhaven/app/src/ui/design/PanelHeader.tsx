/**
 * PanelHeader primitive (Design pass D5).
 *
 * Every panel's top strip — title, optional subtitle, optional tab
 * bar slot, optional trailing CTA. Replaces the ad-hoc <h2>+style
 * patterns in every panel. Composes from tokens, so a theme change
 * (or a holiday skin) flows through every panel automatically.
 */
import type { ReactNode } from 'react';
import { COLOR, RADIUS, SPACE, TYPE } from './tokens';

export interface PanelHeaderProps {
  /** Primary title (typically a section name). */
  title: ReactNode;
  /** Faint label above the title (e.g. "Operations dashboard"). */
  kicker?: ReactNode;
  /** Optional subtitle line below the title. */
  subtitle?: ReactNode;
  /** Trailing slot — primary action button, refresh icon, etc. */
  right?: ReactNode;
  /** Tab bar / segmented control rendered below the title block. */
  tabs?: ReactNode;
  /** Override of the bottom-border accent color. */
  accent?: string;
}

export function PanelHeader({
  title,
  kicker,
  subtitle,
  right,
  tabs,
  accent = COLOR.border.soft,
}: PanelHeaderProps) {
  return (
    <header style={{ ...shell, borderBottomColor: accent }}>
      <div style={titleRow}>
        <div style={{ minWidth: 0 }}>
          {kicker && <div style={kickerStyle}>{kicker}</div>}
          <h2 style={titleText}>{title}</h2>
          {subtitle && <div style={subtitleText}>{subtitle}</div>}
        </div>
        {right && <div style={rightSlot}>{right}</div>}
      </div>
      {tabs && <div style={tabsRow}>{tabs}</div>}
    </header>
  );
}

const shell: React.CSSProperties = {
  padding: `${SPACE.xl}px ${SPACE.l}px ${SPACE.s}px`,
  borderBottom: '1px solid',
};
const titleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: SPACE.s,
};
const kickerStyle: React.CSSProperties = {
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.letter,
  textTransform: TYPE.label.transform,
  color: COLOR.accent.cyan,
  marginBottom: 4,
};
const titleText: React.CSSProperties = {
  margin: 0,
  fontSize: TYPE.title.size,
  fontWeight: TYPE.title.weight,
  letterSpacing: TYPE.title.letter,
  color: COLOR.ink.primary,
};
const subtitleText: React.CSSProperties = {
  fontSize: TYPE.small.size,
  color: COLOR.ink.muted,
  marginTop: 4,
};
const rightSlot: React.CSSProperties = {
  flexShrink: 0,
  marginTop: 2,
};
const tabsRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: SPACE.xs,
  marginTop: SPACE.m,
  padding: 4,
  background: COLOR.bg.glass,
  borderRadius: RADIUS.s,
  width: 'fit-content',
};
