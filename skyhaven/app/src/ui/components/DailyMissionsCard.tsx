/**
 * Daily missions card (BRD §14). Lives inside the Office panel.
 *
 * Each card row shows the mission label + description (with %target%
 * interpolated), a progress bar, and a Claim button that lights up
 * once `progress >= target`. Claim credits the reward and marks the
 * mission as done — no auto-claim so the player gets the satisfying
 * tap.
 */
import { getMissionTemplate } from '../../data/dailyMissions';
import { selectDailyMissions, useGameStore } from '../../state/store';
import { Button } from '../design/Button';
import { Chip } from '../design/Chip';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';

export function DailyMissionsCard() {
  const set = useGameStore(selectDailyMissions);
  const claim = useGameStore((s) => s.claimDailyMission);

  if (!set || set.missions.length === 0) {
    return (
      <section style={card}>
        <div style={sectionHead}>Daily Missions</div>
        <div style={empty}>Today's missions roll on the next tick.</div>
      </section>
    );
  }

  return (
    <section style={card}>
      <div style={sectionHead}>Daily Missions · {set.date}</div>
      <ul style={list}>
        {set.missions.map((m) => {
          const tmpl = getMissionTemplate(m.templateId);
          if (!tmpl) return null;
          const pct = Math.max(0, Math.min(1, m.progress / m.target));
          const done = m.progress >= m.target;
          const desc = tmpl.description.replace('%target%', String(m.target));
          const progDisplay = `${m.progress} / ${m.target}`;
          return (
            <li key={m.id} style={row}>
              <div style={rowMain}>
                <div style={rowName}>{tmpl.label}</div>
                <div style={rowDesc}>{desc}</div>
                <div style={progressTrack}>
                  <div style={{
                    ...progressFill,
                    width: `${pct * 100}%`,
                    background: m.claimed
                      ? 'rgba(148,163,184,0.5)'
                      : done
                        ? 'linear-gradient(90deg, #34D399, #F4C75B)'
                        : '#5AC8FA',
                  }} />
                </div>
                <div style={progressLabel}>
                  {m.claimed ? 'Claimed' : progDisplay}
                </div>
              </div>
              <div style={rewardCol}>
                <Chip tone={done ? 'gold' : 'mute'}>+${formatCash(m.reward)}</Chip>
                <Button
                  size="sm"
                  variant={m.claimed ? 'ghost' : done ? 'gold' : 'secondary'}
                  disabled={m.claimed || !done}
                  hapticOnPress={done ? 'medium' : 'light'}
                  onClick={(): void => {
                    const res = claim(m.id);
                    if (res.ok) haptics.success();
                  }}
                >
                  {m.claimed ? 'Claimed' : 'Claim'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 12, padding: '12px 14px',
  border: '1px solid rgba(255,255,255,0.06)',
};
const sectionHead: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: '#94A3B8', fontWeight: 700, marginBottom: 8,
  fontFeatureSettings: '"tnum" 1',
};
const empty: React.CSSProperties = { padding: 12, color: '#94A3B8', fontSize: 12, textAlign: 'center' };
const list: React.CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0,
  display: 'flex', flexDirection: 'column', gap: 8,
};
const row: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr auto', gap: 10,
  padding: '10px 12px',
  background: 'rgba(11,17,32,0.5)', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.06)',
};
const rowMain: React.CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0 };
const rowName: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#F8FAFC',
};
const rowDesc: React.CSSProperties = {
  fontSize: 11, color: '#94A3B8', marginTop: 2, lineHeight: 1.4,
};
const progressTrack: React.CSSProperties = {
  marginTop: 6,
  height: 6, background: 'rgba(255,255,255,0.06)',
  borderRadius: 3, overflow: 'hidden',
};
const progressFill: React.CSSProperties = {
  height: '100%', transition: 'width 280ms ease',
};
const progressLabel: React.CSSProperties = {
  fontSize: 10, color: '#94A3B8', marginTop: 4,
  fontFeatureSettings: '"tnum" 1',
};
const rewardCol: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
  justifyContent: 'space-between', gap: 6, minWidth: 80,
};
