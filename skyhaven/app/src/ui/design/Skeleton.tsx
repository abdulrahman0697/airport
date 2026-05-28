/**
 * Skeleton loader primitive (Design pass D9).
 *
 * A shimmering placeholder used while async content (leaderboard
 * entries, friend profiles, etc) is loading. Honours
 * prefers-reduced-motion by replacing the shimmer with a static fill.
 */
import { COLOR, RADIUS } from './tokens';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  /** Number of stacked rows. Default 1. */
  rows?: number;
  /** Gap between rows in px. Default 6. */
  gap?: number;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = '100%',
  height = 14,
  radius = RADIUS.s,
  rows = 1,
  gap = 6,
  style,
}: SkeletonProps) {
  if (rows > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBox key={i} width={width} height={height} radius={radius} />
        ))}
      </div>
    );
  }
  return <SkeletonBox width={width} height={height} radius={radius} {...(style ? { style } : {})} />;
}

function SkeletonBox({
  width, height, radius, style,
}: {
  width: number | string;
  height: number | string;
  radius: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background:
          `linear-gradient(90deg, ${COLOR.bg.glass} 0%, ${COLOR.border.medium} 50%, ${COLOR.bg.glass} 100%)`,
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1400ms linear infinite',
        ...style,
      }}
    />
  );
}
