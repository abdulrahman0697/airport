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
  type AchievementDef,
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

type TabId = AchievementCategory | 'pilotlog';

export function AchievementsPanel() {
  const unlocked = useGameStore(selectAchievements);
  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked]);
  const grouped = useMemo(() => achievementsByCategory(), []);
  // Design Review v3 — point 19. Default to the Pilot Log so the
  // player sees their collected badges first, with a "next stripe to
  // earn" cue at the bottom — a chronicle, not a checklist.
  const [tab, setTab] = useState<TabId>('pilotlog');

  const tier = frameTier(unlocked.length);
  const frame = FRAME_COLORS[tier];

  // Build the "log" view: unlocked-only, newest first by display order.
  const allDefs = useMemo<readonly AchievementDef[]>(() => {
    const out: AchievementDef[] = [];
    for (const c of CATEGORY_ORDER) for (const d of grouped[c]) out.push(d);
    return out;
  }, [grouped]);
  const pilotLogList = useMemo<readonly AchievementDef[]>(
    () => allDefs.filter((d) => unlockedSet.has(d.id)),
    [allDefs, unlockedSet],
  );
  const nextTargets = useMemo<readonly AchievementDef[]>(
    () => allDefs.filter((d) => !unlockedSet.has(d.id)).slice(0, 3),
    [allDefs, unlockedSet],
  );
  const list: readonly AchievementDef[] = tab === 'pilotlog' ? pilotLogList : grouped[tab];

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
            <button
              role="tab"
              onClick={(): void => setTab('pilotlog')}
              style={{ ...tabBtn, ...(tab === 'pilotlog' ? tabActive : {}) }}
            >
              ✦ Pilot Log {unlocked.length}
            </button>
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
        {tab === 'pilotlog' && list.length === 0 && (
          <div style={emptyLog}>
            <div style={{ fontSize: 28 }}>✦</div>
            <div style={{ marginTop: 6, fontWeight: 800, color: COLOR.ink.primary }}>
              Your Pilot Log is empty
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: COLOR.ink.muted, maxWidth: 280, lineHeight: 1.5 }}>
              Open your first route, buy a second aircraft, and earn your first badges. The chronicle starts the moment your airline does.
            </div>
          </div>
        )}
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
        {tab === 'pilotlog' && nextTargets.length > 0 && (
          <section style={nextStripes}>
            <div style={nextStripesHead}>NEXT STRIPES TO EARN</div>
            <ul style={listStyle}>
              {nextTargets.map((def) => (
                <HeroCard
                  key={`next-${def.id}`}
                  accent={COLOR.gold.base}
                  title={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, color: COLOR.gold.base }}>◇</span>
                      {def.name}
                    </span>
                  }
                  subtitle={def.description}
                  right={<Chip tone="gold" size="sm">+${formatCash(def.reward)}</Chip>}
                />
              ))}
            </ul>
          </section>
        )}
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
const emptyLog: React.CSSProperties = {
  textAlign: 'center',
  padding: '24px 16px 16px',
  color: COLOR.ink.muted,
};
const nextStripes: React.CSSProperties = {
  marginTop: SPACE.l,
  borderTop: `1px solid ${COLOR.border.soft}`,
  paddingTop: SPACE.m,
};
const nextStripesHead: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.22em',
  color: COLOR.gold.base, fontWeight: 800,
  marginBottom: SPACE.s,
};
const tabActive: React.CSSProperties = {
  background: 'rgba(90,200,250,0.18)', color: COLOR.accent.cyan,
};
