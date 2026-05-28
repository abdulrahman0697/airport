/**
 * NextUnlockBadge (Design Review v2 — point 7).
 *
 * A persistent "what am I chasing?" widget pinned at the top of the
 * world view (just under the TopBar) when no panel is open. Shows
 * the next tier era + the airport feature it brings + how much
 * lifetime earnings remain. Tapping it opens the AirportPanel so the
 * player can see exactly what's about to physically appear.
 *
 * Hidden once the player reaches MAX_TIER or while a panel is open
 * (the panel chrome owns the player's attention then).
 */
import { growthFor } from '../../data/tierGrowth';
import { MAX_TIER, TIER_UNLOCK_THRESHOLDS } from '../../engine/tierUnlocks';
import {
  selectLifetime,
  selectTailColor,
  selectTier,
  selectTutorialCompleted,
  useGameStore,
} from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { COLOR, RADIUS, SHADOW, SPACE } from '../design/tokens';
import { formatCash } from '../format';
import { usePanelStore } from './PanelHost';

export function NextUnlockBadge() {
  const tier = useGameStore(selectTier);
  const lifetime = useGameStore(selectLifetime);
  const tailColor = useGameStore(selectTailColor);
  const tutorialDone = useGameStore(selectTutorialCompleted);
  const mapMode = useUiStore((s) => s.mapMode);
  const activePanel = usePanelStore((s) => s.active);
  const open = usePanelStore((s) => s.open);

  // Hide while any panel is open or at max tier. Also hide during the
  // tutorial — Mission Control already tells the player what they're
  // chasing, and stacking two "what's next" cards covered the map,
  // the event banner and the fuel gauge. After tutorial, the badge
  // belongs on the world-map view only (home owns its own Expansion
  // Preview).
  if (activePanel !== null) return null;
  if (tier >= MAX_TIER) return null;
  if (!tutorialDone) return null;
  if (!mapMode) return null;

  const nextGrowth = growthFor(tier + 1);
  const nextThreshold = TIER_UNLOCK_THRESHOLDS[tier + 1];
  if (!nextGrowth || nextThreshold === undefined) return null;

  const remaining = Math.max(0, nextThreshold - lifetime);
  const span = Math.max(1, nextThreshold - (TIER_UNLOCK_THRESHOLDS[tier] ?? 0));
  const pct = Math.max(0, Math.min(1, 1 - remaining / span));

  return (
    <button
      onClick={(): void => open('airport')}
      style={shell(tailColor)}
      aria-label={`Next unlock: ${nextGrowth.era}`}
    >
      <div style={kicker(tailColor)}>NEXT UNLOCK · TIER {tier + 1}</div>
      <div style={titleRow}>
        <span style={titleText}>{nextGrowth.era}</span>
        <span style={remainingText}>+${formatCash(remaining)}</span>
      </div>
      <div style={subtitle}>{nextGrowth.label}</div>
      <div style={progressTrack}>
        <div style={{ ...progressFill, width: `${pct * 100}%`, background: tailColor }} />
      </div>
    </button>
  );
}

const shell = (tail: string): React.CSSProperties => ({
  position: 'fixed',
  top: 'calc(var(--world-top) + 8px)',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(360px, calc(100vw - 24px))',
  background: COLOR.bg.elevated,
  border: `1px solid ${tail}44`,
  borderRadius: RADIUS.l,
  padding: '10px 14px',
  boxShadow: SHADOW.hud,
  backdropFilter: 'blur(8px)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
  zIndex: 11,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

const kicker = (tail: string): React.CSSProperties => ({
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.20em',
  textTransform: 'uppercase',
  color: tail,
});

const titleRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};
const titleText: React.CSSProperties = {
  fontSize: 14, fontWeight: 800, color: COLOR.ink.primary,
  letterSpacing: '0.01em',
};
const remainingText: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, color: COLOR.gold.base,
  fontFeatureSettings: '"tnum" 1',
};
const subtitle: React.CSSProperties = {
  fontSize: 10,
  color: COLOR.ink.muted,
  letterSpacing: '0.04em',
};

const progressTrack: React.CSSProperties = {
  height: 4, background: 'rgba(255,255,255,0.08)',
  borderRadius: SPACE.xs / 2, overflow: 'hidden',
  marginTop: 4,
};
const progressFill: React.CSSProperties = {
  height: '100%',
  transition: 'width 320ms cubic-bezier(0.16,1,0.3,1)',
};
