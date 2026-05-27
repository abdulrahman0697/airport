/**
 * Achievements panel (BRD §14).
 *
 * Tabbed view across the 6 categories. Each row shows the
 * achievement name, description, reward, and a lock/unlock state.
 * A summary bar up top tracks {unlocked} / {total} and renders the
 * current cosmetic frame tier.
 */
import { useMemo, useState } from 'react';
import {
  ACHIEVEMENT_COUNT,
  achievementsByCategory,
  CATEGORY_LABELS,
  frameTier,
  FRAME_COLORS,
  type AchievementCategory,
} from '../../data/achievements';
import { selectAchievements, useGameStore } from '../../state/store';
import { formatCash } from '../format';

const CATEGORY_ORDER: readonly AchievementCategory[] = [
  'milestone', 'network', 'fleet', 'economy', 'operations', 'mastery',
];

export function AchievementsPanel() {
  const unlocked = useGameStore(selectAchievements);
  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked]);
  const grouped = useMemo(() => achievementsByCategory(), []);
  const [tab, setTab] = useState<AchievementCategory>('milestone');

  const tier = frameTier(unlocked.length);
  const frame = FRAME_COLORS[tier];
  const list = grouped[tab];

  return (
    <div style={shell}>
      <div style={header}>
        <h2 style={title}>Achievements</h2>
        <div style={summaryRow}>
          <span style={summaryCount}>
            {unlocked.length} / {ACHIEVEMENT_COUNT}
          </span>
          <span style={{
            ...framePill,
            color: frame.primary,
            borderColor: `${frame.primary}66`,
            background: `${frame.primary}1F`,
          }}>{frame.label} frame</span>
        </div>
        <div role="tablist" style={tabsRow}>
          {CATEGORY_ORDER.map((c) => {
            const total = grouped[c].length;
            const unlockedHere = grouped[c].reduce((n, a) => n + (unlockedSet.has(a.id) ? 1 : 0), 0);
            return (
              <button
                key={c}
                role="tab"
                onClick={(): void => setTab(c)}
                style={{ ...tabBtn, ...(tab === c ? tabActive : {}) }}
              >
                {CATEGORY_LABELS[c]} {unlockedHere}/{total}
              </button>
            );
          })}
        </div>
      </div>
      <div style={body}>
        <ul style={listStyle}>
          {list.map((def) => {
            const isUnlocked = unlockedSet.has(def.id);
            return (
              <li key={def.id} style={{ ...row, ...(isUnlocked ? rowUnlocked : {}) }}>
                <div style={rowIcon}>{isUnlocked ? '★' : '◯'}</div>
                <div style={rowMain}>
                  <div style={rowName}>{def.name}</div>
                  <div style={rowDesc}>{def.description}</div>
                </div>
                <div style={{ ...rowReward, color: isUnlocked ? '#34D399' : '#F4C75B' }}>
                  +${formatCash(def.reward)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const header: React.CSSProperties = { padding: '20px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' };
const title: React.CSSProperties = { margin: 0, fontSize: 22, color: '#F8FAFC' };
const summaryRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, marginTop: 8,
};
const summaryCount: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: '#F8FAFC',
  fontFeatureSettings: '"tnum" 1',
};
const framePill: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
  fontWeight: 700, padding: '4px 10px', borderRadius: 999,
  border: '1px solid', background: 'transparent',
};
const tabsRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 };
const tabBtn: React.CSSProperties = {
  background: 'transparent', color: '#94A3B8', border: 0,
  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
  fontSize: 11, minHeight: 36, fontFamily: 'inherit',
  letterSpacing: '0.04em',
};
const tabActive: React.CSSProperties = {
  background: 'rgba(90,200,250,0.12)', color: '#5AC8FA',
};
const body: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: 12,
};
const listStyle: React.CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0,
  display: 'flex', flexDirection: 'column', gap: 6,
};
const row: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10,
  alignItems: 'center', padding: '12px 14px',
  background: 'rgba(255,255,255,0.04)', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.06)',
};
const rowUnlocked: React.CSSProperties = {
  background: 'rgba(52,211,153,0.08)',
  borderColor: 'rgba(52,211,153,0.32)',
};
const rowIcon: React.CSSProperties = {
  fontSize: 18, color: '#F4C75B', textAlign: 'center',
};
const rowMain: React.CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 };
const rowName: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#F8FAFC',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const rowDesc: React.CSSProperties = {
  fontSize: 11, color: '#94A3B8', marginTop: 2, lineHeight: 1.4,
};
const rowReward: React.CSSProperties = {
  fontSize: 13, fontWeight: 700,
  fontFeatureSettings: '"tnum" 1',
};
