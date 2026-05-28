/**
 * HomeShell — image-first home tab.
 *
 * Layout (top → bottom):
 *
 *   [ tiny gap under TopBar ]
 *   ┌─────────────────────────────────────┐
 *   │  Airport scene image                │
 *   │  · Hub IATA tag (top-left)          │  ← flex-grows to fill the
 *   │  · Control Tower pill (right)       │    available vertical space
 *   │  · Boarding · N routes (right-bot)  │
 *   └─────────────────────────────────────┘
 *   [ Buy ]  [ Your Hangar ]  [ Upgrade ]   ← three tile cards
 *   ── Live network strip ──
 *   [ CEO Office                       › ]   ← pinned just above tabs
 *
 * Scene + 3 tiles use cropped pieces of the original mockup
 * (public/home-scene.jpg and public/tile-*.jpg) so the assets stay
 * consistent while each piece can size independently. The scene has
 * `flex: 1` + `objectFit: cover` so it absorbs whatever vertical
 * space is left between the TopBar and the CEO button.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadTopAirports } from '../../data/airports';
import { conditionBand } from '../../engine/condition';
import {
  selectAchievements,
  selectDailyMissions,
  selectFleet,
  selectHubs,
  selectRoutes,
  selectTailColor,
  selectTutorialCompleted,
  useGameStore,
} from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { COLOR, RADIUS, SHADOW } from '../design/tokens';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';
import { usePanelStore } from './PanelHost';

const SCENE_IMAGE = '/home-scene.jpg';
const TILE_BUY = '/tile-buy.jpg';
const TILE_HANGAR = '/tile-hangar.jpg';
const TILE_AIRPORT = '/tile-airport.jpg';

export function HomeShell() {
  const tailColor = useGameStore(selectTailColor);
  const routes = useGameStore(selectRoutes);
  const fleet = useGameStore(selectFleet);
  const hubs = useGameStore(selectHubs);
  const fuel = useGameStore((s) => s.state?.fuel);
  const tutorialDone = useGameStore(selectTutorialCompleted);
  const dailyMissions = useGameStore(selectDailyMissions);

  const activePanel = usePanelStore((s) => s.active);
  const openPanel = usePanelStore((s) => s.open);
  const mapMode = useUiStore((s) => s.mapMode);
  const setMapMode = useUiStore((s) => s.setMapMode);
  const introDismissed = useUiStore((s) => s.introDismissed);
  const setFleetTabIntent = useUiStore((s) => s.setFleetTabIntent);
  const setRoutesTabIntent = useUiStore((s) => s.setRoutesTabIntent);
  const setEmpireJourneyOpen = useUiStore((s) => s.setEmpireJourneyOpen);

  const claimableMissions = useMemo(() => {
    if (!dailyMissions) return 0;
    return dailyMissions.missions.filter((m) => !m.claimed && m.progress >= m.target).length;
  }, [dailyMissions]);
  // Wire-in so achievements ever surface an unread dot in the future.
  useGameStore(selectAchievements);

  const visible = introDismissed && activePanel === null && !mapMode;
  const [hidden, setHidden] = useState(!tutorialDone);
  useEffect(() => {
    setHidden(!tutorialDone);
  }, [tutorialDone]);

  const avgCondition = useMemo(() => {
    if (fleet.length === 0) return 100;
    let total = 0;
    for (const a of fleet) total += a.condition;
    return total / fleet.length;
  }, [fleet]);
  const condBand = conditionBand(avgCondition);
  const condColor = condBand === 'normal' ? COLOR.success
    : condBand === 'degraded' ? COLOR.warn
    : COLOR.danger;

  const homeHub = hubs[0];
  const hubIata = homeHub?.iata || '???';
  const hubCity = useMemo(() => {
    if (!homeHub) return '—';
    const ap = loadTopAirports().find((a) => a.iata === homeHub.iata);
    return ap?.city || homeHub.iata;
  }, [homeHub]);

  const go = (
    panel: 'fleet' | 'routes' | 'tower' | 'office' | 'fuel' | 'leaders' | 'achievements' | 'missions',
    extra?: () => void,
  ): void => {
    haptics.medium();
    sfx.confirm();
    extra?.();
    openPanel(panel);
  };

  if (!visible || hidden) return null;

  return (
    <div style={shell}>
      {/* ── Main airport scene — flex-grows to fill ───────────────── */}
      <div style={sceneWrap(tailColor)}>
        <img src={SCENE_IMAGE} alt="" style={sceneImg} draggable={false} />

        <div style={hubTag(tailColor)} aria-label={`Home hub ${hubIata}`}>
          <div style={hubIataLine}>{hubIata}</div>
          <div style={hubCityLine}>{hubCity}</div>
        </div>

        {/* Radar Watch Tower — taps open the world-network view. */}
        <WatchTowerRadar onTap={(): void => {
          haptics.medium();
          sfx.confirm();
          setMapMode(true);
        }} />

        {/* Fuel gauge, embedded on the apron in the bottom-left. */}
        {fuel && (
          <HomeFuelBadge
            reserve={fuel.reserve}
            capacity={fuel.capacity}
            supplyRate={fuel.supplyRate}
            demandRate={fuel.demandRate}
            onTap={(): void => go('fuel')}
          />
        )}

        <button
          onClick={(): void => go('routes')}
          style={boardingTag}
          aria-label={`See routes — ${routes.length} active`}
        >
          <span style={boardingDot} />
          <span style={boardingLabel}>Boarding</span>
          <span style={boardingCount}>{routes.length} route{routes.length === 1 ? '' : 's'}</span>
        </button>
      </div>

      {/* ── Three action tiles ───────────────────────────────────── */}
      <div style={tilesRow}>
        <Tile
          bg={TILE_BUY}
          title="Buy a New Aircraft"
          subtitle={`${fleet.length} owned`}
          accent={COLOR.accent.cyan}
          onClick={(): void => go('fleet', () => setFleetTabIntent('buy'))}
        />
        <Tile
          bg={TILE_HANGAR}
          title="Your Hangar"
          subtitle={`${Math.round(avgCondition)}% avg cond`}
          accent={tailColor}
          subtitleColor={condColor}
          onClick={(): void => go('fleet', () => setFleetTabIntent('owned'))}
        />
        <Tile
          bg={TILE_AIRPORT}
          title="Upgrade Your Airport"
          subtitle={`${hubs.length} hub${hubs.length === 1 ? '' : 's'}`}
          accent={COLOR.gold.base}
          onClick={(): void => go('routes', () => setRoutesTabIntent('hubs'))}
        />
      </div>

      {/* ── Live network strip ───────────────────────────────────── */}
      <LiveNetworkStrip tailColor={tailColor} />

      {/* ── Four quick launchers (relocated from the network side
            rail) — Empire Journey, Leaderboards, Daily Operations,
            Pilot Log. ───────────────────────────────────────────── */}
      <div style={launcherRow}>
        <LauncherTile
          accent={tailColor}
          label="Empire Journey"
          Icon={JourneyIcon}
          onClick={(): void => {
            haptics.light();
            sfx.tick();
            setEmpireJourneyOpen(true);
          }}
        />
        <LauncherTile
          accent={tailColor}
          label="Leaderboards"
          Icon={LeaderIcon}
          onClick={(): void => {
            haptics.light();
            sfx.tick();
            openPanel('leaders');
          }}
        />
        <LauncherTile
          accent={tailColor}
          label="Daily Missions"
          Icon={MissionsIcon}
          dot={claimableMissions}
          onClick={(): void => {
            haptics.light();
            sfx.tick();
            openPanel('missions');
          }}
        />
        <LauncherTile
          accent={tailColor}
          label="Pilot Log"
          Icon={TrophyIcon}
          onClick={(): void => {
            haptics.light();
            sfx.tick();
            openPanel('achievements');
          }}
        />
      </div>
    </div>
  );
}

