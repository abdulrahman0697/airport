/**
 * Cosmetic frame badge that wraps the airline identity (BRD §14
 * "cosmetic frame" acceptance). The tier ramps with the player's
 * unlocked-achievement count via `frameTier()` in data/achievements.
 *
 * Rendered around the brand chip + name in OfficePanel / TopBar.
 */
import { FRAME_COLORS, frameTier } from '../../data/achievements';

export function frameProps(unlockedCount: number): {
  tier: ReturnType<typeof frameTier>;
  primary: string;
  secondary: string;
  label: string;
} {
  const tier = frameTier(unlockedCount);
  return { tier, ...FRAME_COLORS[tier] };
}

export function FrameBadge({ unlockedCount }: { unlockedCount: number }) {
  const { tier, primary, label } = frameProps(unlockedCount);
  if (tier === 'none') return null;
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: primary,
        background: `${primary}1F`,
        border: `1px solid ${primary}66`,
        padding: '2px 8px',
        borderRadius: 999,
      }}
      title={`${label} frame (${unlockedCount} achievements)`}
    >
      {label}
    </span>
  );
}
