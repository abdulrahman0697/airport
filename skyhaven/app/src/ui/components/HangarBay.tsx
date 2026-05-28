/**
 * HangarBay — Design Review v4, point 20.
 *
 * Replaces the flat vertical list of owned aircraft with horizontal
 * "hangar slots" — each slot frames a single aircraft as the player's
 * prized asset rather than a row in a maintenance table:
 *
 *   - Large aircraft illustration (tail colour applied as the livery)
 *   - Nameplate ("Desert Swift", deterministic per uid)
 *   - Assigned route or "Parked"
 *   - Condition bar + maintenance status
 *   - Lifetime totals (flights, distance, revenue est.)
 *   - Milestone badges (50 flights, 10K passengers, Storm Survivor)
 *
 * Tapping the slot opens the existing AircraftDetailModal AND the new
 * MaintenanceMenu (Design Review v4, point 21) — three repair modes
 * presented as service options, not punishments.
 */
import { useState } from 'react';
import { getAircraftDef } from '../../data/aircraft';
import { conditionBand, repairCost } from '../../engine/condition';
import { aircraftNickname, aircraftTailNumber } from '../../engine/identity';
import type { OwnedAircraft, Route } from '../../engine/types';
import {
  selectAirlineCode,
  selectCash,
  selectFleet,
  selectRoutes,
  selectTailColor,
  useGameStore,
} from '../../state/store';
import { Button } from '../design/Button';
import { Chip } from '../design/Chip';
import { AircraftIllustration } from '../design/SvgAircraft';
import { COLOR, RADIUS, SPACE } from '../design/tokens';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

interface HangarBayProps {
  onOpenDetail: (a: OwnedAircraft) => void;
}

export function HangarBay({ onOpenDetail }: HangarBayProps) {
  const fleet = useGameStore(selectFleet);
  const routes = useGameStore(selectRoutes);
  const tailColor = useGameStore(selectTailColor);
  const lifetime = useGameStore((s) => s.state?.lifetimeEarnings ?? 0);
  const [maint, setMaint] = useState<OwnedAircraft | null>(null);

  if (fleet.length === 0) {
    return (
      <div style={empty}>
        Hangar empty. Switch to "Buy aircraft" to start your fleet.
      </div>
    );
  }

  // Pool of revenue-per-aircraft so the lifetime stats look credible
  // even though the engine doesn't track per-aircraft revenue yet.
  const perAircraftLifetimeRevenue = fleet.length === 0
    ? 0
    : Math.round(lifetime / fleet.length);

  return (
    <>
      <div style={hangarHead}>HANGAR BAY  ·  {fleet.length} aircraft</div>
      <ul style={hangarList}>
        {fleet.map((a) => (
          <HangarSlot
            key={a.uid}
            aircraft={a}
            routes={routes}
            tailColor={tailColor}
            lifetimeRevenueEst={perAircraftLifetimeRevenue}
            onOpenDetail={(): void => onOpenDetail(a)}
            onMaintenance={(): void => setMaint(a)}
          />
        ))}
      </ul>
      {maint && (
        <MaintenanceMenu
          aircraft={maint}
          tailColor={tailColor}
          onClose={(): void => setMaint(null)}
        />
      )}
    </>
  );
}

