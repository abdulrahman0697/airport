/**
 * Side launcher (Design pass DA).
 *
 * A collapsible vertical rail on the left edge that quick-opens the
 * three "personal progress" panels — Achievements, Leaders, Missions —
 * without the player having to hunt them in BottomTabs or the Office
 * dashboard. Sits below the top bar and above the bottom tabs, hugs
 * the safe-area inset, and never overlaps the map content because it
 * lives inside its own narrow strip.
 *
 * Two states (toggle persisted in uiStore):
 *  - **Expanded** — full rail with three SVG-iconed buttons.
 *  - **Collapsed** — a single small chevron tab that re-opens the rail.
 *
 * Includes a glowing tail color accent for the active panel and a
 * pending-badge dot when something is unclaimed (claimable mission +
 * unread achievement toasts in the future).
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { useUiStore } from '../../state/uiStore';
import {
  selectAchievements,
  selectDailyMissions,
  selectTailColor,
  useGameStore,
} from '../../state/store';
import { COLOR, MOTION, RADIUS, SHADOW, SPACE, TYPE } from '../design/tokens';
import { sfx } from '../juice/sfx';
import { haptics } from '../juice/haptics';
import { usePanelStore, type PanelId } from './PanelHost';

type LaunchTarget = Extract<PanelId, 'airport' | 'achievements' | 'leaders' | 'missions'>;

interface LaunchItem {
  id: LaunchTarget;
  label: string;
  Icon: React.FC<{ color: string }>;
}

const ITEMS: readonly LaunchItem[] = [
  { id: 'airport',      label: 'Home Airport', Icon: HomeAirportIcon },
  { id: 'leaders',      label: 'Leaderboards', Icon: LeaderIcon },
  { id: 'missions',     label: 'Daily Missions', Icon: MissionsIcon },
  { id: 'achievements', label: 'Achievements', Icon: TrophyIcon },
];

function HomeAirportIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 20V11l9-5 9 5v9" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 20h18" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 20v-6h6v6" stroke={color} strokeWidth="1.4" />
      {/* Tower */}
      <path d="M16 9l1.5-3 1.5 3" stroke={color} strokeWidth="1.2" />
      <circle cx={17.5} cy={5.6} r={0.8} fill={color} />
    </svg>
  );
}

