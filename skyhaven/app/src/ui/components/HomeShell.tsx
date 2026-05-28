/**
 * HomeShell — Design Review v3 (points 13, 14, 15, 16, 25).
 *
 * The new default surface. When no panel is open and the player isn't
 * explicitly in map mode, the home airport diorama fills the top of
 * the screen and three bold action cards sit below: Open Route, Buy
 * Aircraft, Upgrade Airport. The map is one tap away via the Network
 * tab — but the airport is the toy.
 *
 * The diorama is interactive: tap a zone (terminal, runway, cargo
 * apron, tower, parking, lounge, hotel) and a contextual ZoneCard
 * slides in with the matching upgrade or operational drill-down.
 *
 * Active operations stats are clickable and feed sub-views:
 *   - Flights today      → recent flight log
 *   - Boarding now       → boarding progress card
 *   - Baggage in transit → baggage handling status
 *   - Passengers served  → passenger satisfaction segment chart
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { getAircraftDef } from '../../data/aircraft';
import { AIRPORT_GROWTH } from '../../data/tierGrowth';
import { cashPerSecond } from '../../engine/economy';
import { MAX_TIER, TIER_UNLOCK_THRESHOLDS } from '../../engine/tierUnlocks';
import {
  selectActiveEvents,
  selectFleet,
  selectHubs,
  selectLifetime,
  selectRoutes,
  selectTailColor,
  selectTier,
  selectTutorialCompleted,
  useGameStore,
} from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { AirportScene, type AirportZone } from '../design/AirportScene';
import { Button } from '../design/Button';
import { COLOR, RADIUS, SHADOW, SPACE } from '../design/tokens';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { NetworkSkyView } from './NetworkSkyView';
import { usePanelStore } from './PanelHost';

const ZONE_LABELS: Record<AirportZone, { name: string; body: string; cta?: string; ctaPanel?: 'fleet' | 'routes' | 'fuel' | 'crew' }> = {
  terminal: {
    name: 'Passenger Terminal',
    body: 'Check-in, security and gates feed your routes. Bigger terminals unlock at higher tiers.',
    cta: 'Tune fleet',
    ctaPanel: 'fleet',
  },
  gate: {
    name: 'Gates',
    body: 'Each gate handles one boarding aircraft at a time. More gates ⇒ more concurrent flights without delays.',
    cta: 'See aircraft',
    ctaPanel: 'fleet',
  },
  runway: {
    name: 'Runway',
    body: 'A second runway unlocks at Tier 6 — until then, traffic queues if you push the throughput too hard.',
    cta: 'See routes',
    ctaPanel: 'routes',
  },
  tower: {
    name: 'Control Tower',
    body: 'Coordinates traffic and unlocks weather alerts. Built at Tier 3.',
    cta: 'See operations',
    ctaPanel: 'routes',
  },
  cargo: {
    name: 'Cargo Apron',
    body: 'Belly cargo + dedicated freighters move parcels and pharma. Cargo missions appear once unlocked.',
    cta: 'Open hangar',
    ctaPanel: 'fleet',
  },
  parking: {
    name: 'Parking & Ground Vehicles',
    body: 'Faster aircraft turnaround. Unlocked at Tier 4.',
  },
  lounge: {
    name: 'Premium Lounge',
    body: 'Unlocks Premium-pricing yield on every route. Required for VIP demand.',
    cta: 'Route mode: premium',
    ctaPanel: 'routes',
  },
  hotel: {
    name: 'Airport Hotel',
    body: 'Late-game vanity build — a marker that you’ve reached the top of the empire ladder.',
  },
  metro: {
    name: 'Metro / Rail Link',
    body: 'Tier-7 mega-airport amenity. Brings far-region demand closer.',
  },
};

export function HomeShell() {
  const tier = useGameStore(selectTier);
  const tailColor = useGameStore(selectTailColor);
  const routes = useGameStore(selectRoutes);
  const fleet = useGameStore(selectFleet);
  const hubs = useGameStore(selectHubs);
  const lifetime = useGameStore(selectLifetime);
  const activeEvents = useGameStore(selectActiveEvents);
  const tutorialDone = useGameStore(selectTutorialCompleted);

  const activePanel = usePanelStore((s) => s.active);
  const open = usePanelStore((s) => s.open);
  const mapMode = useUiStore((s) => s.mapMode);
  const setMapMode = useUiStore((s) => s.setMapMode);
  const introDismissed = useUiStore((s) => s.introDismissed);

  const focusZone = useUiStore((s) => s.airportZoneFocus) as AirportZone | null;
  const setFocusZone = useUiStore((s) => s.setAirportZoneFocus);
  const opsDrill = useUiStore((s) => s.opsDrillDown);
  const setOpsDrill = useUiStore((s) => s.setOpsDrillDown);

  const perSec = useMemo(() => {
    const byUid = new Map(fleet.map((a) => [a.uid, a]));
    let total = 0;
    for (const r of routes) {
      const a = byUid.get(r.aircraftUid);
      if (!a || !getAircraftDef(a.defId)) continue;
      total += cashPerSecond(r, a, hubs, activeEvents);
    }
    return total;
  }, [routes, fleet, hubs, activeEvents]);

  // Passenger stream — Design Review v4, point 17. The mix carries
  // the player's pricing strategy: economy routes → mostly blue dots,
  // balanced → blue + a few gold, premium → blue + business gold +
  // white VIP halo. Tourist green dots appear when traffic is up.
  // Even a brand-new airport runs 4 dots so the diorama never reads
  // as dead.
  const passengerLoad = Math.min(12, 4 + routes.length * 2);
  const premiumPax = routes.some((r) => r.pricing === 'premium');
  const paxMix = useMemo(() => {
    if (routes.length === 0) return { economy: 3, business: 0, tourist: 1, vip: 0 };
    let econ = 0, biz = 0, tour = 0, vip = 0;
    for (const r of routes) {
      if (r.pricing === 'economy') { econ += 3; tour += 1; }
      else if (r.pricing === 'balanced') { econ += 2; biz += 1; tour += 1; }
      else { econ += 1; biz += 2; vip += 1; }
    }
    return { economy: econ, business: biz, tourist: tour, vip };
  }, [routes]);

  // Cargo apron heat — Design Review v4, point 19. When the player
  // owns cargo aircraft / cargo routes, the apron animation shifts:
  // more crates, a slow truck, and a "CARGO ACTIVE" tag in the
  // diorama. Cargo becomes a visible parallel economy rather than a
  // label on a card.
  const cargoActive = useMemo(() => {
    if (tier < 2) return false;
    // Heuristic: at least one cargo aircraft OR an explicit "cargo"
    // backlog signal once we add the engine state for it. For now,
    // any cargo aircraft in the hangar lights the apron.
    return fleet.some((a) => {
      const def = a.defId.startsWith('c.') || a.defId.includes('cargo')
        || ['b767f', 'a330f', 'md11f', 'b777f', 'a350f', 'b747f'].some((c) => a.defId.includes(c));
      return def;
    });
  }, [fleet, tier]);

  // What grows next (for the Upgrade Airport card + ghost overlay).
  const nextGrowth = AIRPORT_GROWTH[tier];
  const currentGrowth = AIRPORT_GROWTH[tier - 1];
  const nextThreshold = tier < MAX_TIER ? (TIER_UNLOCK_THRESHOLDS[tier + 1] ?? null) : null;
  const remainingToNext = nextThreshold !== null ? Math.max(0, nextThreshold - lifetime) : null;
  const curThreshold = TIER_UNLOCK_THRESHOLDS[tier] ?? 0;
  const span = Math.max(1, (nextThreshold ?? curThreshold * 2) - curThreshold);
  const upgradePct = nextThreshold !== null
    ? Math.max(0, Math.min(1, (lifetime - curThreshold) / span))
    : 1;

  // Derived ops figures — purely cosmetic but keep them honest with
  // live state so they feel alive.
  const flightsToday = routes.length * 24;
  const boardingNow = Math.min(routes.length, 6);
  const baggageInTransit = Math.round(routes.length * 18.5);
  const passengersServed = Math.round(lifetime / 18);

  // Visibility: only show when no panel is open, intro dismissed, not
  // in map mode, and the cinematic / hub picker isn't blocking.
  const visible = introDismissed && activePanel === null && !mapMode;
  // Also keep HomeShell hidden during the tutorial's first wait-state
  // step (fuel) so the spotlight + Mission Control strip have a clear
  // canvas. Re-appears once tutorial finishes.
  const [hidden, setHidden] = useState(!tutorialDone);
  useEffect(() => {
    setHidden(!tutorialDone);
  }, [tutorialDone]);

  if (!visible || hidden) return null;

  const onZoneTap = (z: AirportZone): void => {
    haptics.light();
    setFocusZone(z);
  };

  const closeZone = (): void => setFocusZone(null);

  return (
    <div style={shell}>
      {/* Header line — slim, just identity + view-network shortcut. */}
      <div style={topBand(tailColor)}>
        <div style={topBandRow}>
          <div style={topKicker}>HOME BASE  ·  {hubs[0]?.iata ?? '—'}  ·  TIER {tier}</div>
          <button onClick={(): void => setMapMode(true)} style={mapPeekBtn(tailColor)}>
            View Network →
          </button>
        </div>
      </div>

      {/* Living Airport + Global Network Split View — signature loop.
          Compact sky strip above the dominant diorama. */}
      <div style={skyStripWrap}>
        <NetworkSkyView
          width={Math.min(560, window.innerWidth - 16)}
          height={110}
          routes={routes}
          fleet={fleet}
          hubs={hubs}
          activeEvents={activeEvents}
          tailColor={tailColor}
        />
      </div>

      {/* Dominant interactive diorama — Design Review v5 point 12, 13.
          Now ~60% of the home surface. The stats grid + expansion
          preview used to live below it; they've been moved behind the
          "Operations details" disclosure so the player sees the airport
          breathing, not a dashboard. */}
      <div style={dioramaWrapBig}>
        <div style={dioramaInner}>
          <AirportScene
            tier={tier}
            tailColor={tailColor}
            width={Math.min(560, window.innerWidth - 16)}
            passengerLoad={passengerLoad}
            paxMix={paxMix}
            premium={premiumPax}
            cargoBacklog={cargoActive}
            onZoneTap={onZoneTap}
            showNextGhost
          />
        </div>
        <div style={dioramaLive(tailColor)}>
          <span style={liveDot(tailColor)} />
          LIVE  ·  {boardingNow} BOARDING  ·  {flightsToday} FLIGHTS TODAY
        </div>
        {cargoActive && (
          <div style={cargoActiveBadge}>
            <span style={liveDot(COLOR.gold.base)} />
            CARGO ACTIVE  ·  APRON SERVICING
          </div>
        )}
      </div>

      {/* Action cards: the three big things you can do from home. */}
      <div style={actionRow}>
        <ActionCard
          tailColor={tailColor}
          icon="✈"
          label="Open Route"
          sub={routes.length === 0 ? 'Start earning income/min' : `${routes.length} routes flying`}
          onClick={(): void => open('routes')}
        />
        <ActionCard
          tailColor={tailColor}
          icon="🛬"
          label="Buy Aircraft"
          sub={`${fleet.length} in hangar`}
          onClick={(): void => open('fleet')}
        />
        <ActionCard
          tailColor={tailColor}
          icon="🏗"
          label="Upgrade Airport"
          sub={nextGrowth
            ? `+${nextGrowth.label}`
            : 'Max tier'}
          accent
          onClick={(): void => setFocusZone('terminal')}
        />
      </div>

      {/* Operations details — collapsed by default. Tapping reveals
          the stats grid + expansion preview that used to clutter the
          home view. Most casual taps never need it. */}
      <OperationsDetailsDeck
        tailColor={tailColor}
        flightsToday={flightsToday}
        boardingNow={boardingNow}
        baggageInTransit={baggageInTransit}
        passengersServed={passengersServed}
        nextGrowth={nextGrowth}
        currentGrowth={currentGrowth}
        remainingToNext={remainingToNext}
        upgradePct={upgradePct}
        tier={tier}
        onOpsDrill={setOpsDrill}
      />

      {/* Zone-detail card overlay */}
      <AnimatePresence>
        {focusZone && (
          <ZoneCard
            zone={focusZone}
            tailColor={tailColor}
            onClose={closeZone}
            onCta={(panel): void => { closeZone(); open(panel); }}
          />
        )}
      </AnimatePresence>

      {/* Operation drill-down card overlay */}
      <AnimatePresence>
        {opsDrill && (
          <OpsDrillCard
            kind={opsDrill}
            tailColor={tailColor}
            routes={routes.length}
            fleet={fleet.length}
            lifetime={lifetime}
            perSec={perSec}
            onClose={(): void => setOpsDrill(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function OperationsDetailsDeck({
  tailColor, flightsToday, boardingNow, baggageInTransit, passengersServed,
  nextGrowth, currentGrowth, remainingToNext, upgradePct, tier, onOpsDrill,
}: {
  tailColor: string;
  flightsToday: number;
  boardingNow: number;
  baggageInTransit: number;
  passengersServed: number;
  nextGrowth: { tier: number; label: string; era: string } | undefined;
  currentGrowth: { label: string } | undefined;
  remainingToNext: number | null;
  upgradePct: number;
  tier: number;
  onOpsDrill: (k: 'flights' | 'boarding' | 'baggage' | 'passengers') => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={detailsDeck}>
      <button
        onClick={(): void => setOpen((v) => !v)}
        style={detailsToggle(open, tailColor)}
        aria-expanded={open}
      >
        <span style={detailsToggleLabel}>
          {open ? '▾' : '▸'} Operations details
        </span>
        <span style={detailsToggleHint(tailColor)}>
          {flightsToday} flights  ·  {boardingNow} boarding  ·  {nextGrowth ? `next: ${nextGrowth.era}` : 'max tier'}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={statsRow}>
              <StatTile label="Flights" value={flightsToday.toString()} accent={tailColor}
                onClick={(): void => onOpsDrill('flights')} />
              <StatTile label="Boarding" value={boardingNow.toString()} accent={COLOR.gold.base}
                onClick={(): void => onOpsDrill('boarding')} />
              <StatTile label="Baggage" value={baggageInTransit.toString()}
                onClick={(): void => onOpsDrill('baggage')} />
              <StatTile label="Pax served" value={formatCash(passengersServed, 1)} accent={COLOR.success}
                onClick={(): void => onOpsDrill('passengers')} />
            </div>
            {nextGrowth && remainingToNext !== null && (
              <ExpansionPreview
                tailColor={tailColor}
                current={currentGrowth?.label ?? '—'}
                next={nextGrowth.label}
                era={nextGrowth.era}
                remaining={remainingToNext}
                pct={upgradePct}
                tier={tier}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatTile({ label, value, accent = COLOR.ink.primary, onClick }: {
  label: string; value: string; accent?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={statTile}>
      <div style={statTileLabel}>{label}</div>
      <div style={{ ...statTileValue, color: accent }}>{value}</div>
      <div style={statTileHint}>tap</div>
    </button>
  );
}

function ActionCard({ tailColor, icon, label, sub, onClick, accent = false }: {
  tailColor: string;
  icon: string;
  label: string;
  sub: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button onClick={onClick} style={actionCard(tailColor, accent)}>
      <div style={actionIcon(tailColor, accent)}>{icon}</div>
      <div style={actionLabel}>{label}</div>
      <div style={actionSub}>{sub}</div>
    </button>
  );
}

function ExpansionPreview({ tailColor, current, next, era, remaining, pct, tier }: {
  tailColor: string;
  current: string;
  next: string;
  era: string;
  remaining: number;
  pct: number;
  tier: number;
}) {
  return (
    <div style={expansionShell(tailColor)}>
      <div style={expansionKickerRow}>
        <div style={expansionKicker}>NEXT EXPANSION  ·  TIER {tier + 1}</div>
        <div style={expansionEra}>{era}</div>
      </div>
      <div style={expansionGrid}>
        <div style={expansionSide}>
          <div style={expansionSideLabel}>NOW</div>
          <div style={expansionSideTitle}>{current}</div>
        </div>
        <div style={expansionArrow(tailColor)}>→</div>
        <div style={{ ...expansionSide, background: `${COLOR.gold.base}11`, borderColor: `${COLOR.gold.base}44` }}>
          <div style={{ ...expansionSideLabel, color: COLOR.gold.base }}>UNLOCK</div>
          <div style={{ ...expansionSideTitle, color: COLOR.gold.light }}>{next}</div>
        </div>
      </div>
      <div style={expansionProgressTrack}>
        <div style={{ ...expansionProgressFill, width: `${pct * 100}%`, background: COLOR.gold.base }} />
      </div>
      <div style={expansionFoot}>
        Construction funded by route earnings · <span style={{ color: COLOR.gold.base, fontWeight: 800 }}>+${formatCash(remaining, 1)}</span> remaining
      </div>
    </div>
  );
}

function ZoneCard({ zone, tailColor, onClose, onCta }: {
  zone: AirportZone;
  tailColor: string;
  onClose: () => void;
  onCta: (panel: 'fleet' | 'routes' | 'fuel' | 'crew') => void;
}) {
  const data = ZONE_LABELS[zone];
  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={zoneCard(tailColor) as Record<string, unknown>}
    >
      <div style={zoneKickerRow}>
        <div style={zoneKicker(tailColor)}>ZONE  ·  {zone.toUpperCase()}</div>
        <button onClick={onClose} style={closeBtn}>✕</button>
      </div>
      <div style={zoneTitle}>{data.name}</div>
      <div style={zoneBody}>{data.body}</div>
      {data.cta && data.ctaPanel && (
        <div style={{ marginTop: SPACE.s }}>
          <Button variant="primary" size="md" fullWidth onClick={(): void => onCta(data.ctaPanel!)}>
            {data.cta} →
          </Button>
        </div>
      )}
    </motion.div>
  );
}

function OpsDrillCard({ kind, tailColor, routes, fleet, lifetime, perSec, onClose }: {
  kind: 'flights' | 'boarding' | 'baggage' | 'passengers';
  tailColor: string;
  routes: number;
  fleet: number;
  lifetime: number;
  perSec: number;
  onClose: () => void;
}) {
  const map = {
    flights: {
      title: 'Flights Today',
      body: `Each active route runs ~24 flights/day. With ${routes} routes that's roughly ${routes * 24} flights — cycling continuously while you play.`,
      foot: `Income generated: $${(perSec * 60).toFixed(0)}/min`,
    },
    boarding: {
      title: 'Boarding Now',
      body: `Up to ${Math.min(routes, 6)} aircraft can board simultaneously — limited by your gate count. Build more gates as your tier grows.`,
      foot: `Avg boarding cycle: ~21s`,
    },
    baggage: {
      title: 'Baggage in Transit',
      body: `Belt + carts handle ~${Math.round(routes * 18.5)} bags right now. Cargo apron upgrades cut handling delays.`,
      foot: `Backlog risk: low`,
    },
    passengers: {
      title: 'Passengers Served',
      body: `Lifetime: ${formatCash(Math.round(lifetime / 18), 1)} passengers across ${routes} routes and ${fleet} aircraft. Premium yields per-pax revenue most.`,
      foot: `Satisfaction: 92%`,
    },
  }[kind];
  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={zoneCard(tailColor) as Record<string, unknown>}
    >
      <div style={zoneKickerRow}>
        <div style={zoneKicker(tailColor)}>OPERATIONS  ·  {kind.toUpperCase()}</div>
        <button onClick={onClose} style={closeBtn}>✕</button>
      </div>
      <div style={zoneTitle}>{map.title}</div>
      <div style={zoneBody}>{map.body}</div>
      <div style={zoneFoot}>{map.foot}</div>
    </motion.div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
  left: 0,
  right: 0,
  bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
  zIndex: 14,
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(180deg, rgba(11,17,32,0.85) 0%, rgba(7,11,24,0.95) 30%, rgba(7,11,24,0.99) 100%)',
  backdropFilter: 'blur(8px)',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
};

const topBand = (tail: string): React.CSSProperties => ({
  padding: '14px 16px 12px',
  borderBottom: `1px solid ${tail}22`,
});
const topBandRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 4,
};
const topKicker: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
  color: COLOR.ink.muted,
};
const mapPeekBtn = (tail: string): React.CSSProperties => ({
  background: `${tail}1a`,
  border: `1px solid ${tail}55`,
  color: tail,
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
  padding: '6px 10px', borderRadius: 999,
  cursor: 'pointer', fontFamily: 'inherit',
});

const skyStripWrap: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '0 8px',
  background: 'transparent',
  marginBottom: -4,
};
const dioramaWrapBig: React.CSSProperties = {
  position: 'relative',
  padding: '4px 8px 10px',
  flex: '1 1 auto',
  minHeight: 280,
  display: 'flex',
  flexDirection: 'column',
};
const detailsDeck: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.05)',
  marginTop: 6,
};
const detailsToggle = (open: boolean, tail: string): React.CSSProperties => ({
  width: '100%',
  background: 'transparent',
  border: 0,
  padding: '10px 14px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  color: open ? tail : '#94A3B8',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
});
const detailsToggleLabel: React.CSSProperties = {
  fontWeight: 800,
};
const detailsToggleHint = (_tail: string): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#64748B',
  textTransform: 'none',
});
const dioramaInner: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: RADIUS.l,
  overflow: 'hidden',
  border: `1px solid ${COLOR.border.soft}`,
  background: 'linear-gradient(180deg, #0F1734, #050912)',
  boxShadow: SHADOW.card,
  minHeight: 240,
};
const cargoActiveBadge: React.CSSProperties = {
  position: 'absolute',
  bottom: 16, right: 20,
  fontSize: 9, fontWeight: 800, letterSpacing: '0.16em',
  color: COLOR.gold.base,
  background: 'rgba(11,17,32,0.85)',
  border: `1px solid ${COLOR.gold.base}55`,
  padding: '4px 10px',
  borderRadius: 999,
  display: 'flex', alignItems: 'center', gap: 6,
};
const dioramaLive = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  bottom: 16, left: 20,
  fontSize: 9, fontWeight: 800, letterSpacing: '0.16em',
  color: tail,
  background: 'rgba(11,17,32,0.85)',
  border: `1px solid ${tail}55`,
  padding: '4px 10px',
  borderRadius: 999,
  display: 'flex', alignItems: 'center', gap: 6,
});
const liveDot = (tail: string): React.CSSProperties => ({
  width: 6, height: 6, borderRadius: 999,
  background: tail,
  boxShadow: `0 0 6px ${tail}`,
});

const statsRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 6,
  padding: '6px 12px',
};
const statTile: React.CSSProperties = {
  background: 'rgba(11,17,32,0.6)',
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: 10,
  padding: '8px 6px 6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  color: COLOR.ink.primary,
};
const statTileLabel: React.CSSProperties = {
  fontSize: 8, letterSpacing: '0.18em',
  color: COLOR.ink.faint, fontWeight: 800,
  textTransform: 'uppercase',
};
const statTileValue: React.CSSProperties = {
  fontSize: 16, fontWeight: 800,
  fontFeatureSettings: '"tnum" 1',
};
const statTileHint: React.CSSProperties = {
  fontSize: 7, letterSpacing: '0.18em',
  color: COLOR.ink.faint, fontWeight: 700,
  opacity: 0.6,
};

const actionRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
  padding: '6px 12px 0',
};
const actionCard = (tail: string, accent: boolean): React.CSSProperties => ({
  background: accent
    ? `linear-gradient(160deg, ${COLOR.gold.base}1c, rgba(11,17,32,0.85))`
    : `linear-gradient(160deg, ${tail}18, rgba(11,17,32,0.85))`,
  border: `1px solid ${accent ? COLOR.gold.base + '66' : tail + '55'}`,
  borderRadius: 14,
  padding: '14px 8px 12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  color: COLOR.ink.primary,
  textAlign: 'center',
  minHeight: 92,
});
const actionIcon = (tail: string, accent: boolean): React.CSSProperties => ({
  fontSize: 22,
  color: accent ? COLOR.gold.base : tail,
  filter: `drop-shadow(0 0 8px ${accent ? COLOR.gold.base + '88' : tail + '55'})`,
  lineHeight: 1,
});
const actionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};
const actionSub: React.CSSProperties = {
  fontSize: 10, color: COLOR.ink.muted,
};