function Tile({
  bg, title, subtitle, accent, subtitleColor, onClick,
}: {
  bg: string;
  title: string;
  subtitle: string;
  accent: string;
  subtitleColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...tileBtn,
        backgroundImage: `linear-gradient(180deg, rgba(7,11,24,0.0) 0%, rgba(7,11,24,0.45) 45%, rgba(7,11,24,0.92) 100%), url('${bg}')`,
        borderColor: `${accent}66`,
        boxShadow: `0 6px 16px rgba(0,0,0,0.5), 0 0 14px ${accent}26, inset 0 -2px 0 ${accent}44`,
      }}
    >
      <span style={tileTitle}>{title}</span>
      <span style={{ ...tileSubtitle, color: subtitleColor ?? COLOR.ink.muted }}>{subtitle}</span>
    </button>
  );
}

/* ─── Radar / Watch Tower ─────────────────────────────────────────── */
/* Sweeping green radar with three blip dots that fade in and out at
   pseudo-random angles. The whole thing is wrapped in a button so a
   tap on the sweep, the dots or the "Watch Tower" label all open the
   world-network view. */
function WatchTowerRadar({ onTap }: { onTap: () => void }) {
  // Re-roll blip positions every ~3s so the radar feels alive.
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSeed((s) => s + 1), 3000);
    return () => window.clearInterval(id);
  }, []);
  const blips = useMemo(() => {
    // Deterministic pseudo-random from seed so React re-renders are stable.
    const rand = (n: number): number => {
      const x = Math.sin(seed * 1000 + n * 137.5) * 43758.5453;
      return x - Math.floor(x);
    };
    return [0, 1, 2].map((i) => {
      const r = 8 + rand(i) * 22;
      const theta = rand(i + 10) * Math.PI * 2;
      return { x: 38 + Math.cos(theta) * r, y: 38 + Math.sin(theta) * r, delay: i * 700 };
    });
  }, [seed]);

  return (
    <button
      onClick={onTap}
      style={radarWrap}
      aria-label="Watch Tower — open Network view"
    >
      <span style={radarLabel}>Watch Tower</span>
      <div style={radarDisc}>
        <svg width={76} height={76} viewBox="0 0 76 76" style={{ display: 'block' }}>
          <defs>
            <radialGradient id="radar-grad" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="rgba(52,211,153,0.55)" />
              <stop offset="0.7" stopColor="rgba(52,211,153,0.18)" />
              <stop offset="1" stopColor="rgba(52,211,153,0.05)" />
            </radialGradient>
            <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(52,211,153,0)" />
              <stop offset="0.92" stopColor="rgba(52,211,153,0.7)" />
              <stop offset="1" stopColor="rgba(52,211,153,1)" />
            </linearGradient>
          </defs>
          {/* Glass disc */}
          <circle cx={38} cy={38} r={34} fill="url(#radar-grad)" stroke="rgba(52,211,153,0.55)" strokeWidth={1} />
          {/* Concentric range rings */}
          <circle cx={38} cy={38} r={22} fill="none" stroke="rgba(52,211,153,0.35)" strokeWidth={0.6} />
          <circle cx={38} cy={38} r={11} fill="none" stroke="rgba(52,211,153,0.35)" strokeWidth={0.6} />
          {/* Cross-hair */}
          <line x1={4} y1={38} x2={72} y2={38} stroke="rgba(52,211,153,0.25)" strokeWidth={0.5} />
          <line x1={38} y1={4} x2={38} y2={72} stroke="rgba(52,211,153,0.25)" strokeWidth={0.5} />
          {/* Sweeping arm — a wedge that rotates around the centre */}
          <g style={{ transformOrigin: '38px 38px', animation: 'radar-sweep 2.6s linear infinite' }}>
            <path d="M 38 38 L 72 38 A 34 34 0 0 0 56 9 Z" fill="url(#radar-sweep)" opacity={0.9} />
          </g>
          {/* Random blips that breathe */}
          {blips.map((b, i) => (
            <circle
              key={`${seed}-${i}`}
              cx={b.x}
              cy={b.y}
              r={1.6}
              fill="#34D399"
              style={{
                filter: 'drop-shadow(0 0 4px #34D399)',
                animation: `radar-blip 2.6s ease-out ${b.delay}ms infinite`,
              }}
            />
          ))}
          {/* Central node */}
          <circle cx={38} cy={38} r={1.6} fill="#34D399" />
        </svg>
      </div>
    </button>
  );
}

