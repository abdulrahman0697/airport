/**
 * Dedicated Daily Missions panel (Design pass DA).
 *
 * Pulls the DailyMissionsCard out of the Office panel into its own
 * full-width surface — the SideLauncher pip on the left edge opens
 * it directly so a player chasing today's missions doesn't have to
 * navigate through the Office dashboard first.
 */
import { DailyMissionsCard } from '../components/DailyMissionsCard';
import { PanelHeader } from '../design/PanelHeader';
import { COLOR, SPACE } from '../design/tokens';

export function MissionsPanel() {
  return (
    <div style={shell}>
      <PanelHeader
        kicker="Today"
        title="Daily Missions"
        subtitle="Three rotating objectives. Reset at midnight (local)."
      />
      <div style={body}>
        <DailyMissionsCard />
        <p style={hint}>
          Earnings, route opens, repairs and other actions are tracked
          automatically. Tap Claim when a mission completes.
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
const hint: React.CSSProperties = {
  margin: 0,
  padding: SPACE.m,
  fontSize: 11,
  color: COLOR.ink.faint,
  textAlign: 'center',
  lineHeight: 1.5,
};
