/**
 * MapLiveTicker — Design Review v3, point 23.
 *
 * The map used to feel like a selection space. This is a non-intrusive
 * overlay that proves the network is *running* even when the player
 * isn't touching anything: a scrolling ticker of live flight events
 * (boarding, in flight, arrived) plus a small "X aircraft in the air"
 * pulse pill. Only renders in map mode so it doesn't crowd the home
 * airport surface.
 */
import { useEffect, useMemo, useState } from 'react';
import { getAircraftDef } from '../../data/aircraft';
import {
  selectActiveEvents,
  selectFleet,
  selectHubs,
  selectRoutes,
  selectTailColor,
  selectTutorialCompleted,
  useGameStore,
} from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { formatCash } from '../format';
import { cyclePayout } from '../routeRevenue';
import { usePanelStore } from './PanelHost';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

interface TickerItem {
  id: string;
  kind: 'boarding' | 'flight' | 'arrival' | 'load' | 'cargo';
  text: string;
}

export function MapLiveTicker() {
  const mapMode = useUiStore((s) => s.mapMode);
  const tutorialDone = useGameStore(selectTutorialCompleted);
  const routes = useGameStore(selectRoutes);
  const fleet = useGameStore(selectFleet);
  const hubs = useGameStore(selectHubs);
  const tailColor = useGameStore(selectTailColor);
  const activeEvents = useGameStore(selectActiveEvents);
  const openPanel = usePanelStore((s) => s.open);
  const setOpenNewRoute = useUiStore((s) => s.setOpenNewRoute);

  const liveCount = routes.length;

  // Build a rotating list of "ticker events" from the routes. We don't
  // need real timing — the player just needs to see the network move.
  const items = useMemo<TickerItem[]>(() => {
    const out: TickerItem[] = [];
    let i = 0;
    for (const r of routes) {
      const a = fleet.find((x) => x.uid === r.aircraftUid);
      const def = a ? getAircraftDef(a.defId) : null;
      const name = def?.displayName ?? 'aircraft';
      const kindRot = i % 4;
      if (kindRot === 0) out.push({ id: `${r.id}-b-${i}`, kind: 'boarding',
        text: `${name} boarding at ${r.originIata} · gate clear · 14 bags loaded` });
      else if (kindRot === 1) out.push({ id: `${r.id}-f-${i}`, kind: 'flight',
        text: `${name} en route ${r.originIata} → ${r.destIata} · ${Math.round(r.distanceKm)}km · ${(r.loadFactor * 100).toFixed(0)}% load` });
      else if (kindRot === 2) out.push({ id: `${r.id}-a-${i}`, kind: 'arrival',
        text: `${name} arrived ${r.destIata} · paid +$${formatCash(cyclePayout(r, a!, hubs, activeEvents))} this cycle` });
      else out.push({ id: `${r.id}-l-${i}`, kind: 'load',
        text: `${r.originIata} terminal: passenger flow steady · ${r.pricing} class · turnaround 21s` });
      i++;
    }
    if (out.length === 0) {
      out.push({ id: 'empty-1', kind: 'flight', text: 'No active routes yet. Open one to bring the network to life.' });
    }
    return out;
  }, [routes, fleet, hubs, activeEvents]);

  // Cycle the visible "now" line so the player sees motion even with
  // only a couple of routes.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!mapMode) return;
    const id = window.setInterval(() => setNow((v) => (v + 1) % Math.max(1, items.length)), 3200);
    return () => window.clearInterval(id);
  }, [mapMode, items.length]);

  // Tutorial keeps the spotlight clean.
  if (!tutorialDone) return null;
  // Home owns its own embedded live-network strip (Phase X redesign),
  // so this fixed-position ticker only shows on the world-map view.
  // Without this gate the pill + bar would overlap the home image
  // and the new tile buttons.
  if (!mapMode) return null;

  const current = items[now % items.length] ?? items[0]!;
  const kindIcon = current.kind === 'boarding' ? '🛫'
    : current.kind === 'flight' ? '✈'
    : current.kind === 'arrival' ? '🛬'
    : current.kind === 'cargo' ? '📦' : '👥';

  return (
    <>
      {/* Top pill — "X aircraft in the air". The per-minute revenue
          already lives in TopBar under the cash balance, so the pill
          now just counts live routes (no "/MIN" duplicate). */}
      <div style={pill(tailColor)} data-popover-block-top>
        <span style={pillDot(tailColor)} />
        <span style={pillText}>{liveCount} ACTIVE {liveCount === 1 ? 'ROUTE' : 'ROUTES'}</span>
      </div>

      {/* Quick "+ Add route" shortcut — jumps straight to the New Route
          screen (also reachable from Home / Operations). */}
      <button
        onClick={(): void => {
          haptics.light();
          sfx.tick();
          setOpenNewRoute(true);
          openPanel('routes');
        }}
        style={addRouteBtn(tailColor)}
        aria-label="Add a new route"
      >
        + Add route
      </button>

      {/* Ticker bar at the bottom of the map (above tabs + goal chain). */}
      <div style={tickerBar} data-popover-block-bottom>
        <div style={tickerLabel(tailColor)}>LIVE NETWORK</div>
        <div style={tickerLine} key={current.id}>
          <span style={tickerIcon}>{kindIcon}</span>
          <span style={tickerText}>{current.text}</span>
        </div>
      </div>
    </>
  );
}

