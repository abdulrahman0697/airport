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
import { useEffect, useMemo, useState } from 'react';
import { loadTopAirports } from '../../data/airports';
import { conditionBand } from '../../engine/condition';
import {
  selectFleet,
  selectHubs,
  selectRoutes,
  selectTailColor,
  selectTutorialCompleted,
  useGameStore,
} from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { COLOR, RADIUS, SHADOW } from '../design/tokens';
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
  const tutorialDone = useGameStore(selectTutorialCompleted);

  const activePanel = usePanelStore((s) => s.active);
  const openPanel = usePanelStore((s) => s.open);
  const mapMode = useUiStore((s) => s.mapMode);
  const introDismissed = useUiStore((s) => s.introDismissed);
  const setFleetTabIntent = useUiStore((s) => s.setFleetTabIntent);
  const setRoutesTabIntent = useUiStore((s) => s.setRoutesTabIntent);

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

  const go = (panel: 'fleet' | 'routes' | 'tower' | 'office', extra?: () => void): void => {
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

        <button onClick={(): void => go('tower')} style={towerTag} aria-label="Open Control Tower">
          <span style={towerGlyph}>◆</span>
          <span>Control Tower</span>
        </button>

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

      {/* ── CEO Office (anchored at the bottom of the home flow) ──── */}
      <button onClick={(): void => go('office')} style={ceoBtn(tailColor)} aria-label="Open CEO Office">
        <span style={ceoGlyph(tailColor)}>CEO</span>
        <span style={ceoTitle}>CEO Office</span>
        <span style={ceoChev}>›</span>
      </button>
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
  objectPosition: 'center',
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

/* Control tower — right side, smaller compact pill. */
const towerTag: React.CSSProperties = {
  position: 'absolute',
  top: '26%',
  right: 12,
  background: 'rgba(15,23,47,0.78)',
  backdropFilter: 'blur(6px)',
  border: '1px solid rgba(244,199,91,0.6)',
  borderRadius: 999,
  padding: '4px 9px',
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.12em',
  color: COLOR.gold.base,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontFamily: 'inherit',
  textTransform: 'uppercase',
  boxShadow: '0 3px 10px rgba(0,0,0,0.5), 0 0 10px rgba(244,199,91,0.32)',
};
const towerGlyph: React.CSSProperties = {
  fontSize: 8,
  color: COLOR.gold.base,
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

/* CEO Office — sits at the very bottom of the home flow. */
const ceoBtn = (tail: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  background: `linear-gradient(160deg, ${tail}22, rgba(11,17,32,0.85))`,
  border: `1px solid ${tail}55`,
  borderRadius: RADIUS.l,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: COLOR.ink.primary,
  boxShadow: `${SHADOW.card}, 0 0 22px ${tail}26`,
  minHeight: 56,
  flexShrink: 0,
});
const ceoGlyph = (tail: string): React.CSSProperties => ({
  width: 40, height: 40,
  borderRadius: 12,
  display: 'grid', placeItems: 'center',
  background: `linear-gradient(160deg, ${tail}44, rgba(15,23,47,0.6))`,
  border: `1px solid ${tail}66`,
  color: tail,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.06em',
  flexShrink: 0,
});
const ceoTitle: React.CSSProperties = {
  flex: 1,
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: '0.04em',
};
const ceoChev: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: COLOR.ink.muted,
};
