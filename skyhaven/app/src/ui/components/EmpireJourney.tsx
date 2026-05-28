/**
 * EmpireJourney — Design Review v3, point 24.
 *
 * The aspirational ladder. Tier 1 → Tier 8 displayed as a vertical
 * scroll of milestone cards, each showing the required lifetime
 * earnings, the physical airport change, the new aircraft class, the
 * new mechanic unlocked, and a faint visual preview.
 *
 * Reached tiers read as completed (gold check); the current tier is
 * highlighted; future tiers are dimmed but legible — the goal is
 * "I can see exactly where I'm going" not "look at this locked grid".
 */
import { AnimatePresence, motion } from 'framer-motion';
import { AIRPORT_GROWTH } from '../../data/tierGrowth';
import { TIER_UNLOCK_THRESHOLDS } from '../../engine/tierUnlocks';
import {
  selectLifetime,
  selectTailColor,
  selectTier,
  useGameStore,
} from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { COLOR, RADIUS, SHADOW } from '../design/tokens';
import { formatCash } from '../format';

interface TierRow {
  tier: number;
  label: string;
  era: string;
  mechanic: string;
  aircraftClass: string;
  threshold: number;
}

const TIER_DETAIL: readonly Omit<TierRow, 'label' | 'era' | 'threshold'>[] = [
  { tier: 1, mechanic: 'Open routes from your home hub',          aircraftClass: 'Regional turboprops' },
  { tier: 2, mechanic: 'Cargo apron + parallel revenue lane',      aircraftClass: 'Regional jets' },
  { tier: 3, mechanic: 'Control tower · weather alerts unlocked',  aircraftClass: 'Narrow-body airliners' },
  { tier: 4, mechanic: 'Ground service · faster turnaround',       aircraftClass: 'Modern narrow-body' },
  { tier: 5, mechanic: 'Premium lounge · VIP pricing yield',       aircraftClass: 'Wide-body + cargo lane' },
  { tier: 6, mechanic: 'Second runway · skybridge concurrency',    aircraftClass: 'Long-haul wide-body' },
  { tier: 7, mechanic: 'Metro link · far-region demand pull',      aircraftClass: 'Heavy flagship' },
  { tier: 8, mechanic: 'Airport hotel · aviation empire seal',     aircraftClass: 'Mega-flagship (A380+)' },
];

