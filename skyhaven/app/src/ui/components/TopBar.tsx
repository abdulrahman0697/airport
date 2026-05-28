import { useEffect, useRef, useState } from 'react';
import { cashPerSecond } from '../../engine/economy';
import { getAircraftDef } from '../../data/aircraft';
import { MAX_TIER, TIER_UNLOCK_THRESHOLDS } from '../../engine/tierUnlocks';
import { AIRPORT_GROWTH } from '../../data/tierGrowth';
import {
  selectActiveEvents,
  selectAirlineName,
  selectCash,
  selectHubs,
  selectLifetime,
  selectRoutes,
  selectTailColor,
  selectTier,
  useGameStore,
} from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { TierRing } from '../design/TierRing';
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
  const routes = useGameStore(selectRoutes);
  const state = useGameStore((s) => s.state);
  const open = usePanelStore((s) => s.open);
  const openJourney = useUiStore((s) => s.setEmpireJourneyOpen);

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

  // Design Review v3 — point 8. Pulse the rate when income first
  // appears so the player sees the empire come alive instead of
  // staring at "0/min".
  const wasIdle = useRef(true);
  const [livePulse, setLivePulse] = useState(false);
  useEffect(() => {
    if (perSec > 0 && wasIdle.current) {
      wasIdle.current = false;
      setLivePulse(true);
      const id = window.setTimeout(() => setLivePulse(false), 3000);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [perSec]);

  if (!state) return null;

  // Tier progress (kept for ring + advanced mode).
  const curThreshold = TIER_UNLOCK_THRESHOLDS[tier] ?? 0;
  const nextThreshold = tier < MAX_TIER ? (TIER_UNLOCK_THRESHOLDS[tier + 1] ?? curThreshold * 10) : curThreshold;
  const span = Math.max(1, nextThreshold - curThreshold);
  const pct = tier >= MAX_TIER ? 1 : Math.max(0, Math.min(1, (lifetime - curThreshold) / span));

  // Design Review v3 — point 6. Early-game mode shows the next physical
  // milestone in plain English instead of a percentage to T3. ECO badge
  // only appears after Tier 3 when environmental mechanics matter.
  const earlyGame = tier < 3;
  const nextGrowth = AIRPORT_GROWTH[tier]; // next tier's row
  const nextGoalText = tier >= MAX_TIER
    ? 'Max tier reached'
    : nextGrowth
      ? `Next: ${nextGrowth.label}`
      : `Next milestone soon`;

  // Design Review v3 — point 8. "No active routes" reads as truthful;
  // "0/min" reads as broken.
  const hasIncome = perSec > 0;
  const rateText = hasIncome
    ? formatRate(perSec)
    : routes.length === 0
      ? 'No active routes'
      : 'Spooling up…';

  // Design Review v5 — point 8. The Beginner Top Bar shows only the
  // three essentials in the very first session: Cash / Income / Next
  // Goal. The tier ring, EcoBadge and CEO button only appear after
  // the player has felt some value (first route opened).
  const veryEarly = routes.length === 0 && lifetime === 0;

  return (
    <header style={shell} aria-label="airline header">
      <button
        onClick={(): void => openJourney(true)}
        style={brandBtn}
        aria-label="Open Empire Journey"
      >
        {!veryEarly && <TierRing pct={pct} tier={tier} color={tailColor} size={42} />}
        <div style={brandCol}>
          <div style={brandText}>{airlineName.toUpperCase()}</div>
          <div style={brandSub}>{nextGoalText}</div>
          {!earlyGame && <EcoBadge />}
        </div>
      </button>
      <div style={cashCol}>
        {/* Design Review v4 — point 6. Until the player has earned
            their first revenue, the balance reads as "Founder Capital"
            to ground the startup-airline fantasy. The label transitions
            to "Cash" once revenue is flowing. */}
        <div style={cashKicker(hasIncome)}>
          {hasIncome || lifetime > 0 ? 'CASH BALANCE' : 'FOUNDER CAPITAL'}
        </div>
        <div style={cashAmount}>
          <RollingCash value={cash} />
        </div>
        <div style={{ ...cashRate, ...(livePulse ? cashRatePulse : {}), color: hasIncome ? '#34D399' : '#94A3B8' }}>
          {rateText}
        </div>
      </div>
      {!veryEarly && <button
        onClick={(): void => open('office')}
        style={officeBtn(tailColor)}
        aria-label="Open CEO office"
        title="CEO office"
      >
        <span style={officeGlyph(tailColor)}>CEO</span>
      </button>}
    </header>
  );
}

const shell: React.CSSProperties = {
  position: 'fixed',
  top: 'env(safe-area-inset-top, 0px)',
  left: 0,
  right: 0,
  padding: '12px 14px',
  paddingLeft: 'max(14px, env(safe-area-inset-left, 0px))',
  paddingRight: 'max(14px, env(safe-area-inset-right, 0px))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  // Opaque section above the game — no map visible behind it.
  background: '#0B1120',
  borderBottom: '1px solid rgba(90,200,250,0.18)',
  boxShadow: '0 6px 18px rgba(0,0,0,0.55)',
  zIndex: 30,
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

const brandText: React.CSSProperties = {
  fontSize: 14,
  letterSpacing: '0.18em',
  color: '#F8FAFC',
  fontWeight: 700,
};

const brandSub: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.04em',
  color: '#94A3B8',
  marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};

const cashCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
};

const cashKicker = (hasIncome: boolean): React.CSSProperties => ({
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.22em',
  color: hasIncome ? '#94A3B8' : '#F4C75B',
  marginBottom: 1,
});

const cashAmount: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: '#F8FAFC',
  fontFeatureSettings: '"tnum" 1',
  lineHeight: 1.1,
};

const cashRate: React.CSSProperties = {
  fontSize: 12,
  color: '#34D399',
  marginTop: 2,
  letterSpacing: '0.03em',
  fontFeatureSettings: '"tnum" 1',
  padding: '2px 6px',
  marginRight: -6,
  borderRadius: 4,
  transition: 'background 320ms ease, box-shadow 320ms ease',
};

// 3-second green halo around income/min the first time it goes
// non-zero — proves the system is alive (Design Review v3 — point 8).
const cashRatePulse: React.CSSProperties = {
  background: 'rgba(52,211,153,0.18)',
  boxShadow: '0 0 12px rgba(52,211,153,0.45)',
};

const officeBtn = (color: string): React.CSSProperties => ({
  width: 38, height: 38,
  borderRadius: 10,
  border: `1px solid ${color}55`,
  background: `linear-gradient(160deg, ${color}26, rgba(15,23,47,0.6))`,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
  flexShrink: 0,
  fontFamily: 'inherit',
});

const officeGlyph = (color: string): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  color,
});