/* ─── Embedded fuel gauge (replaces the floating one on home) ──── */
function HomeFuelBadge({
  reserve, capacity, supplyRate, demandRate, onTap,
}: {
  reserve: number;
  capacity: number;
  supplyRate: number;
  demandRate: number;
  onTap: () => void;
}) {
  // Smooth the displayed reserve so the bar doesn't jitter on each tick.
  const [shown, setShown] = useState(reserve);
  const shownRef = useRef(reserve);
  const targetRef = useRef(reserve);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    targetRef.current = reserve;
    if (rafRef.current) return;
    const step = (): void => {
      const tgt = targetRef.current;
      const cur = shownRef.current;
      const diff = tgt - cur;
      if (Math.abs(diff) < 1) {
        shownRef.current = tgt;
        setShown(tgt);
        rafRef.current = 0;
        return;
      }
      const next = cur + diff * 0.12;
      shownRef.current = next;
      setShown(next);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [reserve]);
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const pct = capacity > 0 ? Math.max(0, Math.min(1, shown / capacity)) : 0;
  const net = supplyRate - demandRate;
  const draining = net < 0;
  const empty = shown <= 0 && draining;
  const color = empty ? COLOR.danger : draining ? COLOR.warn : COLOR.accent.cyan;

  return (
    <button
      data-tutorial="fuel-gauge"
      onClick={onTap}
      style={fuelBadgeWrap}
      aria-label={`Fuel: ${(pct * 100) | 0}%`}
    >
      <div style={fuelKicker}>FUEL</div>
      <div style={fuelRow}>
        <div style={fuelBar}>
          <div style={{ ...fuelFill, height: `${pct * 100}%`, background: color }} />
        </div>
        <div style={fuelStats}>
          <div style={{ ...fuelRate, color }}>
            {net >= 0 ? '+' : ''}{net.toFixed(1)}<span style={fuelRateUnit}>/s</span>
          </div>
          <div style={fuelAmount}>{formatCash(shown, 0)}</div>
        </div>
      </div>
    </button>
  );
}