export function EmpireJourney() {
  const open = useUiStore((s) => s.empireJourneyOpen);
  const close = (): void => useUiStore.getState().setEmpireJourneyOpen(false);
  const tier = useGameStore(selectTier);
  const lifetime = useGameStore(selectLifetime);
  const tailColor = useGameStore(selectTailColor);

  if (!open) return null;

  const rows: TierRow[] = TIER_DETAIL.map((d) => ({
    ...d,
    label: AIRPORT_GROWTH[d.tier - 1]?.label ?? '—',
    era: AIRPORT_GROWTH[d.tier - 1]?.era ?? `Tier ${d.tier}`,
    threshold: TIER_UNLOCK_THRESHOLDS[d.tier] ?? 0,
  }));

  return (
    <AnimatePresence>
      <motion.div
        key="empire-journey"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={shell as Record<string, unknown>}
        onClick={close}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          style={panel(tailColor) as Record<string, unknown>}
          onClick={(e): void => e.stopPropagation()}
        >
          <div style={header}>
            <div style={headerKicker(tailColor)}>EMPIRE JOURNEY</div>
            <button onClick={close} style={closeBtn} aria-label="Close">✕</button>
          </div>
          <div style={subhead}>
            From Local Air Taxi to Global Aviation Empire — every tier is
            a physical change at your airport and a new strategic surface.
          </div>

          {/* Horizontal mural — Design Review v4, point 22. Eight
              stage tiles with ghost airport previews, the player's
              progress sliding across them. Aspirational, not just a
              roadmap. */}
          <div style={muralWrap}>
            <div style={muralKicker(tailColor)}>WORLD PROGRESSION</div>
            <div style={muralScroller}>
              {rows.map((r) => {
                const reached = tier >= r.tier;
                const current = tier === r.tier;
                return (
                  <div
                    key={`mural-${r.tier}`}
                    style={muralTile(reached, current, tailColor)}
                  >
                    <div style={muralTileLabel(reached, current, tailColor)}>
                      T{r.tier} · {r.era.toUpperCase()}
                    </div>
                    <div style={{
                      ...muralPreview,
                      opacity: reached || current ? 1 : 0.55,
                      filter: reached || current ? 'none' : 'grayscale(0.7)',
                    }}>
                      <img
                        src={`/tier-${r.tier}.png`}
                        alt={`Tier ${r.tier} airport`}
                        style={tierImg}
                        draggable={false}
                      />
                    </div>
                    <div style={muralTileTitle}>{r.label}</div>
                    {!reached && !current && (
                      <div style={muralLocked}>🔒 +${formatCash(r.threshold, 0)} lifetime</div>
                    )}
                    {current && (
                      <div style={{ ...muralCurrent, color: tailColor }}>● HERE</div>
                    )}
                    {reached && !current && (
                      <div style={{ ...muralReached, color: COLOR.success }}>✓ COMPLETE</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={muralScrollHint}>← Swipe to see the full empire ladder →</div>
          </div>

          <div style={list}>
            {rows.map((r) => {
              const reached = tier >= r.tier;
              const current = tier === r.tier;
              const remaining = Math.max(0, r.threshold - lifetime);
              const pct = r.threshold > 0
                ? Math.max(0, Math.min(1, lifetime / r.threshold))
                : 1;
              return (
                <div
                  key={r.tier}
                  style={{
                    ...row,
                    borderColor: current
                      ? tailColor
                      : reached
                        ? `${COLOR.success}55`
                        : `${COLOR.border.soft}`,
                    background: current
                      ? `linear-gradient(160deg, ${tailColor}1a, rgba(11,17,32,0.7))`
                      : reached
                        ? 'rgba(52,211,153,0.05)'
                        : 'rgba(11,17,32,0.55)',
                    opacity: reached || current ? 1 : 0.85,
                  }}
                >
                  <div style={rowLeft}>
                    <div style={rowTierTag(reached, current, tailColor)}>
                      {reached ? '✓' : `T${r.tier}`}
                    </div>
                    <div>
                      <div style={rowEra(current, tailColor)}>{r.era.toUpperCase()}</div>
                      <div style={rowTitle}>{r.label}</div>
                      <div style={rowDetails}>
                        <span style={rowChip}>+ {r.mechanic}</span>
                        <span style={rowChip}>{r.aircraftClass}</span>
                      </div>
                    </div>
                  </div>
                  <div style={rowRight}>
                    {reached ? (
                      <div style={{ ...rowStatus, color: COLOR.success }}>UNLOCKED</div>
                    ) : (
                      <>
                        <div style={rowStatus}>NEEDS</div>
                        <div style={rowGoal}>${formatCash(r.threshold, 0)} lifetime</div>
                        {!reached && (
                          <>
                            <div style={progressTrack}>
                              <div style={{ ...progressFill, width: `${pct * 100}%`, background: current ? tailColor : COLOR.ink.muted }} />
                            </div>
                            <div style={rowRemaining}>+${formatCash(remaining, 1)} to go</div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 105,
  background: 'rgba(7,10,24,0.78)',
  backdropFilter: 'blur(6px)',
  display: 'grid',
  placeItems: 'end stretch',
};
const panel = (tail: string): React.CSSProperties => ({
  background: 'linear-gradient(180deg, #0F1734, #050912)',
  borderTop: `2px solid ${tail}66`,
  borderRadius: '24px 24px 0 0',
  width: '100%',
  maxWidth: 540,
  margin: '0 auto',
  // dvh tracks the dynamic mobile viewport (URL bar shown/hidden) so
  // the panel never spills off the bottom of the screen.
  maxHeight: 'min(92dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 8px))',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  boxShadow: SHADOW.modal,
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  overflow: 'hidden',
});
const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 16px 4px',
};
const headerKicker = (tail: string): React.CSSProperties => ({
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: '0.28em',
  color: tail,
});
const closeBtn: React.CSSProperties = {
  width: 32, height: 32,
  border: '1px solid rgba(148,163,184,0.3)',
  background: 'rgba(11,17,32,0.5)',
  color: COLOR.ink.muted,
  borderRadius: 999,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
};
const subhead: React.CSSProperties = {
  padding: '0 16px 12px',
  fontSize: 12,
  color: COLOR.ink.muted,
  lineHeight: 1.5,
};
// Mural (Design Review v4 — point 22)
const muralWrap: React.CSSProperties = {
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  padding: '4px 4px 12px',
  flexShrink: 0,
};
const muralKicker = (tail: string): React.CSSProperties => ({
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.22em',
  color: tail,
  padding: '0 12px',
});
const muralScroller: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  padding: '8px 12px',
  WebkitOverflowScrolling: 'touch',
};
const muralTile = (reached: boolean, current: boolean, tail: string): React.CSSProperties => ({
  flexShrink: 0,
  width: 220,
  scrollSnapAlign: 'start',
  background: current
    ? `linear-gradient(180deg, ${tail}26, rgba(11,17,32,0.85))`
    : reached
      ? 'linear-gradient(180deg, rgba(52,211,153,0.10), rgba(11,17,32,0.85))'
      : 'rgba(11,17,32,0.55)',
  border: `1px solid ${current ? tail : reached ? `${COLOR.success}55` : COLOR.border.soft}`,
  borderRadius: RADIUS.m,
  padding: 8,
  boxShadow: current ? `0 6px 18px ${tail}33` : 'none',
});
const muralTileLabel = (reached: boolean, current: boolean, tail: string): React.CSSProperties => ({
  fontSize: 9,
  letterSpacing: '0.16em',
  fontWeight: 800,
  color: current ? tail : reached ? COLOR.success : COLOR.ink.faint,
});
const muralPreview: React.CSSProperties = {
  marginTop: 6,
  marginBottom: 6,
  borderRadius: 8,
  overflow: 'hidden',
  background: '#050912',
  // Square-ish frame for the player-supplied tier art (1.png … 8.png).
  aspectRatio: '1 / 1',
};
const tierImg: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};
const muralTileTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: COLOR.ink.primary,
  marginBottom: 4,
  letterSpacing: '0.02em',
};
const muralLocked: React.CSSProperties = {
  fontSize: 10,
  color: COLOR.gold.base,
  fontWeight: 700,
  fontFeatureSettings: '"tnum" 1',
};
const muralCurrent: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.18em',
  fontWeight: 900,
};
const muralReached: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.18em',
  fontWeight: 800,
};
const muralScrollHint: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.12em',
  color: COLOR.ink.faint,
  textAlign: 'center',
  padding: '0 12px 2px',
  fontWeight: 700,
};

const list: React.CSSProperties = {
  padding: '0 12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  overflowY: 'auto',
  // Absorb the remaining panel height so the list scrolls internally
  // rather than pushing the panel beyond its own maxHeight.
  flex: 1,
  minHeight: 0,
};
const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 12px',
  borderRadius: RADIUS.m,
  border: '1px solid',
};
const rowLeft: React.CSSProperties = {
  display: 'flex', gap: 12, alignItems: 'flex-start',
  minWidth: 0,
};
const rowTierTag = (reached: boolean, current: boolean, tail: string): React.CSSProperties => ({
  width: 36, height: 36,
  borderRadius: 999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 12,
  fontWeight: 900,
  color: reached ? '#0B1120' : current ? '#0B1120' : COLOR.ink.muted,
  background: reached ? COLOR.success : current ? tail : 'rgba(148,163,184,0.18)',
  letterSpacing: '0.02em',
  flexShrink: 0,
  boxShadow: current ? `0 0 12px ${tail}88` : 'none',
});
const rowEra = (current: boolean, tail: string): React.CSSProperties => ({
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.18em',
  color: current ? tail : COLOR.ink.faint,
});
const rowTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: COLOR.ink.primary,
  marginTop: 2,
};
const rowDetails: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  marginTop: 6,
};
const rowChip: React.CSSProperties = {
  fontSize: 10,
  color: COLOR.ink.muted,
  background: 'rgba(11,17,32,0.55)',
  border: `1px solid ${COLOR.border.soft}`,
  padding: '3px 8px',
  borderRadius: 999,
};
const rowRight: React.CSSProperties = {
  textAlign: 'right',
  flexShrink: 0,
  minWidth: 110,
};
const rowStatus: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.18em',
  color: COLOR.ink.faint,
};
const rowGoal: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: COLOR.gold.base,
  marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};
const progressTrack: React.CSSProperties = {
  marginTop: 4,
  height: 4,
  background: 'rgba(148,163,184,0.15)',
  borderRadius: 999,
  overflow: 'hidden',
};
const progressFill: React.CSSProperties = {
  height: '100%',
  transition: 'width 300ms ease',
};
const rowRemaining: React.CSSProperties = {
  marginTop: 4,
  fontSize: 10,
  color: COLOR.ink.muted,
};
