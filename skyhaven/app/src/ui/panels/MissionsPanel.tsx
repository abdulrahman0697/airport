/**
 * Daily Missions panel — Design Review v3, point 18.
 *
 * Wrapper around DailyMissionsCard now adds the daily Scenario header:
 * a themed card (Morning Rush, Fuel Market Shock, Cargo Surge, etc.)
 * with a completion badge so the day reads as a story instead of three
 * unrelated chores.
 */
import { useMemo } from 'react';
import { scenarioForDate } from '../../data/dailyScenarios';
import { selectTailColor, useGameStore } from '../../state/store';
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

export function MissionsPanel() {
  const tailColor = useGameStore(selectTailColor);
  const seed = useGameStore((s) => s.state?.seed ?? 0);
  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const scenario = useMemo(() => scenarioForDate(todayKey, seed), [todayKey, seed]);
  const accent = ACCENT_HEX[scenario.accent] ?? tailColor;

  return (
    <div style={shell}>
      <PanelHeader
        kicker="Today"
        title="Daily Operations"
        subtitle="Themed scenario · three rotating objectives · resets at midnight (local)"
      />
      <div style={body}>
        {/* Scenario card */}
        <section style={scenarioCard(accent)}>
          <div style={scenarioHead}>
            <div>
              <div style={{ ...scenarioKicker, color: accent }}>SCENARIO  ·  {scenario.id.toUpperCase()}</div>
              <div style={scenarioTitle}>{scenario.title}</div>
              <div style={scenarioTagline}>{scenario.tagline}</div>
            </div>
            <div style={badgePill(accent)}>
              <span style={badgeKicker}>COMPLETION BADGE</span>
              <span style={{ ...badgeName, color: accent }}>{scenario.badge}</span>
            </div>
          </div>
          <div style={scenarioBriefing}>{scenario.briefing}</div>
        </section>

        <DailyMissionsCard />

        <p style={hint}>
          Mission progress tracks automatically as you play. Complete all three
          to claim today’s <strong style={{ color: accent }}>{scenario.badge}</strong> badge.
          A new scenario fires at midnight.
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
const badgePill = (accent: string): React.CSSProperties => ({
  textAlign: 'right',
  background: 'rgba(11,17,32,0.65)',
  border: `1px solid ${accent}55`,
  borderRadius: 10,
  padding: '8px 12px',
  minWidth: 130,
});
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