/* ─── Launcher tile (bottom row) ─────────────────────────────────── */
function LauncherTile({
  accent, label, Icon, onClick, dot,
}: {
  accent: string;
  label: string;
  Icon: React.FC<{ color: string }>;
  onClick: () => void;
  dot?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...launcherBtn,
        borderColor: `${accent}66`,
        boxShadow: `0 4px 14px rgba(0,0,0,0.45), 0 0 14px ${accent}22, inset 0 -2px 0 ${accent}44`,
      }}
      aria-label={label}
      title={label}
    >
      <div style={launcherIconWrap(accent)}>
        <Icon color={accent} />
      </div>
      <span style={launcherLabel}>{label}</span>
      {dot !== undefined && dot > 0 && <span style={launcherDot}>{dot}</span>}
    </button>
  );
}

function JourneyIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20L9 14L13 17L20 6" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={20} cy={6} r={2.4} fill={color} />
      <circle cx={4} cy={20} r={1.4} fill={color} />
    </svg>
  );
}

function LeaderIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="13" width="5" height="7" rx="1" stroke={color} strokeWidth="1.4" />
      <rect x="9.5" y="9" width="5" height="11" rx="1" stroke={color} strokeWidth="1.6" fill={`${color}1F`} />
      <rect x="15" y="11" width="5" height="9" rx="1" stroke={color} strokeWidth="1.4" />
      <path d="M12 4.5l1 2 2.2.3-1.6 1.5.4 2.2L12 9.5l-2 1 .4-2.2L8.8 6.8 11 6.5l1-2z" fill={color} />
    </svg>
  );
}

function MissionsIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="4" width="14" height="17" rx="2" stroke={color} strokeWidth="1.6" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" stroke={color} strokeWidth="1.4" fill={`${color}26`} />
      <path d="M8 10l1.5 1.5L12 9" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 10h2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 14l1.5 1.5L12 13" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 14h2.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

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

