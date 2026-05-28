/**
 * HomeShell — image-first redesign (player feedback Phase X).
 *
 * The home tab now opens on a single hand-drawn airport scene with
 * action labels overlaid in their natural locations:
 *
 *   ┌────────────────────────────────────────┐
 *   │ [HUB IATA]                ┌────────┐    │
 *   │  Hub city                 │ Tower  │    │
 *   │                           └────────┘    │
 *   │                  ┌──────────────────┐   │
 *   │                  │ ● Boarding · N   │   │
 *   │                  └──────────────────┘   │
 *   ├──── 3 tiles below the main image ──────┤
 *   │  ✈ Buy │ 🛬 Manage │ 🏗 Upgrade        │
 *   │   fleet count · cond · hubs            │
 *   ├────────── Live Network ticker ─────────┤
 *   │              CEO Office                 │
 *   └────────────────────────────────────────┘
 *
 * The base image (/public/home-airport.jpg) already contains the
 * airport scene and three thumbnail "card" zones at the bottom; this
 * component just overlays interactive React buttons on the right
 * spots and keeps everything aligned via percentage coordinates so
 * the layout survives any phone width.
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

const HOME_IMAGE = '/home-airport.jpg';
// Source image aspect ratio (940 × 928) — used to keep the overlay
// coordinates faithful no matter how wide the viewport is.
const IMAGE_RATIO = 940 / 928;

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
  // Hide during the tutorial so the spotlight + Mission Control strip
  // have a clear canvas. Returns once the tutorial finishes.
  const [hidden, setHidden] = useState(!tutorialDone);
  useEffect(() => {
    setHidden(!tutorialDone);
  }, [tutorialDone]);

  // Fleet figures driving the tile sub-labels.
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
      <div style={inner}>
        {/* ── Main airport image with three overlays ─────────────── */}
        <div style={imageWrap(tailColor)}>
          <img src={HOME_IMAGE} alt="" style={image} draggable={false} />

          {/* Hub IATA (top-left) — informational, not clickable. */}
          <div style={hubTag(tailColor)} aria-label={`Home hub ${hubIata}`}>
            <div style={hubIataLine}>{hubIata}</div>
            <div style={hubCityLine}>{hubCity}</div>
          </div>

          {/* Control Tower (right side, above the parked aircraft). */}
          <button onClick={(): void => go('tower')} style={towerTag} aria-label="Open Control Tower">
            <span style={towerGlyph}>◆</span>
            <span>Control Tower</span>
          </button>

          {/* Boarding · N routes (bottom-right, by the plane tail). */}
          <button
            onClick={(): void => go('routes')}
            style={boardingTag}
            aria-label={`See routes — ${routes.length} active`}
          >
            <span style={boardingDot} />
            <span style={boardingLabel}>Boarding</span>
            <span style={boardingCount}>{routes.length} route{routes.length === 1 ? '' : 's'}</span>
          </button>

          {/* ── Three tile buttons overlaid on the bottom strip ──── */}
          <div style={tileRow}>
            <TileButton
              onClick={(): void => go('fleet', () => setFleetTabIntent('buy'))}
              left={5}
              title="Buy a New Aircraft"
              subtitle={`${fleet.length} owned`}
              accent={COLOR.accent.cyan}
            />
            <TileButton
              onClick={(): void => go('fleet', () => setFleetTabIntent('owned'))}
              left={37.5}
              title="Manage Your Hangar"
              subtitle={`${Math.round(avgCondition)}% avg condition`}
              accent={tailColor}
              subtitleColor={condColor}
            />
            <TileButton
              onClick={(): void => go('routes', () => setRoutesTabIntent('hubs'))}
              left={70}
              title="Upgrade Your Airport"
              subtitle={`${hubs.length} hub${hubs.length === 1 ? '' : 's'}`}
              accent={COLOR.gold.base}
            />
          </div>
        </div>

        {/* ── Live network strip — inline so it stays bound to the
              home flow instead of floating over other panels. ────── */}
        <LiveNetworkStrip tailColor={tailColor} />

        {/* ── CEO Office full-width button ─────────────────────── */}
        <button onClick={(): void => go('office')} style={ceoBtn(tailColor)} aria-label="Open CEO Office">
          <span style={ceoGlyph(tailColor)}>CEO</span>
          <span style={ceoTitle}>CEO Office</span>
          <span style={ceoChev}>›</span>
        </button>
      </div>
    </div>
  );
}

