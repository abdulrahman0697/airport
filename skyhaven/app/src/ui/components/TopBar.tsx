import { useEffect, useState } from 'react';
import { cashPerSecond } from '../../engine/economy';
import { getAircraftDef } from '../../data/aircraft';
import { selectAirlineName, selectCash, selectTailColor, useGameStore } from '../../state/store';
import { formatCash, formatRate } from '../format';

export function TopBar() {
  const cash = useGameStore(selectCash);
  const airlineName = useGameStore(selectAirlineName);
  const tailColor = useGameStore(selectTailColor);
  const state = useGameStore((s) => s.state);

  // Computed cash/sec — sum across active routes.
  const [perSec, setPerSec] = useState(0);
  useEffect(() => {
    if (!state) return;
    const fleetById = new Map(state.fleet.map((a) => [a.uid, a]));
    let total = 0;
    for (const r of state.routes) {
      const a = fleetById.get(r.aircraftUid);
      if (!a || !getAircraftDef(a.defId)) continue;
      total += cashPerSecond(r, a);
    }
    setPerSec(total);
  }, [state]);

  if (!state) return null;

  return (
    <header style={shell} aria-label="airline header">
      <div style={brand}>
        <span style={chip(tailColor)} aria-hidden />
        <span style={brandText}>{airlineName.toUpperCase()}</span>
      </div>
      <div style={cashCol}>
        <div style={cashValue}>${formatCash(cash)}</div>
        <div style={cashRate}>{formatRate(perSec)}</div>
      </div>
    </header>
  );
}

const shell: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  padding: '10px 14px max(10px, env(safe-area-inset-top))',
  paddingTop: 'max(10px, env(safe-area-inset-top))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  pointerEvents: 'none',
  background: 'linear-gradient(to bottom, rgba(11,17,32,0.85), rgba(11,17,32,0))',
  zIndex: 10,
};

const brand: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const chip = (color: string): React.CSSProperties => ({
  width: 10,
  height: 10,
  borderRadius: 3,
  background: color,
  boxShadow: `0 0 8px ${color}AA`,
});

const brandText: React.CSSProperties = {
  fontSize: 13,
  letterSpacing: '0.18em',
  color: '#F8FAFC',
  fontWeight: 600,
};

const cashCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  fontFeatureSettings: '"tnum" 1',
};

const cashValue: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#F4C75B',
  textShadow: '0 0 12px rgba(244,199,91,0.35)',
};

const cashRate: React.CSSProperties = {
  fontSize: 11,
  color: '#34D399',
  marginTop: 2,
  letterSpacing: '0.03em',
};
