import { useEffect, useState } from 'react';
import { cashPerSecond } from '../../engine/economy';
import { getAircraftDef } from '../../data/aircraft';
import { MAX_TIER, TIER_UNLOCK_THRESHOLDS } from '../../engine/tierUnlocks';
import {
  selectActiveEvents,
  selectAirlineName,
  selectCash,
  selectHubs,
  selectLifetime,
  selectTailColor,
  selectTier,
  useGameStore,
} from '../../state/store';
import { formatRate } from '../format';
import { EcoBadge } from './EcoBadge';
import { usePanelStore } from './PanelHost';
import { RollingCash } from './RollingCash';

export function TopBar() {
  const cash = useGameStore(selectCash);
  const airlineName = useGameStore(selectAirlineName);
  const tailColor = useGameStore(selectTailColor);
  const tier = useGameStore(selectTier);
  const lifetime = useGameStore(selectLifetime);
  const hubs = useGameStore(selectHubs);
  const activeEvents = useGameStore(selectActiveEvents);
  const state = useGameStore((s) => s.state);
  const open = usePanelStore((s) => s.open);

  const [perSec, setPerSec] = useState(0);
  useEffect(() => {
    if (!state) return;
    const fleetById = new Map(state.fleet.map((a) => [a.uid, a]));
    let total = 0;
    for (const r of state.routes) {
      const a = fleetById.get(r.aircraftUid);
      if (!a || !getAircraftDef(a.defId)) continue;
      total += cashPerSecond(r, a, hubs, activeEvents);
    }
    setPerSec(total);
  }, [state, hubs, activeEvents]);

  if (!state) return null;

  // Tier progress
  const curThreshold = TIER_UNLOCK_THRESHOLDS[tier] ?? 0;
  const nextThreshold = tier < MAX_TIER ? (TIER_UNLOCK_THRESHOLDS[tier + 1] ?? curThreshold * 10) : curThreshold;
  const span = Math.max(1, nextThreshold - curThreshold);
  const pct = tier >= MAX_TIER ? 1 : Math.max(0, Math.min(1, (lifetime - curThreshold) / span));

  return (
    <header style={shell} aria-label="airline header">
      <button onClick={(): void => open('office')} style={brandBtn} aria-label="Open office dashboard">
        <span style={chip(tailColor)} aria-hidden />
        <div style={brandCol}>
          <div style={brandText}>{airlineName.toUpperCase()}</div>
          <div style={tierLine}>
            <span style={tierTag}>T{tier}</span>
            <div style={tierBar}>
              <div style={{
                ...tierFill,
                width: `${pct * 100}%`,
                background: `linear-gradient(90deg, ${tailColor}, #F4C75B)`,
              }} />
            </div>
            {tier < MAX_TIER && <span style={tierNext}>T{tier + 1}</span>}
          </div>
          <EcoBadge />
        </div>
      </button>
      <div style={cashCol}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          <RollingCash value={cash} />
        </div>
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
  padding: '10px 14px',
  paddingTop: 'max(10px, env(safe-area-inset-top))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: 'linear-gradient(to bottom, rgba(11,17,32,0.85), rgba(11,17,32,0))',
  zIndex: 10,
};

const brandBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'transparent', border: 0, padding: 0,
  color: 'inherit', cursor: 'pointer', fontFamily: 'inherit',
  pointerEvents: 'auto',
};

const brandCol: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
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

const tierLine: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  marginTop: 4,
  width: 130,
};
const tierTag: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.06em',
  color: '#5AC8FA',
  fontWeight: 700,
  minWidth: 16,
};
const tierBar: React.CSSProperties = {
  flex: 1,
  height: 4,
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 2,
  overflow: 'hidden',
};
const tierFill: React.CSSProperties = {
  height: '100%',
  transition: 'width 400ms ease',
};
const tierNext: React.CSSProperties = {
  fontSize: 9,
  color: '#94A3B8',
  letterSpacing: '0.06em',
  minWidth: 16,
};

const cashCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
};

const cashRate: React.CSSProperties = {
  fontSize: 11,
  color: '#34D399',
  marginTop: 2,
  letterSpacing: '0.03em',
};