function LiveNetworkStrip({ tailColor }: { tailColor: string }) {
  const routes = useGameStore(selectRoutes);
  const fleet = useGameStore(selectFleet);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 3000);
    return () => window.clearInterval(id);
  }, []);
  const live = routes.length;
  const inAir = Math.min(routes.length, fleet.filter((a) => a.routeId !== null).length);
  const lines = useMemo(() => {
    if (routes.length === 0) {
      return ['No active routes yet. Open one to bring the network to life.'];
    }
    return routes.map((r) => `${r.originIata} → ${r.destIata} · ${(r.loadFactor * 100).toFixed(0)}% load`);
  }, [routes]);
  const current = lines[tick % lines.length] ?? lines[0]!;

  return (
    <div style={liveStrip}>
      <span style={liveKicker(tailColor)}>LIVE NETWORK</span>
      <span style={liveCount}>{live} ACTIVE · {inAir} IN AIR</span>
      <span style={liveLine} key={current}>{current}</span>
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const shell: React.CSSProperties = {
  position: 'fixed',
  // Small breathing gap under TopBar.
  top: 'calc(env(safe-area-inset-top, 0px) + 70px)',
  left: 0,
  right: 0,
  bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
  zIndex: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '6px 8px 8px',
  background: 'linear-gradient(180deg, rgba(11,17,32,0.92), rgba(7,11,24,0.99) 30%)',
};

/* Scene grows to fill the available space between the top gap and
   the tiles below. objectFit: cover lets the artwork breathe into
   any vertical room it's given without losing aspect-faithful pixels. */
const sceneWrap = (tail: string): React.CSSProperties => ({
  position: 'relative',
  width: '100%',
  flex: 1,
  minHeight: 220,
  borderRadius: RADIUS.l,
  overflow: 'hidden',
  border: `1px solid ${tail}33`,
  boxShadow: `${SHADOW.card}, 0 0 32px ${tail}22`,
});

const sceneImg: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  // Portrait scene — bias toward the upper section so the skyline +
  // control tower stay visible after the cover-crop, which is where
  // our hub/tower overlays anchor.
  objectPosition: 'center 35%',
  display: 'block',
  pointerEvents: 'none',
  userSelect: 'none',
};

/* Hub identity — top-left. */
const hubTag = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  top: 12,
  left: 12,
  background: 'rgba(11,17,32,0.55)',
  backdropFilter: 'blur(6px)',
  border: `1px solid ${tail}66`,
  borderRadius: RADIUS.m,
  padding: '6px 12px',
  pointerEvents: 'none',
  textAlign: 'left',
  boxShadow: `0 4px 14px rgba(0,0,0,0.4), 0 0 12px ${tail}33`,
});
const hubIataLine: React.CSSProperties = {
  color: COLOR.ink.primary,
  fontWeight: 900,
  fontSize: 20,
  letterSpacing: '0.18em',
  lineHeight: 1,
  fontFamily: '"Courier New", monospace',
};
const hubCityLine: React.CSSProperties = {
  color: COLOR.ink.muted,
  fontSize: 10,
  letterSpacing: '0.08em',
  marginTop: 3,
};

/* Watch Tower radar — right side of scene where the Control Tower
   button used to live. 50%-transparent green disc with a sweeping
   arm and breathing blip dots. */
const radarWrap: React.CSSProperties = {
  position: 'absolute',
  top: '14%',
  right: 12,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  background: 'transparent',
  border: 0,
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const radarLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.22em',
  color: '#34D399',
  textShadow: '0 1px 6px rgba(0,0,0,0.8)',
  textTransform: 'uppercase',
};
const radarDisc: React.CSSProperties = {
  width: 76,
  height: 76,
  borderRadius: 999,
  display: 'grid', placeItems: 'center',
  background: 'rgba(11,17,32,0.45)',
  border: '1px solid rgba(52,211,153,0.55)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 0 18px rgba(52,211,153,0.35)',
};

/* Fuel badge — embedded inside the scene at bottom-left, sized to
   read at a glance without crowding the artwork. */
const fuelBadgeWrap: React.CSSProperties = {
  position: 'absolute',
  bottom: 12,
  left: 12,
  background: 'rgba(11,17,32,0.78)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(90,200,250,0.45)',
  borderRadius: RADIUS.m,
  padding: '8px 12px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: COLOR.ink.primary,
  fontFeatureSettings: '"tnum" 1',
  minWidth: 120,
  textAlign: 'left',
  boxShadow: '0 5px 14px rgba(0,0,0,0.5), 0 0 14px rgba(90,200,250,0.25)',
};
const fuelKicker: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.24em',
  fontWeight: 800,
  color: COLOR.accent.cyan,
  marginBottom: 6,
};
const fuelRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 10,
};
const fuelBar: React.CSSProperties = {
  width: 10,
  height: 44,
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 5,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column-reverse',
};
const fuelFill: React.CSSProperties = {
  width: '100%',
  transition: 'background-color 240ms ease',
};
const fuelStats: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
};
const fuelRate: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
};
const fuelRateUnit: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  marginLeft: 1,
  opacity: 0.7,
};
const fuelAmount: React.CSSProperties = {
  fontSize: 10,
  color: COLOR.ink.muted,
  fontWeight: 700,
};

