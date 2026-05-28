import { useGameStore } from '../../state/store';
import { conditionBand } from '../../engine/condition';
import {
  DealsIcon,
  HangarIcon,
  NetworkIcon,
  OperationsIcon,
  StaffIcon,
  TowerIcon,
  type IconProps,
} from '../design/icons';
import { usePanelStore, type PanelId } from './PanelHost';

interface TabSpec {
  id: Exclude<PanelId, null> | 'map';
  label: string;
  Icon: React.FC<IconProps>;
}

/**
 * Aviation-themed tab labels (Design Review v2 — point 9).
 *  Map → Network (radar)
 *  Routes → Operations (paper-plane launch arrow)
 *  Fleet → Hangar (boxy hangar with plane silhouette)
 *  Crew → Staff HQ (two-person)
 *  Leaders → Control Tower (tower with antenna)
 *  Store → Executive Deals (briefcase)
 *
 * Achievements + Missions live on the SideLauncher (Phase DA), so
 * the bottom row stays at 6 columns and reads as the airport
 * operations bar.
 */
const TABS: readonly TabSpec[] = [
  { id: 'map',     label: 'Network',         Icon: NetworkIcon },
  { id: 'routes',  label: 'Operations',      Icon: OperationsIcon },
  { id: 'fleet',   label: 'Hangar',          Icon: HangarIcon },
  { id: 'crew',    label: 'Staff HQ',        Icon: StaffIcon },
  { id: 'leaders', label: 'Control Tower',   Icon: TowerIcon },
  { id: 'store',   label: 'Executive Deals', Icon: DealsIcon },
];

export function BottomTabs() {
  const active = usePanelStore((s) => s.active);
  const open = usePanelStore((s) => s.open);
  const close = usePanelStore((s) => s.close);

  // "Needs attention" badge on the Hangar tab when an aircraft
  // condition has slipped into degraded / critical.
  const needsAttention = useGameStore((s) =>
    (s.state?.fleet ?? []).reduce((n, a) => n + (conditionBand(a.condition) !== 'normal' ? 1 : 0), 0),
  );

  return (
    <nav style={shell} aria-label="Main">
      {TABS.map((t) => {
        const isActive = t.id === 'map' ? active === null : active === t.id;
        const showBadge = t.id === 'fleet' && needsAttention > 0;
        return (
          <button
            key={t.id}
            data-tutorial={`${t.id}-tab`}
            onClick={(): void => {
              if (t.id === 'map') close();
              else open(t.id);
            }}
            style={{ ...btn, ...(isActive ? btnActive : {}) }}
            aria-label={t.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <t.Icon size={20} color={isActive ? '#5AC8FA' : '#94A3B8'} />
            <span style={label}>{t.label}</span>
            {showBadge && <span style={badge}>{needsAttention}</span>}
          </button>
        );
      })}
    </nav>
  );
}

const shell: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  background: 'rgba(11,17,32,0.92)',
  backdropFilter: 'blur(12px)',
  borderTop: '1px solid rgba(255,255,255,0.06)',
  paddingBottom: 'env(safe-area-inset-bottom)',
  zIndex: 30,
};

const btn: React.CSSProperties = {
  position: 'relative',
  background: 'transparent',
  border: 0,
  color: '#94A3B8',
  height: 64,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: 0,
};

const btnActive: React.CSSProperties = {
  color: '#5AC8FA',
};

const label: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontWeight: 700,
};

const badge: React.CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 'calc(50% - 20px)',
  minWidth: 16,
  height: 16,
  padding: '0 4px',
  background: '#F59E0B',
  color: '#0B1120',
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '2px solid rgba(11,17,32,0.92)',
};