const pill = (tail: string): React.CSSProperties => ({
  position: 'fixed',
  // Sit just below the top bar (`--world-top`) so it's no longer clipped
  // behind it. The event banner is to the left (right: 64), so the
  // top-right corner stays clear.
  top: 'calc(var(--world-top) + 8px)',
  right: 12,
  background: 'rgba(11,17,32,0.85)',
  border: `1px solid ${tail}55`,
  borderRadius: 999,
  padding: '6px 12px',
  display: 'flex', alignItems: 'center', gap: 8,
  zIndex: 18,
  backdropFilter: 'blur(8px)',
  boxShadow: `0 4px 12px rgba(0,0,0,0.4)`,
});
const addRouteBtn = (tail: string): React.CSSProperties => ({
  position: 'fixed',
  top: 'calc(var(--world-top) + 46px)',
  right: 12,
  background: 'rgba(11,17,32,0.85)',
  border: `1px solid ${tail}`,
  color: tail,
  borderRadius: 999,
  padding: '7px 14px',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.06em',
  fontFamily: 'inherit',
  cursor: 'pointer',
  zIndex: 18,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
});
const pillDot = (tail: string): React.CSSProperties => ({
  width: 7, height: 7, borderRadius: 999,
  background: tail,
  boxShadow: `0 0 6px ${tail}`,
  animation: 'breathe 1.4s ease-in-out infinite',
});
const pillText: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.18em',
  color: '#F8FAFC',
  fontFeatureSettings: '"tnum" 1',
};

const tickerBar: React.CSSProperties = {
  position: 'fixed',
  bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 8px)',
  left: 8, right: 8,
  background: 'linear-gradient(90deg, rgba(11,17,32,0.92), rgba(15,23,42,0.92), rgba(11,17,32,0.92))',
  border: '1px solid rgba(90,200,250,0.25)',
  borderRadius: 12,
  padding: '8px 10px',
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 10,
  alignItems: 'center',
  zIndex: 18,
  boxShadow: '0 8px 22px rgba(0,0,0,0.5)',
  backdropFilter: 'blur(8px)',
  maxWidth: 720,
  margin: '0 auto',
};
const tickerLabel = (tail: string): React.CSSProperties => ({
  fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
  color: tail,
  paddingRight: 10,
  borderRight: `1px solid ${tail}44`,
});
const tickerLine: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
};
const tickerIcon: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1,
};
const tickerText: React.CSSProperties = {
  fontSize: 11,
  color: '#CBD5E1',
  letterSpacing: '0.02em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