const expansionShell = (tail: string): React.CSSProperties => ({
  margin: '10px 12px',
  padding: '12px 14px 14px',
  borderRadius: 14,
  background: `linear-gradient(160deg, rgba(244,199,91,0.10), rgba(11,17,32,0.85))`,
  border: `1px solid ${tail}33`,
  boxShadow: `0 8px 20px rgba(0,0,0,0.45)`,
});
const expansionKickerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 8,
};
const expansionKicker: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.22em', fontWeight: 800,
  color: COLOR.gold.base,
};
const expansionEra: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.16em', fontWeight: 700,
  color: COLOR.ink.muted,
  textTransform: 'uppercase',
};
const expansionGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 24px 1fr',
  alignItems: 'center',
  gap: 8,
};
const expansionSide: React.CSSProperties = {
  background: 'rgba(11,17,32,0.6)',
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: 10,
  padding: '10px 12px',
};
const expansionSideLabel: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.18em', fontWeight: 800,
  color: COLOR.ink.faint,
};
const expansionSideTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 800, marginTop: 2,
  color: COLOR.ink.primary,
};
const expansionArrow = (tail: string): React.CSSProperties => ({
  fontSize: 18, color: tail, textAlign: 'center', fontWeight: 800,
});
const expansionProgressTrack: React.CSSProperties = {
  marginTop: 10,
  height: 6,
  background: 'rgba(11,17,32,0.5)',
  borderRadius: 999,
  overflow: 'hidden',
};
const expansionProgressFill: React.CSSProperties = {
  height: '100%',
  transition: 'width 320ms cubic-bezier(0.16,1,0.3,1)',
  borderRadius: 999,
};
const expansionFoot: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: COLOR.ink.muted,
};

