/**
 * Achievements panel (BRD §14, redesigned in design pass D5).
 *
 * Tabbed view across 6 categories built on the PanelHeader +
 * HeroCard primitives. Each row reads as a hero card: side accent
 * (green when unlocked, faint grey when locked), star vs ring icon,
 * tail-color reward chip.
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
import { Chip } from '../design/Chip';
import { HeroCard } from '../design/HeroCard';
import { PanelHeader } from '../design/PanelHeader';
import { COLOR, RADIUS, SPACE } from '../design/tokens';
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
      <PanelHeader
        kicker="Trophies"
        title="Achievements"
        subtitle={`${unlocked.length} of ${ACHIEVEMENT_COUNT} unlocked`}
        right={
          <Chip color={frame.primary}>{frame.label} frame</Chip>
        }
        tabs={
          <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {CATEGORY_ORDER.map((c) => {
              const total = grouped[c].length;
              const here = grouped[c].reduce((n, a) => n + (unlockedSet.has(a.id) ? 1 : 0), 0);
              return (
                <button
                  key={c}
                  role="tab"
                  onClick={(): void => setTab(c)}
                  style={{ ...tabBtn, ...(tab === c ? tabActive : {}) }}
                >
                  {CATEGORY_LABELS[c]} {here}/{total}
                </button>
              );
            })}
          </div>
        }
      />
      <div style={body}>
        <ul style={listStyle}>
          {list.map((def) => {
            const isUnlocked = unlockedSet.has(def.id);
            return (
              <HeroCard
                key={def.id}
                accent={isUnlocked ? COLOR.success : COLOR.border.medium}
                title={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 16,
                      color: isUnlocked ? COLOR.gold.base : COLOR.ink.faint,
                      width: 18, display: 'inline-block', textAlign: 'center',
                    }}>{isUnlocked ? '★' : '◯'}</span>
                    {def.name}
                  </span>
                }
                subtitle={def.description}
                right={
                  <Chip tone={isUnlocked ? 'success' : 'gold'} size="sm">
                    +${formatCash(def.reward)}
                  </Chip>
                }
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const body: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: SPACE.m,
};
const listStyle: React.CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0,
  display: 'flex', flexDirection: 'column', gap: 6,
};
const tabBtn: React.CSSProperties = {
  background: 'transparent', color: COLOR.ink.muted, border: 0,
  padding: '6px 10px', borderRadius: RADIUS.xs, cursor: 'pointer',
  fontSize: 11, fontFamily: 'inherit',
  letterSpacing: '0.04em',
};
const tabActive: React.CSSProperties = {
  background: 'rgba(90,200,250,0.18)', color: COLOR.accent.cyan,
};