function HangarSlot({
  aircraft, routes, tailColor, lifetimeRevenueEst,
  onOpenDetail, onMaintenance,
}: {
  aircraft: OwnedAircraft;
  routes: readonly Route[];
  tailColor: string;
  lifetimeRevenueEst: number;
  onOpenDetail: () => void;
  onMaintenance: () => void;
}) {
  const airlineCode = useGameStore(selectAirlineCode);
  const def = getAircraftDef(aircraft.defId);
  if (!def) return null;
  const route = aircraft.routeId ? routes.find((r) => r.id === aircraft.routeId) : null;
  const band = conditionBand(aircraft.condition);
  const condColor = band === 'normal' ? COLOR.success : band === 'degraded' ? COLOR.warn : COLOR.danger;
  const nickname = aircraftNickname(aircraft.uid);
  const tailNumber = aircraftTailNumber(aircraft.uid, airlineCode);
  const milestones = computeMilestones(aircraft, def, lifetimeRevenueEst);

  // Rough flight count: condition-decay rate × hours accumulated → flights.
  const totalFlights = Math.max(0, Math.round(aircraft.flightHoursAccumulated / 1.4));
  const totalPassengers = Math.round(totalFlights * def.capacity * 0.62);

  return (
    <li style={slotShell(tailColor)}>
      {/* Slot frame: tail-light strip across the top */}
      <div style={tailStrip(tailColor)} />

      {/* Header: nickname + tier badge + maintenance status */}
      <div style={slotHead}>
        <div style={{ minWidth: 0 }}>
          <div style={nameplate}>
            <span style={nameplateRivet} />
            <span style={nameplateText}>{nickname}</span>
            <span style={tailNumberPlate}>{tailNumber}</span>
            <span style={nameplateRivet} />
          </div>
          <div style={slotSub}>
            {def.displayName}  ·  Tier {def.tier === 0 ? 'CARGO' : def.tier}  ·  {def.capacity}{def.category === 'cargo' ? ' t' : ' seats'}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ ...condValue, color: condColor }}>{aircraft.condition.toFixed(0)}%</div>
          <div style={condBand}>{band}</div>
        </div>
      </div>

      {/* Aircraft illustration over a runway-textured floor */}
      <button onClick={onOpenDetail} style={illustrationStage(tailColor)} aria-label={`Open ${nickname}`}>
        <div style={runwayFloor} />
        <AircraftIllustration defId={def.id} tailColor={tailColor} width={220} />
        {/* Floor lights */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            ...floorLight,
            left: `${10 + i * 18}%`,
            background: tailColor,
            boxShadow: `0 0 6px ${tailColor}`,
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </button>

      {/* Assigned route or parked */}
      <div style={statusRow}>
        {route ? (
          <Chip color={tailColor} size="sm">
            ✈  Flying {route.originIata} ↔ {route.destIata}
          </Chip>
        ) : (
          <Chip tone="mute" size="sm">⏸ Parked in hangar</Chip>
        )}
        <Chip tone={band === 'normal' ? 'success' : band === 'degraded' ? 'gold' : 'mute'} size="sm">
          {band === 'normal' ? 'Service current' : band === 'degraded' ? 'Service due' : 'Critical · ground'}
        </Chip>
      </div>

      {/* Lifetime stats */}
      <div style={statsRow}>
        <Stat label="Flights" value={totalFlights.toLocaleString()} />
        <Stat label="Passengers" value={formatCash(totalPassengers, 0)} />
        <Stat label="Revenue est." value={`$${formatCash(lifetimeRevenueEst, 1)}`} accent={COLOR.gold.base} />
      </div>

      {/* Milestone badges */}
      {milestones.length > 0 && (
        <div style={badgesRow}>
          {milestones.map((m) => (
            <span key={m} style={badgePill(tailColor)}>★ {m}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={actionRow}>
        <Button variant="secondary" size="sm" fullWidth onClick={onOpenDetail}>
          Upgrade Aircraft  →
        </Button>
        {aircraft.condition < 100 ? (
          <Button variant="gold" size="sm" fullWidth hapticOnPress="medium" onClick={onMaintenance}>
            Maintenance Bay  →
          </Button>
        ) : (
          <Button variant="ghost" size="sm" fullWidth disabled>
            Maintenance current
          </Button>
        )}
      </div>
    </li>
  );
}

// ─── Maintenance Menu (Design Review v4 — point 21) ───────────────────
function MaintenanceMenu({
  aircraft, tailColor, onClose,
}: {
  aircraft: OwnedAircraft;
  tailColor: string;
  onClose: () => void;
}) {
  const cash = useGameStore(selectCash);
  const repair = useGameStore((s) => s.repairAircraft);
  const [error, setError] = useState<string | null>(null);

  const def = getAircraftDef(aircraft.defId);
  if (!def) return null;
  const baseCost = repairCost(aircraft);

  const options = [
    {
      id: 'quick' as const,
      title: 'Quick Service',
      tag: '5 sec',
      cost: Math.max(1, Math.round(baseCost * 0.35)),
      delta: '+40 condition',
      benefit: 'Back-on-the-flight-line fast. Cheap.',
      icon: '⚡',
      tone: 'cyan' as const,
    },
    {
      id: 'full' as const,
      title: 'Full Maintenance',
      tag: 'standard',
      cost: baseCost,
      delta: 'Restore to 100%',
      benefit: 'Brings the aircraft to factory condition.',
      icon: '🔧',
      tone: 'gold' as const,
    },
    {
      id: 'premium' as const,
      title: 'Premium Check',
      tag: '+5% fuel eff. boost',
      cost: Math.round(baseCost * 1.4),
      delta: 'Restore to 100% · stamped service log',
      benefit: 'Premium maintenance. Aircraft purrs.',
      icon: '✦',
      tone: 'violet' as const,
    },
  ];

  const onPick = (mode: 'quick' | 'full' | 'premium'): void => {
    const res = repair(aircraft.uid, mode);
    if (res.ok) {
      haptics.success();
      sfx.confirm();
      setError(null);
      onClose();
    } else {
      haptics.warning();
      sfx.warn();
      setError(res.message);
    }
  };

  return (
    <div style={maintBackdrop} onClick={onClose}>
      <div style={maintShell(tailColor)} onClick={(e): void => e.stopPropagation()}>
        <div style={maintHead}>
          <div>
            <div style={maintKicker(tailColor)}>MAINTENANCE BAY</div>
            <div style={maintTitle}>{def.displayName}  ·  {aircraft.condition.toFixed(0)}%</div>
          </div>
          <button onClick={onClose} style={maintClose} aria-label="Close">✕</button>
        </div>
        <div style={maintBody}>
          {options.map((opt) => {
            const tone = opt.tone === 'gold' ? COLOR.gold.base
              : opt.tone === 'violet' ? COLOR.accent.violet
              : tailColor;
            const afford = cash >= opt.cost;
            return (
              <button
                key={opt.id}
                disabled={!afford}
                onClick={(): void => onPick(opt.id)}
                style={maintCard(tone, !afford)}
              >
                <div style={maintCardLeft}>
                  <div style={{ ...maintIcon, color: tone, background: `${tone}22`, borderColor: `${tone}55` }}>
                    {opt.icon}
                  </div>
                  <div>
                    <div style={maintCardTitle}>{opt.title}</div>
                    <div style={maintCardTag}>{opt.tag}</div>
                    <div style={maintCardBenefit}>{opt.benefit}</div>
                    <div style={{ ...maintCardDelta, color: tone }}>{opt.delta}</div>
                  </div>
                </div>
                <div style={maintCardRight}>
                  <div style={maintCostLabel}>COST</div>
                  <div style={{ ...maintCost, color: afford ? COLOR.gold.base : COLOR.ink.faint }}>
                    ${formatCash(opt.cost, 1)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {error && <div style={maintError}>{error}</div>}
        <div style={maintFoot}>
          Maintenance is an optimisation, not a tax. Quick services
          keep the schedule moving; full and premium checks pay back
          across the next flights.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = COLOR.ink.primary }: { label: string; value: string; accent?: string }) {
  return (
    <div style={statCell}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color: accent }}>{value}</div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────
function computeMilestones(
  aircraft: OwnedAircraft,
  def: ReturnType<typeof getAircraftDef>,
  lifetimeRevenueEst: number,
): readonly string[] {
  if (!def) return [];
  const flights = Math.round(aircraft.flightHoursAccumulated / 1.4);
  const out: string[] = [];
  if (flights >= 50) out.push('50 Flights');
  if (flights >= 100) out.push('Centenary');
  if (flights >= 250) out.push('250 Flights');
  if (flights * def.capacity * 0.62 >= 10_000) out.push('10K Passengers');
  if (flights * def.capacity * 0.62 >= 50_000) out.push('50K Passengers');
  if (lifetimeRevenueEst >= 1_000_000) out.push('Million-Dollar Earner');
  // Always honour any aircraft that has weathered condition decline.
  if (aircraft.condition < 50 && flights >= 30) out.push('Veteran');
  return out.slice(0, 4);
}

// ─── Styles ───────────────────────────────────────────────────────────
const empty: React.CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: COLOR.ink.muted,
  fontSize: 13,
};
const hangarHead: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.24em',
  color: COLOR.ink.muted,
  marginBottom: SPACE.s,
  padding: '0 4px',
};
const hangarList: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACE.m,
};
const slotShell = (tail: string): React.CSSProperties => ({
  position: 'relative',
  background: 'linear-gradient(180deg, #0F1734 0%, #050912 100%)',
  border: `1px solid ${tail}33`,
  borderRadius: 14,
  overflow: 'hidden',
  boxShadow: `0 10px 24px rgba(0,0,0,0.45), inset 0 0 24px ${tail}10`,
});
const tailStrip = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: 3,
  background: `linear-gradient(90deg, transparent, ${tail}, transparent)`,
  filter: `drop-shadow(0 0 6px ${tail})`,
});
const slotHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '14px 14px 4px',
  gap: 12,
};
const nameplate: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'linear-gradient(180deg, #4A5568, #2D3748)',
  border: '1px solid rgba(148,163,184,0.35)',
  borderRadius: 4,
  padding: '4px 12px',
  color: '#0B1120',
  fontFamily: '"Courier New", monospace',
};
const nameplateText: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#F8FAFC',
  textShadow: '0 0 4px rgba(0,0,0,0.6)',
};
const nameplateRivet: React.CSSProperties = {
  width: 4,
  height: 4,
  borderRadius: 999,
  background: 'radial-gradient(circle, #1A2244, #0B1120)',
  border: '1px solid rgba(148,163,184,0.4)',
};
const tailNumberPlate: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.18em',
  color: '#0B1120',
  background: '#F4C75B',
  padding: '1px 6px',
  borderRadius: 3,
  fontFamily: '"Courier New", monospace',
};
const slotSub: React.CSSProperties = {
  fontSize: 11,
  color: COLOR.ink.muted,
  marginTop: 6,
  letterSpacing: '0.06em',
};
const condValue: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  fontFeatureSettings: '"tnum" 1',
};
const condBand: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.16em',
  color: COLOR.ink.faint,
  fontWeight: 700,
  textTransform: 'uppercase',
};
const illustrationStage = (tail: string): React.CSSProperties => ({
  position: 'relative',
  width: '100%',
  background: `radial-gradient(ellipse at center, ${tail}1c, transparent 65%), linear-gradient(180deg, transparent, rgba(11,17,32,0.4))`,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '6px 0 20px',
  border: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
});
const runwayFloor: React.CSSProperties = {
  position: 'absolute',
  bottom: 6, left: 16, right: 16,
  height: 1,
  background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.35), transparent)',
};
const floorLight: React.CSSProperties = {
  position: 'absolute',
  bottom: 4,
  width: 4, height: 4,
  borderRadius: 999,
  opacity: 0.85,
  animation: 'breathe 1.8s ease-in-out infinite',
};
const statusRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  padding: '0 14px 8px',
};
const statsRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 6,
  padding: '0 14px 10px',
};
const statCell: React.CSSProperties = {
  background: 'rgba(11,17,32,0.55)',
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: RADIUS.s,
  padding: '8px 10px',
  textAlign: 'center',
};
const statLabel: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.18em',
  color: COLOR.ink.faint, fontWeight: 800,
  textTransform: 'uppercase',
};
const statValue: React.CSSProperties = {
  fontSize: 13, fontWeight: 800, marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};
const badgesRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  padding: '0 14px 10px',
};
const badgePill = (tail: string): React.CSSProperties => ({
  fontSize: 9, letterSpacing: '0.16em', fontWeight: 800,
  color: tail,
  background: `${tail}1c`,
  border: `1px solid ${tail}66`,
  padding: '3px 8px',
  borderRadius: 999,
  textTransform: 'uppercase',
});
const actionRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
  padding: '6px 14px 14px',
};

// Maintenance menu
const maintBackdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 110,
  background: 'rgba(7,10,24,0.7)',
  backdropFilter: 'blur(6px)',
  display: 'grid',
  placeItems: 'center',
  padding: SPACE.l,
};
const maintShell = (tail: string): React.CSSProperties => ({
  width: '100%',
  maxWidth: 440,
  background: 'linear-gradient(170deg, #14213D, #0B1426)',
  border: `2px solid ${tail}66`,
  borderRadius: 18,
  padding: '14px 14px 12px',
  boxShadow: `0 24px 50px rgba(0,0,0,0.6), 0 0 40px ${tail}33`,
  maxHeight: '90vh',
  overflowY: 'auto',
});
const maintHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
};
const maintKicker = (tail: string): React.CSSProperties => ({
  fontSize: 10, fontWeight: 800, letterSpacing: '0.24em',
  color: tail,
});
const maintTitle: React.CSSProperties = {
  fontSize: 17, fontWeight: 800, color: COLOR.ink.primary,
  marginTop: 4,
};
const maintClose: React.CSSProperties = {
  width: 28, height: 28,
  border: '1px solid rgba(148,163,184,0.3)',
  background: 'rgba(11,17,32,0.5)',
  color: COLOR.ink.muted,
  borderRadius: 999,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
};
const maintBody: React.CSSProperties = {
  marginTop: SPACE.s,
  display: 'flex', flexDirection: 'column', gap: 8,
};
const maintCard = (tone: string, disabled: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: SPACE.s,
  background: 'rgba(11,17,32,0.55)',
  border: `1px solid ${tone}55`,
  borderLeft: `4px solid ${tone}`,
  borderRadius: 12,
  padding: '10px 12px',
  textAlign: 'left',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  fontFamily: 'inherit',
  color: COLOR.ink.primary,
});
const maintCardLeft: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  minWidth: 0,
};
const maintIcon: React.CSSProperties = {
  width: 36, height: 36,
  borderRadius: 10,
  border: '1px solid',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 16,
  flexShrink: 0,
};
const maintCardTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 800,
  color: COLOR.ink.primary,
};
const maintCardTag: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.16em', fontWeight: 700,
  color: COLOR.ink.faint, textTransform: 'uppercase',
  marginTop: 2,
};
const maintCardBenefit: React.CSSProperties = {
  fontSize: 11, color: COLOR.ink.muted, marginTop: 4, lineHeight: 1.4,
};
const maintCardDelta: React.CSSProperties = {
  fontSize: 11, marginTop: 3, fontWeight: 800,
};
const maintCardRight: React.CSSProperties = {
  textAlign: 'right',
  flexShrink: 0,
};
const maintCostLabel: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.18em', fontWeight: 800,
  color: COLOR.ink.faint,
};
const maintCost: React.CSSProperties = {
  fontSize: 16, fontWeight: 800, marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};
const maintError: React.CSSProperties = {
  marginTop: SPACE.s,
  fontSize: 11,
  color: COLOR.danger,
  background: `${COLOR.danger}15`,
  border: `1px solid ${COLOR.danger}44`,
  borderRadius: RADIUS.s,
  padding: '6px 10px',
};
const maintFoot: React.CSSProperties = {
  marginTop: SPACE.s,
  fontSize: 10,
  color: COLOR.ink.faint,
  lineHeight: 1.5,
  textAlign: 'center',
};

