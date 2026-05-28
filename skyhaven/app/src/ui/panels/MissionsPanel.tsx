/**
 * Daily Operations Scenarios panel — Design Review v6, point 23.
 *
 * The themed scenario card now includes a live countdown to midnight
 * reset and a clear three-objective checklist with progress bars, so
 * a day reads as an operational situation with a timer, not a list
 * of chores.
 */
import { useEffect, useMemo, useState } from 'react';
import { scenarioForDate } from '../../data/dailyScenarios';
import {
  selectAirlineCode,
  selectDailyMissions,
  selectTailColor,
  useGameStore,
} from '../../state/store';
import { getMissionTemplate } from '../../data/dailyMissions';
import { DailyMissionsCard } from '../components/DailyMissionsCard';
import { PanelHeader } from '../design/PanelHeader';
import { COLOR, RADIUS, SPACE } from '../design/tokens';

const ACCENT_HEX: Record<string, string> = {
  cyan: COLOR.accent.cyan,
  gold: COLOR.gold.base,
  success: COLOR.success,
  warn: COLOR.warn,
  danger: COLOR.danger,
  violet: COLOR.accent.violet,
};

function useTimeUntilMidnight(): string {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  // tick dep is intentional — re-evaluates clock every 30s.
  return useMemo(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    const diff = midnight.getTime() - now.getTime();
    const h = Math.floor(diff / 3600_000);
    const m = Math.floor((diff - h * 3600_000) / 60_000);
    return `${h}h ${String(m).padStart(2, '0')}m`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
}

export function MissionsPanel() {
  const tailColor = useGameStore(selectTailColor);
  const code = useGameStore(selectAirlineCode);
  const seed = useGameStore((s) => s.state?.seed ?? 0);
  const daily = useGameStore(selectDailyMissions);
  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const scenario = useMemo(() => scenarioForDate(todayKey, seed), [todayKey, seed]);
  const accent = ACCENT_HEX[scenario.accent] ?? tailColor;
  const timeLeft = useTimeUntilMidnight();

  // Three objectives, in scenario order. Each one maps to the live
  // mission progress so the checklist mirrors gameplay.
  const objectives = useMemo(() => {
    if (!daily) return [] as Array<{ label: string; pct: number; done: boolean; reward: number; tag: string }>;
    return scenario.templates.map((tplId) => {
      const m = daily.missions.find((mm) => mm.templateId === tplId);
      if (!m) return null;
      const tpl = getMissionTemplate(m.templateId);
      const label = (tpl?.description ?? '').replace('%target%', String(m.target));
      const pct = m.target > 0 ? Math.min(1, m.progress / m.target) : 1;
      return {
        label,
        pct,
        done: m.claimed || pct >= 1,
        reward: m.reward,
        tag: tpl?.label ?? 'Objective',
      };
    }).filter((x): x is { label: string; pct: number; done: boolean; reward: number; tag: string } => x !== null);
  }, [daily, scenario]);

  const completedObjectives = objectives.filter((o) => o.done).length;
  const allDone = objectives.length > 0 && completedObjectives === objectives.length;

  return (
    <div style={shell}>
      <PanelHeader
        kicker="Today"
        title="Daily Operations"
        subtitle={`Live scenario · resets in ${timeLeft}`}
      />
      <div style={body}>
        {/* Scenario card — Design Review v6 point 23. Now reads as a
            live situation with a clock + three checkbox objectives,
            not a static themed header. */}
        <section style={scenarioCard(accent)}>
          <div style={scenarioHead}>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...scenarioKicker, color: accent }}>{code} OPS  ·  SCENARIO</div>
              <div style={scenarioTitle}>{scenario.title}</div>
              <div style={scenarioTagline}>{scenario.tagline}</div>
            </div>
            <div style={timerPill(accent)}>
              <div style={timerKicker}>RESETS IN</div>
              <div style={{ ...timerValue, color: accent }}>{timeLeft}</div>
            </div>
          </div>
          <div style={scenarioBriefing}>{scenario.briefing}</div>

          {/* Three objectives — checklist with progress bars. */}
          <div style={objectivesList}>
            {objectives.map((obj, i) => (
              <div key={i} style={objectiveRow}>
                <div style={objectiveCheck(obj.done, accent)}>
                  {obj.done ? '✓' : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={objectiveText(obj.done)}>{obj.label}</div>
                  <div style={objectiveBar}>
                    <div style={{
                      ...objectiveBarFill,
                      width: `${obj.pct * 100}%`,
                      background: obj.done ? COLOR.success : accent,
                    }} />
                  </div>
                </div>
                <div style={objectiveReward}>+${obj.reward.toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div style={badgeFooter(accent, allDone)}>
            <span style={badgeKicker}>COMPLETION BADGE</span>
            <span style={{ ...badgeName, color: allDone ? COLOR.success : accent }}>
              {allDone ? `★ ${scenario.badge}` : scenario.badge}
            </span>
            {allDone && <span style={badgeUnlocked}>UNLOCKED</span>}
          </div>
        </section>

        <DailyMissionsCard />

        <p style={hint}>
          Mission progress tracks automatically. Three objectives + one
          completion badge per day. New scenario at midnight local.
        </p>
      </div>
    </div>
  );
}

const shell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};
const body: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: SPACE.m,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACE.m,
};
const scenarioCard = (accent: string): React.CSSProperties => ({
  background: `linear-gradient(150deg, ${accent}1a, rgba(11,17,32,0.75))`,
  borderLeft: `4px solid ${accent}`,
  border: `1px solid ${accent}33`,
  borderRadius: RADIUS.m,
  padding: '14px 16px 12px',
  boxShadow: `0 8px 18px rgba(0,0,0,0.4), 0 0 18px ${accent}22`,
});
const scenarioHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: SPACE.m,
};
const scenarioKicker: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.22em',
};
const scenarioTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: COLOR.ink.primary,
  marginTop: 2,
  letterSpacing: '0.01em',
};
const scenarioTagline: React.CSSProperties = {
  fontSize: 12,
  color: COLOR.ink.muted,
  marginTop: 4,
  fontStyle: 'italic',
};
const scenarioBriefing: React.CSSProperties = {
  fontSize: 12,
  color: COLOR.ink.secondary,
  marginTop: 10,
  lineHeight: 1.5,
};
const timerPill = (accent: string): React.CSSProperties => ({
  textAlign: 'right',
  background: 'rgba(11,17,32,0.7)',
  border: `1px solid ${accent}55`,
  borderRadius: 10,
  padding: '8px 12px',
  minWidth: 92,
  flexShrink: 0,
});
const timerKicker: React.CSSProperties = {
  fontSize: 8,
  letterSpacing: '0.18em',
  fontWeight: 800,
  color: '#94A3B8',
};
const timerValue: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};
const objectivesList: React.CSSProperties = {
  marginTop: SPACE.m,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const objectiveRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'rgba(11,17,32,0.5)',
  border: '1px solid rgba(148,163,184,0.18)',
  borderRadius: 8,
  padding: '6px 10px',
};
const objectiveCheck = (done: boolean, accent: string): React.CSSProperties => ({
  width: 22,
  height: 22,
  borderRadius: 6,
  border: `1.5px solid ${done ? COLOR.success : accent}`,
  background: done ? `${COLOR.success}22` : `${accent}1c`,
  color: done ? COLOR.success : accent,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 900,
  flexShrink: 0,
});
const objectiveText = (done: boolean): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 600,
  color: done ? '#94A3B8' : '#F8FAFC',
  textDecoration: done ? 'line-through' : 'none',
  lineHeight: 1.35,
});
const objectiveBar: React.CSSProperties = {
  marginTop: 4,
  height: 3,
  background: 'rgba(148,163,184,0.18)',
  borderRadius: 999,
  overflow: 'hidden',
};
const objectiveBarFill: React.CSSProperties = {
  height: '100%',
  transition: 'width 320ms ease',
};
const objectiveReward: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: COLOR.gold.base,
  fontFeatureSettings: '"tnum" 1',
  flexShrink: 0,
};
const badgeFooter = (accent: string, all: boolean): React.CSSProperties => ({
  marginTop: SPACE.m,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: all ? `${COLOR.success}1c` : 'rgba(11,17,32,0.6)',
  border: `1px dashed ${all ? COLOR.success : accent}66`,
  borderRadius: 8,
  padding: '8px 10px',
});
const badgeUnlocked: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: '0.18em',
  color: COLOR.success,
};
const badgeKicker: React.CSSProperties = {
  display: 'block',
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.18em',
  color: COLOR.ink.faint,
};
const badgeName: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.04em',
  marginTop: 2,
};
const hint: React.CSSProperties = {
  margin: 0,
  padding: SPACE.m,
  fontSize: 11,
  color: COLOR.ink.faint,
  textAlign: 'center',
  lineHeight: 1.5,
};
