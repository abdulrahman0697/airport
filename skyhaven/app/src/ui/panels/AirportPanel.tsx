/**
 * Airport (Home) panel (Design Review v2 — points 2, 14, 22, 23).
 *
 * The new flagship "home" surface. Replaces the old idea of starting
 * the player at a bare map by giving them a living illustration of
 * their home airport — the same physical asset that visibly grows
 * with progression. Closes the "this should be a tycoon, not a route
 * dashboard" gap.
 *
 * Layout:
 *  - PanelHeader: kicker "Home Base", title <home hub IATA or
 *    'Your Airport'>, subtitle "Tier N · M routes operating".
 *  - Hero illustration (AirportScene), sized to the panel width.
 *  - "Active operations" mini-card: live counts (flights today,
 *    boarding now, baggage in transit) — placeholder figures derived
 *    from routes / fleet state until a true ops model lands.
 *  - "What grows next" card: the next visible upgrade the player will
 *    unlock at the next tier.
 */
import { useMemo } from 'react';
import { TIER_UNLOCK_THRESHOLDS, MAX_TIER } from '../../engine/tierUnlocks';
import {
  selectFleet,
  selectHubs,
  selectLifetime,
  selectRoutes,
  selectTailColor,
  selectTier,
  useGameStore,
} from '../../state/store';
import { AIRPORT_GROWTH } from '../../data/tierGrowth';
import { AirportScene } from '../design/AirportScene';
import { Chip } from '../design/Chip';
import { HeroCard } from '../design/HeroCard';
import { PanelHeader } from '../design/PanelHeader';
import { COLOR, RADIUS, SPACE, TYPE } from '../design/tokens';
import { formatCash } from '../format';

export function AirportPanel() {
  const tier = useGameStore(selectTier);
  const tailColor = useGameStore(selectTailColor);
  const routes = useGameStore(selectRoutes);
  const fleet = useGameStore(selectFleet);
  const hubs = useGameStore(selectHubs);
  const lifetime = useGameStore(selectLifetime);

  const homeHubIata = hubs[0]?.iata ?? null;
  // Synthesised operations metrics for that hub feel — purely cosmetic
  // figures derived from the live state so they tick along naturally.
  const ops = useMemo(() => {
    const flightsToday = routes.length * 24;
    const boardingNow = Math.min(routes.length, 6);
    const baggageInTransit = Math.round(routes.length * 18.5);
    const passengersServed = Math.round(lifetime / 18); // ~$18 avg yield
    return { flightsToday, boardingNow, baggageInTransit, passengersServed };
  }, [routes.length, lifetime]);

  const nextGrowth = AIRPORT_GROWTH[tier]; // tier is 1-indexed; array is 0-indexed → next tier
  const currentGrowth = AIRPORT_GROWTH[tier - 1];
  const nextThreshold = tier < MAX_TIER ? (TIER_UNLOCK_THRESHOLDS[tier + 1] ?? null) : null;
  const remainingToNext = nextThreshold !== null
    ? Math.max(0, nextThreshold - lifetime)
    : null;

  return (
    <div style={shell}>
      <PanelHeader
        kicker="Home Base"
        title={homeHubIata ? `${homeHubIata} · Your Airport` : 'Your Airport'}
        subtitle={`Tier ${tier} · ${routes.length} routes operating · ${fleet.length} aircraft`}
        right={<Chip color={tailColor}>Tier {tier}</Chip>}
      />
      <div style={body}>
        {/* Hero illustration */}
        <div style={heroWrap}>
          <AirportScene tier={tier} tailColor={tailColor} width={360} />
          <div style={{ ...heroCurrent, color: tailColor }}>
            <span style={heroCurrentDot} />
            {currentGrowth ? currentGrowth.label : '—'}
          </div>
        </div>

        {/* Active operations */}
        <section style={card}>
          <div style={sectionHead}>Active Operations</div>
          <div style={opsGrid}>
            <Stat label="Flights today" value={ops.flightsToday.toString()} accent={tailColor} />
            <Stat label="Boarding now" value={ops.boardingNow.toString()} accent={COLOR.gold.base} />
            <Stat label="Baggage in transit" value={ops.baggageInTransit.toString()} />
            <Stat label="Passengers served" value={formatCash(ops.passengersServed)} accent={COLOR.success} />
          </div>
        </section>

        {/* What grows next */}
        {nextGrowth && (
          <HeroCard
            accent={COLOR.gold.base}
            title={`Next: Tier ${nextGrowth.tier} unlock`}
            subtitle={nextGrowth.label}
            chips={<Chip tone="gold">Next physical change</Chip>}
            right={remainingToNext !== null ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: COLOR.ink.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>To unlock</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: COLOR.gold.base, fontFeatureSettings: '"tnum" 1' }}>
                  +${formatCash(remainingToNext)}
                </div>
              </div>
            ) : (
              <Chip tone="success">Max tier</Chip>
            )}
          />
        )}

        <p style={hint}>
          Your home airport physically grows as your airline does. Open more routes, hit the next lifetime-earnings tier, and watch new
          terminals, hangars, runways and amenities appear here.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = COLOR.ink.primary,
  sub,
}: {
  label: string;
  value: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <div style={statCell}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color: accent }}>{value}</div>
      {sub && <div style={statSub}>{sub}</div>}
    </div>
  );
}

const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const body: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: SPACE.m,
  display: 'flex', flexDirection: 'column', gap: SPACE.m,
};

const heroWrap: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  background: COLOR.bg.glass,
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: RADIUS.m,
  padding: SPACE.s,
};
const heroCurrent: React.CSSProperties = {
  position: 'absolute',
  bottom: SPACE.s + 6,
  left: SPACE.l,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(11,17,32,0.78)',
  padding: '4px 10px',
  borderRadius: RADIUS.pill,
  border: `1px solid ${COLOR.border.medium}`,
};
const heroCurrentDot: React.CSSProperties = {
  width: 6, height: 6, borderRadius: 999, background: 'currentColor',
  boxShadow: '0 0 6px currentColor',
};

const card: React.CSSProperties = {
  background: COLOR.bg.glass,
  borderRadius: RADIUS.m,
  border: `1px solid ${COLOR.border.soft}`,
  padding: SPACE.m,
};
const sectionHead: React.CSSProperties = {
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.letter,
  textTransform: TYPE.label.transform,
  color: COLOR.ink.muted,
  marginBottom: SPACE.s,
};
const opsGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: SPACE.s,
};
const statCell: React.CSSProperties = {
  background: 'rgba(11,17,32,0.55)',
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: RADIUS.s,
  padding: '10px 12px',
};
const statLabel: React.CSSProperties = {
  fontSize: TYPE.label.size,
  fontWeight: TYPE.label.weight,
  letterSpacing: TYPE.label.letter,
  textTransform: TYPE.label.transform,
  color: COLOR.ink.muted,
};
const statValue: React.CSSProperties = {
  fontSize: 20, fontWeight: 800, marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};
const statSub: React.CSSProperties = {
  fontSize: 10, color: COLOR.ink.faint, marginTop: 2,
};

const hint: React.CSSProperties = {
  margin: 0,
  padding: SPACE.s,
  fontSize: 11,
  color: COLOR.ink.faint,
  textAlign: 'center',
  lineHeight: 1.5,
};
