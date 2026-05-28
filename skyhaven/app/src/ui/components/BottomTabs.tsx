import { useGameStore, selectFleet, selectRoutes, selectTier, selectTutorialCompleted } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
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
  /** Tab is visible from the start. */
  alwaysOn?: boolean;
  /** Predicate over game state — when true, tab unlocks. */
  unlock?: (s: { fleetSize: number; routeCount: number; tier: number; tutorialDone: boolean }) => boolean;
  /** Short unlock copy shown on the reveal animation. */
  unlockHint?: string;
}

/**
 * Design Review v3 — point 22. Progressive tab unlocking.
 *
 * Showing six tabs to a new player is overwhelming and makes the game
 * read as "heavy management". We start with just Network (map) and
 * Hangar, then reveal each tab when it actually matters:
 *
 *  - Operations  ← first route opened
 *  - Staff HQ    ← first hub created (managers become hireable)
 *  - Control Tower ← Tier 3 reached
 *  - Executive Deals ← tutorial complete (monetization surface)
 *
 * Locked tabs are simply not rendered. When a tab reveals, the bar
 * gently re-flows. The aviation theme is preserved.
 */
const TABS: readonly TabSpec[] = [
  { id: 'map',     label: 'Network',         Icon: NetworkIcon, alwaysOn: true },
  { id: 'fleet',   label: 'Hangar',          Icon: HangarIcon,  alwaysOn: true },
  { id: 'routes',  label: 'Operations',      Icon: OperationsIcon,
    unlock: (s) => s.fleetSize >= 2 || s.routeCount >= 1 || !s.tutorialDone,
    unlockHint: 'First route launched' },
  { id: 'crew',    label: 'Staff HQ',        Icon: StaffIcon,
    unlock: (s) => s.tier >= 2 || (s.tutorialDone && s.fleetSize >= 2),
    unlockHint: 'Hub managers available' },
  { id: 'leaders', label: 'Control Tower',   Icon: TowerIcon,
    unlock: (s) => s.tier >= 3 || s.tutorialDone, unlockHint: 'Leaderboards unlocked' },
  { id: 'store',   label: 'Executive Deals', Icon: DealsIcon,
    unlock: (s) => s.tutorialDone, unlockHint: 'Premium services unlocked' },
];

export function BottomTabs() {
  const active = usePanelStore((s) => s.active);
  const open = usePanelStore((s) => s.open);
  const close = usePanelStore((s) => s.close);
  const fleet = useGameStore(selectFleet);
  const routes = useGameStore(selectRoutes);
  const tier = useGameStore(selectTier);
  const tutorialDone = useGameStore(selectTutorialCompleted);
  const mapMode = useUiStore((s) => s.mapMode);
  const setMapMode = useUiStore((s) => s.setMapMode);
  const tutorialTarget = useUiStore((s) => s.tutorialTarget);

  const ctx = {
    fleetSize: fleet.length,
    routeCount: routes.length,
    tier,
    tutorialDone,
  };

  const visibleTabs = TABS.filter((t) => t.alwaysOn || (t.unlock && t.unlock(ctx)));

  const needsAttention = useGameStore((s) =>
    (s.state?.fleet ?? []).reduce((n, a) => n + (conditionBand(a.condition) !== 'normal' ? 1 : 0), 0),
  );

  // Tap-path guidance — Design Review v4, point 9. If the tutorial is
  // currently targeting one of the bottom tabs, dim the non-target
  // tabs and add a pulsing ring around the highlighted one.
  const targetIsTab = tutorialTarget && /-tab$/.test(tutorialTarget);
  const guidedTabId = targetIsTab ? tutorialTarget.replace(/-tab$/, '') : null;

  return (
    <nav style={{ ...shell, gridTemplateColumns: `repeat(${visibleTabs.length + 1}, 1fr)` }} aria-label="Main">
      {/* Home button — always first, always lights up the home airport. */}
      <button
        onClick={(): void => { close(); setMapMode(false); }}
        style={{
          ...btn,
          ...((!mapMode && active === null) ? btnActive : {}),
          ...(guidedTabId && guidedTabId !== 'home' ? dimmedBtn : {}),
        }}
        aria-label="Home Airport"
        aria-current={(!mapMode && active === null) ? 'page' : undefined}
      >
        <HomeGlyph active={!mapMode && active === null} />
        <span style={label}>Home</span>
      </button>
      {visibleTabs.map((t) => {
        const isActive = t.id === 'map'
          ? (mapMode && active === null)
          : active === t.id;
        const showBadge = t.id === 'fleet' && needsAttention > 0;
        const isGuidedTarget = guidedTabId === t.id;
        const isDimmed = guidedTabId !== null && !isGuidedTarget;
        return (
          <button
            key={t.id}
            data-tutorial={`${t.id}-tab`}
            onClick={(): void => {
              if (t.id === 'map') { close(); setMapMode(true); }
              else { open(t.id); setMapMode(false); }
            }}
            style={{
              ...btn,
              ...(isActive ? btnActive : {}),
              ...(isDimmed ? dimmedBtn : {}),
              ...(isGuidedTarget ? guidedBtn : {}),
            }}
            aria-label={t.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <t.Icon size={20} color={isGuidedTarget ? '#F4C75B' : isActive ? '#5AC8FA' : '#94A3B8'} />
            <span style={label}>{t.label}</span>
            {showBadge && <span style={badge}>{needsAttention}</span>}
            {isGuidedTarget && <span style={guidedRing} aria-hidden />}
          </button>
        );
      })}
    </nav>
  );
}

function HomeGlyph({ active }: { active: boolean }) {
  const c = active ? '#5AC8FA' : '#94A3B8';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 11 L12 4 L20 11 V20 H4 Z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      <rect x={9} y={13} width={6} height={7} stroke={c} strokeWidth="1.4" />
      <circle cx={12} cy={9} r={1} fill={c} />
    </svg>
  );
}

const shell: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'grid',
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

// Tap-path guidance styles (Design Review v4 — point 9).
const dimmedBtn: React.CSSProperties = {
  opacity: 0.28,
  filter: 'saturate(0.4)',
  transition: 'opacity 240ms ease, filter 240ms ease',
};
const guidedBtn: React.CSSProperties = {
  background: 'radial-gradient(ellipse at center, rgba(244,199,91,0.18), transparent 70%)',
  color: '#F4C75B',
};
const guidedRing: React.CSSProperties = {
  position: 'absolute',
  inset: 4,
  borderRadius: 14,
  border: '2px solid #F4C75B',
  boxShadow: '0 0 14px rgba(244,199,91,0.6), inset 0 0 8px rgba(244,199,91,0.3)',
  animation: 'breathe 1.4s ease-in-out infinite',
  pointerEvents: 'none',
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