export function SideLauncher() {
  const tailColor = useGameStore(selectTailColor);
  const activePanel = usePanelStore((s) => s.active);
  const open = usePanelStore((s) => s.open);
  const collapsed = useUiStore((s) => s.launcherCollapsed);
  const toggle = useUiStore((s) => s.toggleLauncher);

  // Pending-action signals so the rail can hint there's something to claim.
  const dailyMissions = useGameStore(selectDailyMissions);
  const claimableMissions = useMemo(() => {
    if (!dailyMissions) return 0;
    return dailyMissions.missions.filter((m) => !m.claimed && m.progress >= m.target).length;
  }, [dailyMissions]);
  // Reserved for future use — currently zero unread because toasts
  // are dismissed inline. The dot infrastructure is in place so we
  // can flip it on without further structural change.
  const unreadAchievements = useGameStore(selectAchievements).length > 0 ? 0 : 0;

  return (
    <div style={shellWrap}>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="rail"
            initial={{ x: -64, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -64, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={rail(tailColor) as Record<string, unknown>}
          >
            {ITEMS.map((item) => {
              const active = activePanel === item.id;
              const dot = item.id === 'missions' ? claimableMissions
                        : item.id === 'achievements' ? unreadAchievements
                        : 0;
              return (
                <button
                  key={item.id}
                  onClick={(): void => {
                    haptics.light();
                    sfx.tick();
                    open(item.id);
                  }}
                  aria-label={item.label}
                  title={item.label}
                  style={launchBtn(active ? tailColor : COLOR.border.medium, active, tailColor)}
                >
                  <item.Icon color={active ? tailColor : COLOR.ink.secondary} />
                  {dot > 0 && (
                    <span style={badge}>{dot}</span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Always-visible toggle tab */}
      <button
        onClick={(): void => {
          haptics.selection();
          sfx.tick();
          toggle();
        }}
        aria-label={collapsed ? 'Show side launcher' : 'Hide side launcher'}
        aria-expanded={!collapsed}
        style={toggleBtn(tailColor, collapsed)}
      >
        <ChevronGlyph direction={collapsed ? 'right' : 'left'} />
      </button>
    </div>
  );
}

/* ─── Glyphs ───────────────────────────────────────────────────────── */

function TrophyIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4z" stroke={color} strokeWidth="1.6" />
      <path d="M5 5H3a2 2 0 0 0 0 4h2M19 5h2a2 2 0 0 1 0 4h-2" stroke={color} strokeWidth="1.4" />
      <path d="M9 16h6l1 4H8l1-4z" stroke={color} strokeWidth="1.6" fill={`${color}26`} />
      <circle cx="12" cy="8" r="1" fill={color} />
    </svg>
  );
}

function LeaderIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* Tiered podium */}
      <rect x="4" y="13" width="5" height="7" rx="1" stroke={color} strokeWidth="1.4" />
      <rect x="9.5" y="9" width="5" height="11" rx="1" stroke={color} strokeWidth="1.6" fill={`${color}1F`} />
      <rect x="15" y="11" width="5" height="9" rx="1" stroke={color} strokeWidth="1.4" />
      {/* Star above the centre */}
      <path d="M12 4.5l1 2 2.2.3-1.6 1.5.4 2.2L12 9.5l-2 1 .4-2.2L8.8 6.8 11 6.5l1-2z"
            fill={color} />
    </svg>
  );
}

function MissionsIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* Clipboard */}
      <rect x="5" y="4" width="14" height="17" rx="2" stroke={color} strokeWidth="1.6" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" stroke={color} strokeWidth="1.4" fill={`${color}26`} />
      {/* Checked items */}
      <path d="M8 10l1.5 1.5L12 9" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 10h2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 14l1.5 1.5L12 13" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 14h2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronGlyph({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
      <path
        d={direction === 'right' ? 'M 4 3 L 9 7 L 4 11' : 'M 10 3 L 5 7 L 10 11'}
        stroke={COLOR.ink.primary}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */

const shellWrap: React.CSSProperties = {
  position: 'fixed',
  top: 'calc(var(--world-top) + 16px)',
  left: 0,
  // Strip + toggle hug the safe-area inset; the rail itself is offset
  // by 8 px from the device edge so it feels intentional, not glued on.
  paddingLeft: 'max(8px, env(safe-area-inset-left))',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 6,
  zIndex: 12,
  pointerEvents: 'none',
};

const rail = (tail: string): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: SPACE.s,
  padding: SPACE.s,
  background: COLOR.bg.elevated,
  border: `1px solid ${tail}33`,
  borderRadius: RADIUS.xl,
  boxShadow: SHADOW.hud,
  backdropFilter: 'blur(10px)',
  pointerEvents: 'auto',
});

const launchBtn = (border: string, active: boolean, tail: string): React.CSSProperties => ({
  position: 'relative',
  width: 44, height: 44,
  borderRadius: RADIUS.m,
  background: active ? `linear-gradient(140deg, ${tail}33, ${tail}11)` : 'rgba(11,17,32,0.4)',
  border: `1px solid ${border}`,
  cursor: 'pointer',
  display: 'grid', placeItems: 'center',
  padding: 0,
  fontFamily: 'inherit',
  transition: `background ${MOTION.duration.short}ms ${MOTION.easing.snap}, border-color ${MOTION.duration.short}ms ${MOTION.easing.snap}, box-shadow ${MOTION.duration.short}ms ${MOTION.easing.snap}`,
  boxShadow: active ? `0 0 14px ${tail}66, inset 0 0 18px ${tail}22` : 'none',
});

const badge: React.CSSProperties = {
  position: 'absolute',
  top: -4, right: -4,
  minWidth: 16, height: 16,
  borderRadius: RADIUS.pill,
  background: COLOR.gold.base,
  color: COLOR.bg.deep,
  fontSize: TYPE.tag.size,
  fontWeight: 800,
  letterSpacing: 0,
  display: 'grid', placeItems: 'center',
  padding: '0 4px',
  border: `2px solid ${COLOR.bg.canvas}`,
  boxShadow: `0 0 8px ${COLOR.gold.base}`,
};

const toggleBtn = (tail: string, collapsed: boolean): React.CSSProperties => ({
  // Sits as a small tab to the right of the rail (or alone when
  // collapsed). Top of the rail's first row vertically.
  marginTop: collapsed ? 0 : 6,
  width: 22, height: 56,
  borderTopRightRadius: RADIUS.s,
  borderBottomRightRadius: RADIUS.s,
  borderTopLeftRadius: 0,
  borderBottomLeftRadius: 0,
  background: COLOR.bg.elevated,
  border: `1px solid ${tail}33`,
  borderLeft: 0,
  cursor: 'pointer',
  display: 'grid', placeItems: 'center',
  padding: 0,
  pointerEvents: 'auto',
  boxShadow: SHADOW.card,
  alignSelf: collapsed ? 'flex-start' : 'center',
  fontFamily: 'inherit',
});
