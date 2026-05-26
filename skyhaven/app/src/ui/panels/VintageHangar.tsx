import { CLASSIC_DEFS } from '../../data/classics';
import { selectVintage, useGameStore } from '../../state/store';

/**
 * Vintage Hangar — the classic-aircraft collection grid (BRD §4.9).
 *
 * Twelve trading-card slots, owned ones rendered with year + bio,
 * unowned ones as silhouette placeholders. Each collected card lifts
 * global revenue by +1%; the header strip surfaces the cumulative
 * bonus + completion progress.
 */
export function VintageHangar() {
  const vintage = useGameStore(selectVintage);
  const owned = new Set(vintage);
  const pct = (vintage.length * 100) / CLASSIC_DEFS.length;

  return (
    <div style={shell}>
      <div style={summary}>
        <div style={summaryHead}>
          <div>
            <div style={summaryKicker}>Vintage Hangar</div>
            <div style={summaryTitle}>{vintage.length} / {CLASSIC_DEFS.length} collected</div>
          </div>
          <div style={summaryBonus}>+{vintage.length}%</div>
        </div>
        <div style={progressTrack}>
          <div style={{ ...progressFill, width: `${pct}%` }} />
        </div>
        <div style={summaryNote}>
          Each classic adds a permanent +1% to global revenue.
          Drops arrive at lifetime-earnings milestones every $50M from $10M.
        </div>
      </div>

      <ul style={grid}>
        {CLASSIC_DEFS.map((c) => {
          const isOwned = owned.has(c.id);
          return (
            <li key={c.id} style={{ ...cardShell, ...(isOwned ? cardOwned : cardLocked) }}>
              {isOwned ? (
                <>
                  <div style={cardYear}>{c.year}</div>
                  <div style={cardName}>{c.displayName}</div>
                  <div style={cardTagline}>{c.tagline}</div>
                  <div style={cardBio}>{c.bio}</div>
                  <div style={cardBonus}>+1% global yield</div>
                </>
              ) : (
                <>
                  <div style={lockedYear}>—</div>
                  <div style={lockedName}>Classic in vault</div>
                  <div style={lockedHint}>
                    Reach the next $50M milestone to unlock.
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = { padding: 0 };
const summary: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(244,199,91,0.10), rgba(139,92,246,0.10))',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: 14,
  marginBottom: 14,
};
const summaryHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
};
const summaryKicker: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F4C75B',
};
const summaryTitle: React.CSSProperties = {
  fontSize: 18, color: '#F8FAFC', fontWeight: 700, marginTop: 2,
};
const summaryBonus: React.CSSProperties = {
  color: '#F4C75B', fontWeight: 700, fontSize: 22,
  fontFeatureSettings: '"tnum" 1',
  textShadow: '0 0 16px rgba(244,199,91,0.45)',
};
const progressTrack: React.CSSProperties = {
  height: 6,
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 3,
  marginTop: 10,
  overflow: 'hidden',
};
const progressFill: React.CSSProperties = {
  height: '100%',
  background: 'linear-gradient(90deg, #F4C75B, #8B5CF6)',
  transition: 'width 300ms ease',
};
const summaryNote: React.CSSProperties = {
  color: '#94A3B8',
  fontSize: 11,
  marginTop: 10,
  lineHeight: 1.5,
};
const grid: React.CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 10,
};
const cardShell: React.CSSProperties = {
  borderRadius: 10,
  padding: '12px 12px',
  minHeight: 130,
  border: '1px solid rgba(255,255,255,0.06)',
  display: 'flex',
  flexDirection: 'column',
};
const cardOwned: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(244,199,91,0.10), rgba(11,17,32,0.7))',
  borderColor: 'rgba(244,199,91,0.32)',
  boxShadow: '0 8px 22px rgba(0,0,0,0.35) inset',
};
const cardLocked: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  opacity: 0.65,
};
const cardYear: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.14em',
  color: '#F4C75B',
  fontWeight: 700,
};
const cardName: React.CSSProperties = {
  fontSize: 14,
  color: '#F8FAFC',
  fontWeight: 700,
  marginTop: 2,
};
const cardTagline: React.CSSProperties = {
  fontSize: 11,
  color: '#94A3B8',
  marginTop: 4,
  lineHeight: 1.4,
};
const cardBio: React.CSSProperties = {
  fontSize: 10,
  color: '#94A3B8',
  marginTop: 8,
  lineHeight: 1.5,
  flex: 1,
};
const cardBonus: React.CSSProperties = {
  fontSize: 10,
  color: '#34D399',
  marginTop: 8,
  letterSpacing: '0.06em',
};
const lockedYear: React.CSSProperties = {
  fontSize: 10,
  color: '#94A3B8',
  letterSpacing: '0.14em',
};
const lockedName: React.CSSProperties = {
  fontSize: 13,
  color: '#94A3B8',
  marginTop: 4,
};
const lockedHint: React.CSSProperties = {
  fontSize: 10,
  color: '#94A3B8',
  marginTop: 10,
  lineHeight: 1.5,
};