function TileButton({
  onClick, left, title, subtitle, accent, subtitleColor,
}: {
  onClick: () => void;
  left: number;
  title: string;
  subtitle: string;
  accent: string;
  subtitleColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...tileBtn,
        left: `${left}%`,
        borderColor: `${accent}55`,
        boxShadow: `0 0 18px ${accent}22, inset 0 -2px 0 ${accent}33`,
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
  top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
  left: 0,
  right: 0,
  bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
  zIndex: 14,
  background: 'linear-gradient(180deg, rgba(11,17,32,0.92), rgba(7,11,24,0.99) 30%)',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
};

const inner: React.CSSProperties = {
  maxWidth: 560,
  margin: '0 auto',
  padding: '8px 8px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const imageWrap = (tail: string): React.CSSProperties => ({
  position: 'relative',
  width: '100%',
  aspectRatio: `${IMAGE_RATIO}`,
  borderRadius: 18,
  overflow: 'hidden',
  border: `1px solid ${tail}33`,
  boxShadow: `${SHADOW.card}, 0 0 32px ${tail}22`,
});

const image: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  pointerEvents: 'none',
  userSelect: 'none',
};

/* Hub identity — top-left of the image. Informational only. */
const hubTag = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  top: '4%',
  left: '4%',
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

/* Control tower — right side of image, above the parked plane. */
const towerTag: React.CSSProperties = {
  position: 'absolute',
  top: '38%',
  right: '4%',
  background: 'rgba(15,23,47,0.78)',
  backdropFilter: 'blur(6px)',
  border: '1px solid rgba(244,199,91,0.6)',
  borderRadius: 999,
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.14em',
  color: COLOR.gold.base,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontFamily: 'inherit',
  textTransform: 'uppercase',
  boxShadow: '0 4px 14px rgba(0,0,0,0.5), 0 0 14px rgba(244,199,91,0.35)',
};
const towerGlyph: React.CSSProperties = {
  fontSize: 9,
  color: COLOR.gold.base,
};

/* Boarding — bottom-right area of image, by the plane tail. */
const boardingTag: React.CSSProperties = {
  position: 'absolute',
  top: '58%',
  right: '6%',
  background: 'rgba(11,17,32,0.78)',
  backdropFilter: 'blur(6px)',
  border: `1px solid ${COLOR.success}66`,
  borderRadius: RADIUS.m,
  padding: '8px 12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  minWidth: 116,
  boxShadow: '0 6px 16px rgba(0,0,0,0.5), 0 0 14px rgba(52,211,153,0.35)',
};
const boardingDot: React.CSSProperties = {
  position: 'absolute',
  top: 10, left: 12,
  width: 7, height: 7, borderRadius: 999,
  background: COLOR.success,
  boxShadow: `0 0 8px ${COLOR.success}`,
  animation: 'breathe 1.4s ease-in-out infinite',
};
const boardingLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.18em',
  color: COLOR.success,
  textTransform: 'uppercase',
  marginLeft: 14,
};
const boardingCount: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: COLOR.ink.primary,
  fontFeatureSettings: '"tnum" 1',
  marginLeft: 14,
};

/* Three tiles overlaid on the bottom card row of the image.
   The image's own card art (plane / hangar / construction) shows
   through; our labels sit on the CTA pill at the bottom of each card. */
const tileRow: React.CSSProperties = {
  position: 'absolute',
  // Each tile sits in the bottom ~22% of the image, vertically
  // anchored on the CTA pill area of the art beneath.
  bottom: '2%',
  left: 0,
  right: 0,
  height: '21%',
  pointerEvents: 'none',
};

const tileBtn: React.CSSProperties = {
  position: 'absolute',
  width: '25%',
  height: '78%',
  bottom: '4%',
  background: 'linear-gradient(180deg, rgba(11,17,32,0.32) 0%, rgba(11,17,32,0.85) 70%)',
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
  pointerEvents: 'auto',
  backdropFilter: 'blur(2px)',
};
const tileTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: COLOR.ink.primary,
  letterSpacing: '0.04em',
  lineHeight: 1.2,
};
const tileSubtitle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  marginTop: 3,
  fontFeatureSettings: '"tnum" 1',
};

/* Live network strip — embedded directly so the home flow owns it. */
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

/* CEO Office full-width button. */
const ceoBtn = (tail: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 18px',
  background: `linear-gradient(160deg, ${tail}22, rgba(11,17,32,0.85))`,
  border: `1px solid ${tail}55`,
  borderRadius: RADIUS.l,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: COLOR.ink.primary,
  boxShadow: `${SHADOW.card}, 0 0 22px ${tail}26`,
  minHeight: 60,
});
const ceoGlyph = (tail: string): React.CSSProperties => ({
  width: 42, height: 42,
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
