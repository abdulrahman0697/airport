/**
 * EmptyState primitive (Design pass D9).
 *
 * A friendly placeholder for "you don't have any X yet" surfaces.
 * Pre-D9 panels just dropped a single grey line of text — the new
 * primitive composes an icon, headline, supporting copy, and an
 * optional CTA, so empty states feel intentional, not apologetic.
 */
import type { ReactNode } from 'react';
import { COLOR, RADIUS, SPACE, TYPE } from './tokens';

export interface EmptyStateProps {
  /** Big glyph or SVG icon (~48 px area). */
  icon?: ReactNode;
  /** Headline — short, optimistic. */
  title: ReactNode;
  /** Supporting copy — one or two sentences max. */
  body?: ReactNode;
  /** Optional CTA element (typically a Button). */
  action?: ReactNode;
  /** Compact mode for small panels. */
  size?: 'sm' | 'md';
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  size = 'md',
}: EmptyStateProps) {
  const padding = size === 'sm' ? SPACE.l : SPACE.xl;
  return (
    <div style={{ ...shell, padding: `${padding}px ${SPACE.l}px` }}>
      {icon && <div style={iconWrap}>{icon}</div>}
      <div style={titleText}>{title}</div>
      {body && <div style={bodyText}>{body}</div>}
      {action && <div style={actionWrap}>{action}</div>}
    </div>
  );
}

const shell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: SPACE.s,
  background: COLOR.bg.glass,
  border: `1px dashed ${COLOR.border.medium}`,
  borderRadius: RADIUS.m,
};
const iconWrap: React.CSSProperties = {
  fontSize: 36,
  color: COLOR.accent.cyan,
  marginBottom: SPACE.xs,
  opacity: 0.7,
};
const titleText: React.CSSProperties = {
  fontSize: TYPE.heading.size,
  fontWeight: TYPE.heading.weight,
  color: COLOR.ink.primary,
};
const bodyText: React.CSSProperties = {
  fontSize: TYPE.small.size,
  color: COLOR.ink.muted,
  lineHeight: 1.5,
  maxWidth: 320,
};
const actionWrap: React.CSSProperties = {
  marginTop: SPACE.s,
};
