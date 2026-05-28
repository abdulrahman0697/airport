import { useEffect, useRef } from 'react';
import type { Airport } from '../../data/airports';
import { getRegion } from '../../data/regions';
import { popoverBottomCeiling, popoverTopFloor } from '../design/safeArea';
import { countryName } from '../countryNames';

/**
 * Small popover that appears next to a tapped airport pin. Shows the
 * IATA + city + country and whether the region is unlocked. Tap
 * outside to close.
 */
interface Props {
  airport: Airport;
  x: number;
  y: number;
  unlocked: boolean;
  onClose: () => void;
}

const TOOLTIP_W = 220;
const TOOLTIP_H_EST = 110;

export function AirportTooltip({ airport, x, y, unlocked, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Click outside to dismiss.
  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      if (!ref.current) return;
      const target = e.target as Node | null;
      if (!target || !ref.current.contains(target)) onClose();
    };
    const id = window.setTimeout(() => {
      window.addEventListener('pointerdown', onDown);
    }, 50);
    return () => {
      clearTimeout(id);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);

  // Position the tooltip so it stays on-screen.
  const left = Math.min(window.innerWidth - TOOLTIP_W - 12, Math.max(12, x - TOOLTIP_W / 2));
  // Clamp the tooltip below the top-bar floor and above the bottom
  // tabs so it never slips under either fixed surface.
  const floor = popoverTopFloor();
  const ceiling = popoverBottomCeiling() - TOOLTIP_H_EST;
  const above = y - TOOLTIP_H_EST - 12 > floor;
  const proposedTop = above ? y - TOOLTIP_H_EST - 12 : y + 18;
  const top = Math.max(floor, Math.min(ceiling, proposedTop));
  const region = getRegion(airport.region);

  return (
    <div ref={ref} style={{ ...shell, left, top }} onClick={(e): void => e.stopPropagation()}>
      <div style={iataRow}>
        <span style={iata}>{airport.iata}</span>
        {!unlocked && <span style={lockedPill}>Region locked</span>}
      </div>
      <div style={city}>{airport.city || '—'}</div>
      <div style={meta}>
        {region?.name ?? `Region ${airport.region}`} · {countryName(airport.country)}
      </div>
      <div style={meta}>
        Tier {airport.sizeTier} airport · Runway cat {airport.runwayCategory}
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
const iataRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};
const iata: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#F8FAFC',
  letterSpacing: '0.12em',
};
const lockedPill: React.CSSProperties = {
  fontSize: 8,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#F59E0B',
  background: 'rgba(245,158,11,0.14)',
  border: '1px solid rgba(245,158,11,0.4)',
  padding: '2px 6px',
  borderRadius: 4,
};
const city: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: '#F8FAFC',
  fontWeight: 600,
};
const meta: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: '#94A3B8',
  lineHeight: 1.4,
};