// Zone / ops detail card overlay
const zoneCard = (tail: string): React.CSSProperties => ({
  position: 'fixed',
  left: 12,
  right: 12,
  bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)',
  maxWidth: 460,
  margin: '0 auto',
  zIndex: 16,
  background: 'linear-gradient(170deg, #14213D, #0B1426)',
  border: `1px solid ${tail}66`,
  borderRadius: 18,
  boxShadow: `0 20px 40px rgba(0,0,0,0.55), 0 0 30px ${tail}33`,
  padding: '14px 16px 16px',
});
const zoneKickerRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const zoneKicker = (tail: string): React.CSSProperties => ({
  fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
  color: tail,
});
const closeBtn: React.CSSProperties = {
  width: 28, height: 28,
  border: '1px solid rgba(148,163,184,0.3)',
  background: 'rgba(11,17,32,0.5)',
  color: COLOR.ink.muted,
  borderRadius: 999,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
};
const zoneTitle: React.CSSProperties = {
  fontSize: 18, fontWeight: 800, marginTop: 4,
  color: COLOR.ink.primary,
};
const zoneBody: React.CSSProperties = {
  fontSize: 13, lineHeight: 1.5, color: COLOR.ink.secondary,
  marginTop: 6,
};
const zoneFoot: React.CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  color: COLOR.gold.base,
  fontWeight: 700,
};
