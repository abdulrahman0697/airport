import { useEffect, useRef } from 'react';
import { getAircraftDef } from '../../data/aircraft';
import { conditionBand } from '../../engine/condition';
import { legDurationMs } from '../../engine/economy';
import type { Route } from '../../engine/types';
import { selectActiveEvents, selectFleet, selectHubs, useGameStore } from '../../state/store';
import { popoverBottomCeiling, popoverTopFloor } from '../design/safeArea';
import { formatCash } from '../format';
import { cyclePayout, formatDuration } from '../routeRevenue';

/**
 * Popover for a tapped in-flight plane glyph. Mirrors AirportTooltip
 * but surfaces route info: aircraft type, condition, origin → dest,
 * distance, cycle time, ETA to arrival, and per-cycle payout.
 */
interface Props {
  route: Route;
  x: number;
  y: number;
  onClose: () => void;
}

const TOOLTIP_W = 250;
const TOOLTIP_H_EST = 150;

export function RouteTooltip({ route, x, y, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fleet = useGameStore(selectFleet);
  const hubs = useGameStore(selectHubs);
  const events = useGameStore(selectActiveEvents);

  // Keep onClose in a ref so the outside-tap listener attaches exactly
  // once (mount) and never tears down on re-render. Previously the effect
  // depended on the inline onClose closure, so every parent re-render
  // detached + re-attached the listener behind a 50ms timer — leaving a
  // recurring gap where an outside tap was missed (the "tap 2-3 times to
  // close" bug).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      if (!ref.current) return;
      const target = e.target as Node | null;
      if (!target || !ref.current.contains(target)) onCloseRef.current();
    };
    const id = window.setTimeout(() => {
      window.addEventListener('pointerdown', onDown);
    }, 50);
    return () => {
      clearTimeout(id);
      window.removeEventListener('pointerdown', onDown);
    };
  }, []);

  const aircraft = fleet.find((a) => a.uid === route.aircraftUid);
  if (!aircraft) return null;
  const def = getAircraftDef(aircraft.defId);
  if (!def) return null;

  const perCycle = cyclePayout(route, aircraft, hubs, events);
  const cycleMs = legDurationMs(route, aircraft);
  // Time left until this plane lands and pays out (legProgress is 0..1).
  const remainingMs = isFinite(cycleMs) ? Math.max(0, (1 - route.legProgress) * cycleMs) : 0;
  const band = conditionBand(aircraft.condition);
  const condColor = band === 'normal' ? '#34D399' : band === 'degraded' ? '#F59E0B' : '#F87171';

  const left = Math.min(window.innerWidth - TOOLTIP_W - 12, Math.max(12, x - TOOLTIP_W / 2));
  // Clamp below the top-bar floor + above the bottom tabs so the
  // popover never renders under the HUD chrome.
  const floor = popoverTopFloor();
  const ceiling = popoverBottomCeiling() - TOOLTIP_H_EST;
  const above = y - TOOLTIP_H_EST - 12 > floor;
  const proposedTop = above ? y - TOOLTIP_H_EST - 12 : y + 18;
  const top = Math.max(floor, Math.min(ceiling, proposedTop));

  return (
    <div ref={ref} style={{ ...shell, left, top }} onClick={(e): void => e.stopPropagation()}>
      <div style={head}>
        <span style={routeIatas}>{route.originIata} ↔ {route.destIata}</span>
        <span style={cargoPill}>{def.category === 'cargo' ? 'CARGO' : `T${def.tier}`}</span>
      </div>
      <div style={typeLabel}>{def.displayName}</div>
      <div style={metaRow}>
        <span style={{ color: condColor, fontWeight: 600 }}>
          {aircraft.condition.toFixed(0)}% · {band}
        </span>
        {def.category !== 'cargo' && (
          <span style={meta}>{(route.loadFactor * 100).toFixed(0)}% load</span>
        )}
      </div>
      <div style={meta}>
        Distance: {Math.round(route.distanceKm).toLocaleString()} km · Cycle {formatDuration(cycleMs)}
      </div>
      <div style={revenueRow}>
        <span style={meta}>Arrives in</span>
        <span style={revenue}>{formatDuration(remainingMs)}</span>
      </div>
      <div style={revenueRow}>
        <span style={meta}>Per cycle</span>
        <span style={revenue}>+${formatCash(perCycle)}</span>
      </div>
    </div>
  );
}

const shell: React.CSSProperties = {
  position: 'fixed',
  width: TOOLTIP_W,
  background: 'rgba(11, 17, 32, 0.96)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(90,200,250,0.45)',
  borderRadius: 12,
  padding: '10px 12px',
  boxShadow: '0 14px 40px rgba(0,0,0,0.55), 0 0 18px rgba(90,200,250,0.18)',
  zIndex: 40,
  pointerEvents: 'auto',
};
const head: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};
const routeIatas: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#F8FAFC',
  letterSpacing: '0.06em',
};
const cargoPill: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.1em',
  fontWeight: 700,
  color: '#5AC8FA',
  background: 'rgba(90,200,250,0.14)',
  border: '1px solid rgba(90,200,250,0.4)',
  padding: '2px 6px',
  borderRadius: 4,
};
const typeLabel: React.CSSProperties = {
  fontSize: 13,
  color: '#F8FAFC',
  fontWeight: 600,
  marginTop: 4,
};
const metaRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  marginTop: 6, fontSize: 11,
};
const meta: React.CSSProperties = {
  fontSize: 11,
  color: '#94A3B8',
  marginTop: 2,
  lineHeight: 1.5,
};
const revenueRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginTop: 8, padding: '6px 8px',
  background: 'rgba(52,211,153,0.10)',
  borderRadius: 6,
};
const revenue: React.CSSProperties = {
  fontSize: 13,
  color: '#34D399',
  fontWeight: 700,
  fontFeatureSettings: '"tnum" 1',
};
