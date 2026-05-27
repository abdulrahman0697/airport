/**
 * Tier-progress ring (Design pass D1).
 *
 * A small circular gauge that visualises tier progress as a glowing
 * arc. Reads as a HUD element next to the airline name. Replaces the
 * previous linear tier bar.
 *
 * Two stroked circles: a faint full ring + a partial arc that grows
 * with progress, painted with the airline's tail color and a soft
 * glow. The current tier number renders in the centre.
 */
import { COLOR } from './tokens';

export interface TierRingProps {
  /** 0..1 fraction of progress toward the next tier. */
  pct: number;
  /** Current tier integer (renders in the centre). */
  tier: number;
  /** Diameter in px. */
  size?: number;
  /** Stroke colour (defaults to tail-color cyan if omitted). */
  color?: string;
}

export function TierRing({
  pct,
  tier,
  size = 38,
  color = COLOR.accent.cyan,
}: TierRingProps) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, pct));
  const dash = circumference * clamped;
  const center = size / 2;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} aria-hidden style={{ display: 'block' }}>
        {/* Outer glow circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`${color}22`}
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            filter: `drop-shadow(0 0 4px ${color})`,
            transition: 'stroke-dasharray 400ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: Math.round(size * 0.35),
          fontWeight: 800,
          color: COLOR.ink.primary,
          letterSpacing: '0.04em',
          fontFeatureSettings: '"tnum" 1',
        }}
        aria-label={`Tier ${tier}, ${Math.round(clamped * 100)}% to next tier`}
      >
        T{tier}
      </div>
    </div>
  );
}
