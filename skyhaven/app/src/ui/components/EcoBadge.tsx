import { ecoTier, ecoTierMeta } from '../../engine/eco';
import { selectEcoRating, useGameStore } from '../../state/store';

/**
 * Compact Eco Rating chip (BRD §4.10).
 *
 * Renders under the top-bar tier pill. Shows the current band
 * (Bronze / Silver / Gold / Platinum) and a small percentage figure
 * for the global revenue bonus. Below the Bronze threshold, displays
 * a placeholder "Eco —" so the slot is visible from the start.
 */
export function EcoBadge() {
  const score = useGameStore(selectEcoRating);
  const tier = ecoTier(score);
  const meta = ecoTierMeta(tier);

  if (!meta) {
    return (
      <div style={pill('#94A3B8')}>
        <span style={dot('#94A3B8')} />
        <span>Eco —</span>
      </div>
    );
  }

  return (
    <div style={pill(meta.color)}>
      <span style={dot(meta.color)} />
      <span>Eco {meta.label}</span>
      <span style={bonusSpan}>+{Math.round(meta.revenueBonus * 100)}%</span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const pill = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  marginTop: 4,
  fontSize: 9,
  letterSpacing: '0.08em',
  color,
  textTransform: 'uppercase',
  fontWeight: 600,
});
const dot = (color: string): React.CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: 3,
  background: color,
  boxShadow: `0 0 6px ${color}AA`,
});
const bonusSpan: React.CSSProperties = {
  fontSize: 9,
  color: '#94A3B8',
  marginLeft: 2,
};