/* Boarding — bottom-right of the scene, by the plane tail. */
const boardingTag: React.CSSProperties = {
  position: 'absolute',
  bottom: 12,
  right: 12,
  background: 'rgba(11,17,32,0.78)',
  backdropFilter: 'blur(6px)',
  border: `1px solid ${COLOR.success}66`,
  borderRadius: RADIUS.s,
  padding: '6px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 1,
  minWidth: 96,
  boxShadow: '0 5px 12px rgba(0,0,0,0.5), 0 0 10px rgba(52,211,153,0.3)',
};
const boardingDot: React.CSSProperties = {
  position: 'absolute',
  top: 8, left: 10,
  width: 6, height: 6, borderRadius: 999,
  background: COLOR.success,
  boxShadow: `0 0 8px ${COLOR.success}`,
  animation: 'breathe 1.4s ease-in-out infinite',
};
const boardingLabel: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.16em',
  color: COLOR.success,
  textTransform: 'uppercase',
  marginLeft: 12,
};
const boardingCount: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: COLOR.ink.primary,
  fontFeatureSettings: '"tnum" 1',
  marginLeft: 12,
};

/* Tile row — three cards laid out across the row.
   Tiles take a fixed height so the picture above keeps the rest. */
const tilesRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
  flexShrink: 0,
};

const tileBtn: React.CSSProperties = {
  position: 'relative',
  height: 100,
  background: '#0B1120',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  border: '1px solid',
  borderRadius: RADIUS.m,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: COLOR.ink.primary,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  padding: '8px 10px',
  textAlign: 'left',
};
const tileTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: COLOR.ink.primary,
  letterSpacing: '0.02em',
  lineHeight: 1.15,
  textShadow: '0 2px 6px rgba(0,0,0,0.8)',
};
const tileSubtitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.03em',
  marginTop: 3,
  fontFeatureSettings: '"tnum" 1',
  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
};

/* Live network strip. */
const liveStrip: React.CSSProperties = {
  background: 'linear-gradient(90deg, rgba(11,17,32,0.92), rgba(15,23,42,0.92), rgba(11,17,32,0.92))',
  border: '1px solid rgba(90,200,250,0.25)',
  borderRadius: RADIUS.m,
  padding: '8px 12px',
  display: 'grid',
  gridTemplateColumns: 'auto auto 1fr',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
  flexShrink: 0,
};
const liveKicker = (tail: string): React.CSSProperties => ({
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.22em',
  color: tail,
  paddingRight: 10,
  borderRight: `1px solid ${tail}44`,
});
const liveCount: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.16em',
  color: COLOR.ink.primary,
};
const liveLine: React.CSSProperties = {
  fontSize: 11,
  color: COLOR.ink.secondary,
  letterSpacing: '0.02em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};

/* Four-button launcher row — sits at the very bottom of the home flow.
   Replaces the CEO Office button and absorbs the side rail that used
   to float on the network view. */
const launcherRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 6,
  flexShrink: 0,
};
const launcherBtn: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '8px 4px 10px',
  background: 'linear-gradient(160deg, rgba(15,23,47,0.85), rgba(11,17,32,0.9))',
  border: '1px solid',
  borderRadius: RADIUS.m,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: COLOR.ink.primary,
  minHeight: 56,
};
const launcherIconWrap = (accent: string): React.CSSProperties => ({
  width: 32, height: 32,
  borderRadius: 8,
  display: 'grid', placeItems: 'center',
  background: `linear-gradient(160deg, ${accent}28, rgba(11,17,32,0.6))`,
  border: `1px solid ${accent}55`,
});
const launcherLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.06em',
  color: COLOR.ink.secondary,
  textAlign: 'center',
  lineHeight: 1.1,
};
const launcherDot: React.CSSProperties = {
  position: 'absolute',
  top: 4, right: 4,
  minWidth: 16, height: 16,
  borderRadius: 999,
  background: COLOR.gold.base,
  color: COLOR.bg.deep,
  fontSize: 9,
  fontWeight: 800,
  display: 'grid', placeItems: 'center',
  padding: '0 4px',
  border: `2px solid ${COLOR.bg.canvas}`,
  boxShadow: `0 0 8px ${COLOR.gold.base}`,
};
