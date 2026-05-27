import { useGameStore } from '../../state/store';
import { conditionBand } from '../../engine/condition';
import { usePanelStore, type PanelId } from './PanelHost';

interface TabSpec {
  id: Exclude<PanelId, null> | 'map';
  label: string;
  icon: string;
}

const TABS: readonly TabSpec[] = [
  { id: 'map', label: 'Map', icon: '◯' },
  { id: 'routes', label: 'Routes', icon: '↗' },
  { id: 'fleet', label: 'Fleet', icon: '✈' },
  { id: 'crew', label: 'Crew', icon: '◆' },
  { id: 'leaders', label: 'Leaders', icon: '🏆' },
  { id: 'store', label: 'Store', icon: '$' },
];

export function BottomTabs() {
  const active = usePanelStore((s) => s.active);
  const open = usePanelStore((s) => s.open);
  const close = usePanelStore((s) => s.close);

  // "Needs attention" badge on the Fleet tab.
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
            <span style={icon}>{t.icon}</span>
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
  gap: 2,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnActive: React.CSSProperties = {
  color: '#5AC8FA',
};

const icon: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
};

const label: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const badge: React.CSSProperties = {
  position: 'absolute',
  top: 8,
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
};
