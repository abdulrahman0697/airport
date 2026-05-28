import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { getAircraftDef } from '../../data/aircraft';
import { loadTopAirports, type Airport } from '../../data/airports';
import { REGIONS } from '../../data/regions';
import { conditionBand } from '../../engine/condition';
import { haversineKm } from '../../engine/distance';
import { cashPerSecond } from '../../engine/economy';
import { hubPickCost, routeOpenCost } from '../../engine/actions';
import {
  hubUpgradeCost,
  MAX_HUB_LEVEL,
  routesAtAirport,
} from '../../engine/hubs';
import { aircraftNickname, routeFlightCode } from '../../engine/identity';
import type { Route } from '../../engine/types';
import {
  selectAirlineCode,
  selectCash,
  selectFleet,
  selectHubs,
  selectRoutes,
  selectUnlockedRegions,
  useGameStore,
} from '../../state/store';
import { countryName } from '../countryNames';
import { Button } from '../design/Button';
import { PanelHeader } from '../design/PanelHeader';
import { formatCash, formatRate } from '../format';
import { haptics } from '../juice/haptics';

export function RoutesPanel() {
  const [tab, setTab] = useState<'routes' | 'hubs' | 'regions'>('routes');
  const [showNew, setShowNew] = useState(false);
  const routes = useGameStore(selectRoutes);
  const hubs = useGameStore(selectHubs);

  return (
    <div style={shell}>
      <PanelHeader
        kicker="Operations"
        title="Network"
        subtitle={`${routes.length} routes · ${hubs.length} hubs`}
        right={tab === 'routes' ? (
          <Button
            data-tutorial="routes-new-button"
            variant="primary"
            size="md"
            onClick={(): void => setShowNew(true)}
            hapticOnPress="medium"
          >
            + New route
          </Button>
        ) : null}
        tabs={
          <div role="tablist" style={{ display: 'flex', gap: 4 }}>
            <button role="tab" onClick={(): void => setTab('routes')}
              style={{ ...tabBtn, ...(tab === 'routes' ? tabActive : {}) }}>
              Routes ({routes.length})
            </button>
            <button role="tab" onClick={(): void => setTab('hubs')}
              style={{ ...tabBtn, ...(tab === 'hubs' ? tabActive : {}) }}>
              Hubs ({hubs.length})
            </button>
            <button role="tab" onClick={(): void => setTab('regions')}
              style={{ ...tabBtn, ...(tab === 'regions' ? tabActive : {}) }}>
              Regions
            </button>
          </div>
        }
      />
      <div style={body}>
        {tab === 'routes' && <RoutesList />}
        {tab === 'hubs' && <HubsList />}
        {tab === 'regions' && <RegionsList />}
      </div>
      {showNew && <NewRouteModal onClose={(): void => setShowNew(false)} />}
    </div>
  );
}

// ──── Routes tab ──────────────────────────────────────────────────────
function RoutesList() {
  const routes = useGameStore(selectRoutes);
  if (routes.length === 0) return <div style={empty}>No active routes. Open your first one →</div>;
  return (
    <ul style={list}>
      {routes.map((r) => <RouteRow key={r.id} route={r} />)}
    </ul>
  );
}

function RouteRow({ route }: { route: Route }) {
  const aircraft = useGameStore((s) => s.state?.fleet.find((a) => a.uid === route.aircraftUid));
  const hubs = useGameStore(selectHubs);
  const airlineCode = useGameStore(selectAirlineCode);
  const setPricing = useGameStore((s) => s.setRoutePricing);
  const closeRoute = useGameStore((s) => s.closeRoute);
  const [error, setError] = useState<string | null>(null);
  // Route Health System — Design Review v5 point 17. Advanced details
  // (pricing toggles, cabin preview, consequence chips, close menu)
  // live behind a single disclosure so the default card answers only
  // the three questions a player actually asks: is it profitable,
  // what's the bottleneck, what should I do next.
  const [showAdvanced, setShowAdvanced] = useState(false);
  if (!aircraft) return null;
  const def = getAircraftDef(aircraft.defId);
  if (!def) return null;

  const cps = cashPerSecond(route, aircraft, hubs);
  const band = conditionBand(aircraft.condition);
  const condColor = band === 'normal' ? '#34D399' : band === 'degraded' ? '#F59E0B' : '#F87171';
  const touchesHub = hubs.some((h) => h.iata === route.originIata || h.iata === route.destIata);
  const isCargo = def.category === 'cargo';

  // Route Health diagnostic — three chips + one recommended action.
  const flightCode = routeFlightCode(route.id, airlineCode);
  const nickname = aircraftNickname(aircraft.uid);
  const hubLvl = hubLevelFor(route, hubs);
  const demand: 'High' | 'Steady' | 'Low' = route.loadFactor >= 0.75 ? 'High'
    : route.loadFactor >= 0.55 ? 'Steady' : 'Low';
  const aircraftFit: 'Excellent' | 'Good' | 'Stretched' =
    route.distanceKm <= def.rangeKm * 0.6 ? 'Excellent'
    : route.distanceKm <= def.rangeKm * 0.9 ? 'Good' : 'Stretched';
  const capacity: 'Open' | 'Tight' | 'Limited' = route.loadFactor >= 0.92 ? 'Limited'
    : route.loadFactor >= 0.78 ? 'Tight' : 'Open';
  const recommendation = computeRecommendation({
    route, aircraft, def, capacity, aircraftFit, conditionBand: band, hubLevel: hubLvl,
  });

  return (
    <li style={card}>
      {/* Top line — origin/dest + rate. The two questions casual taps
          want answered: where does this fly + how much it pays. */}
      <div style={cardHeader}>
        <div style={{ minWidth: 0 }}>
          <div style={cardTitle}>
            {route.originIata} ↔ {route.destIata}
            {route.inaugural && <span style={inauguralBadge}>★ INAUGURAL</span>}
            {touchesHub && <span style={hubBadge}>HUB</span>}
            {isCargo && <span style={cargoBadge}>CARGO</span>}
          </div>
          <div style={cardSubtitle}>
            ✈ {flightCode}  ·  {nickname}  ·  {def.displayName}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={rateText}>{formatRate(cps)}</div>
          <div style={{ color: condColor, fontSize: 11, marginTop: 2 }}>
            {aircraft.condition.toFixed(0)}%  ·  {Math.round(route.distanceKm).toLocaleString()} km
          </div>
        </div>
      </div>

      {/* Route Health chips — three at-a-glance signals. */}
      <div style={healthRow}>
        <HealthChip label="Demand" value={demand}
          tone={demand === 'High' ? 'pos' : demand === 'Steady' ? 'neutral' : 'neg'} />
        <HealthChip label="Aircraft Fit" value={aircraftFit}
          tone={aircraftFit === 'Excellent' ? 'pos' : aircraftFit === 'Good' ? 'neutral' : 'neg'} />
        <HealthChip label="Capacity" value={capacity}
          tone={capacity === 'Open' ? 'pos' : capacity === 'Tight' ? 'neutral' : 'neg'} />
      </div>

      {/* One recommended action. */}
      <div style={recBox(recommendation.tone)}>
        <div style={recKicker}>RECOMMENDED</div>
        <div style={recText}>{recommendation.text}</div>
      </div>

      {/* Advanced disclosure. */}
      <button
        onClick={(): void => setShowAdvanced((v) => !v)}
        style={advancedToggle(showAdvanced)}
      >
        {showAdvanced ? '▾ Hide advanced' : '▸ Strategy, cabin, close route'}
      </button>

      {showAdvanced && !isCargo && (
        <div style={advancedBlock}>
          <div style={pricingRow}>
            {PRICING_MODES.map((m) => (
              <button key={m.id}
                onClick={(): void => {
                  const res = setPricing(route.id, m.id);
                  setError(res.ok ? null : res.message);
                }}
                style={{ ...pricingBtn, ...(route.pricing === m.id ? pricingActive : {}) }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <PricingConsequenceStrip mode={route.pricing} hubLevel={hubLvl} />
          <RouteAdvancedMenu
            onClose={(): void => {
              const res = closeRoute(route.id);
              setError(res.ok ? null : res.message);
            }}
          />
        </div>
      )}
      {showAdvanced && isCargo && (
        <div style={advancedBlock}>
          <div style={pricingTagline}>Cargo lanes always ship full at fixed yield — no pricing toggle.</div>
          <RouteAdvancedMenu
            onClose={(): void => {
              const res = closeRoute(route.id);
              setError(res.ok ? null : res.message);
            }}
          />
        </div>
      )}
      {error && <div style={errorText}>{error}</div>}
    </li>
  );
}

interface RecomCtx {
  route: Route;
  aircraft: { condition: number; upgrades: { engine: number; cabin: number; fuelEff: number; marketing: number } };
  def: { rangeKm: number; capacity: number };
  capacity: 'Open' | 'Tight' | 'Limited';
  aircraftFit: 'Excellent' | 'Good' | 'Stretched';
  conditionBand: 'normal' | 'degraded' | 'critical';
  hubLevel: number;
}
function computeRecommendation(ctx: RecomCtx): { text: string; tone: 'pos' | 'neutral' | 'warn' } {
  if (ctx.conditionBand === 'critical') {
    return { text: 'Service aircraft urgently — open Hangar → Maintenance Bay', tone: 'warn' };
  }
  if (ctx.conditionBand === 'degraded') {
    return { text: 'Run a Quick Service — restores condition without grounding', tone: 'warn' };
  }
  if (ctx.aircraftFit === 'Stretched') {
    return { text: 'Assign a longer-range aircraft — current is near max range', tone: 'warn' };
  }
  if (ctx.capacity === 'Limited') {
    return { text: 'Upgrade Cabin or swap to a wide-body — leaving demand on the table', tone: 'neutral' };
  }
  if (ctx.route.pricing !== 'premium' && ctx.hubLevel >= 1 && ctx.capacity === 'Open') {
    return { text: 'Try Premium pricing — lounge ready and load is open', tone: 'pos' };
  }
  if (ctx.aircraft.upgrades.marketing < 3) {
    return { text: 'Upgrade Marketing — lifts load factor without buying a new plane', tone: 'pos' };
  }
  return { text: 'Healthy lane — keep the cash flowing', tone: 'pos' };
}

function HealthChip({ label, value, tone }: { label: string; value: string; tone: 'pos' | 'neutral' | 'neg' }) {
  const color = tone === 'pos' ? '#34D399' : tone === 'neg' ? '#F87171' : '#94A3B8';
  return (
    <div style={{
      ...healthChip,
      borderColor: tone === 'pos' ? 'rgba(52,211,153,0.4)' : tone === 'neg' ? 'rgba(248,113,113,0.4)' : 'rgba(148,163,184,0.3)',
    }}>
      <div style={healthChipLabel}>{label}</div>
      <div style={{ ...healthChipValue, color }}>{value}</div>
    </div>
  );
}

function hubLevelFor(route: Route, hubs: readonly { iata: string; level: number }[]): number {
  for (const h of hubs) if (h.iata === route.originIata || h.iata === route.destIata) return h.level;
  return 0;
}

function PricingConsequenceStrip({ mode, hubLevel }: { mode: 'economy' | 'balanced' | 'premium'; hubLevel: number }) {
  const m = PRICING_MODES.find((x) => x.id === mode);
  if (!m) return null;
  const warn = m.warn?.({ hubLevel });
  // Design Review v6 — point 16. Wrap the cabin + chip block with a
  // key change so a strategy switch triggers a snap-animation: the
  // new cabin fades in, chips re-slide. The player sees the forecast
  // change, not just static numbers swapping.
  return (
    <div>
      <div style={pricingTagline}>{m.tagline}</div>
      <motion.div
        key={`forecast-${mode}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
      >
        <CabinPreview mode={mode} />
        <div style={consequenceRow}>
          {m.chips.map((c, i) => (
            <motion.span
              key={c.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.04 * i + 0.08, type: 'spring', stiffness: 360, damping: 22 }}
              style={{
                ...conseqChip,
                color: c.tone === 'pos' ? '#34D399' : c.tone === 'neg' ? '#F87171' : '#94A3B8',
                borderColor: c.tone === 'pos' ? 'rgba(52,211,153,0.4)'
                  : c.tone === 'neg' ? 'rgba(248,113,113,0.4)'
                  : 'rgba(148,163,184,0.3)',
              } as Record<string, unknown>}
            >
              {c.label}
            </motion.span>
          ))}
        </div>
        <div style={paxStrip}>{m.pax}</div>
        {warn && <div style={paxWarn}>⚠ {warn}</div>}
      </motion.div>
    </div>
  );
}

/**
 * Tiny SVG side-view of the cabin cross-section. Economy = dense rows
 * of blue dots filling the cabin; Balanced = mixed economy + business;
 * Premium = sparse rows with big gold + white VIP dots.
 */
function CabinPreview({ mode }: { mode: 'economy' | 'balanced' | 'premium' }) {
  const seats: Array<{ x: number; y: number; color: string; size: number }> = [];
  if (mode === 'economy') {
    // Dense 4-row layout.
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 12; col++) {
        seats.push({ x: 14 + col * 12, y: 8 + row * 6, color: '#5AC8FA', size: 1.6 });
      }
    }
  } else if (mode === 'balanced') {
    // Two rows business up front, two rows economy behind.
    for (let col = 0; col < 6; col++) {
      seats.push({ x: 14 + col * 14, y: 8, color: '#F4C75B', size: 2 });
      seats.push({ x: 14 + col * 14, y: 16, color: '#F4C75B', size: 2 });
    }
    for (let col = 0; col < 12; col++) {
      seats.push({ x: 100 + col * 8, y: 8, color: '#5AC8FA', size: 1.4 });
      seats.push({ x: 100 + col * 8, y: 14, color: '#5AC8FA', size: 1.4 });
      seats.push({ x: 100 + col * 8, y: 20, color: '#5AC8FA', size: 1.4 });
      seats.push({ x: 100 + col * 8, y: 26, color: '#5AC8FA', size: 1.4 });
    }
  } else {
    // Premium: sparse pods with VIP and business dots.
    for (let col = 0; col < 4; col++) {
      seats.push({ x: 18 + col * 22, y: 10, color: '#F8FAFC', size: 2.5 });
      seats.push({ x: 18 + col * 22, y: 22, color: '#F8FAFC', size: 2.5 });
    }
    for (let col = 0; col < 6; col++) {
      seats.push({ x: 120 + col * 14, y: 10, color: '#F4C75B', size: 2 });
      seats.push({ x: 120 + col * 14, y: 22, color: '#F4C75B', size: 2 });
    }
  }
  return (
    <div style={cabinWrap}>
      <div style={cabinKicker}>CABIN MIX</div>
      <svg width="100%" height="36" viewBox="0 0 220 36" preserveAspectRatio="xMidYMid meet">
        {/* Fuselage outline */}
        <path d="M 6 18 Q 12 4 30 4 L 200 4 Q 214 6 218 18 Q 214 30 200 32 L 30 32 Q 12 32 6 18 Z"
          fill="rgba(11,17,32,0.6)" stroke="rgba(148,163,184,0.4)" strokeWidth="0.8" />
        {/* Cockpit window */}
        <path d="M 7 14 L 14 10 L 16 14 Z" fill="rgba(148,163,184,0.5)" />
        {/* Seats */}
        {seats.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.size}
            fill={s.color}
            opacity="0.92"
            style={{ filter: `drop-shadow(0 0 ${s.size * 0.8}px ${s.color}88)` }} />
        ))}
      </svg>
    </div>
  );
}

function RouteAdvancedMenu({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, position: 'relative' }}>
      <button
        onClick={(): void => { setOpen((v) => !v); setConfirm(false); }}
        style={dotsBtn}
        aria-label="Route options"
        aria-expanded={open}
      >
        ⋯ Advanced
      </button>
      {open && (
        <div style={menuPop}>
          {!confirm ? (
            <button onClick={(): void => setConfirm(true)} style={menuItemDanger}>
              Close route
            </button>
          ) : (
            <div style={confirmBox}>
              <div style={confirmText}>
                Closing frees the aircraft and stops income from this lane.
              </div>
              <div style={confirmRow}>
                <button onClick={(): void => { setOpen(false); setConfirm(false); }} style={confirmCancel}>Keep</button>
                <button onClick={(): void => { setOpen(false); setConfirm(false); onClose(); }} style={confirmDanger}>Confirm close</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──── Hubs tab ────────────────────────────────────────────────────────
function HubsList() {
  const cash = useGameStore(selectCash);
  const hubs = useGameStore(selectHubs);
  const unlocked = useGameStore(selectUnlockedRegions);
  const pickHub = useGameStore((s) => s.pickHub);
  const upgrade = useGameStore((s) => s.upgradeHub);
  const state = useGameStore((s) => s.state);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const airports = useMemo(() => loadTopAirports(), []);

  return (
    <div>
      {hubs.length === 0 ? (
        <div style={empty}>
          You don't have any hubs yet. Pick your home airport from the prompt above,
          or unlock a region and choose a hub there.
        </div>
      ) : (
        <>
          <div style={hubsHeader}>
            <h3 style={sectionTitle}>Active hubs ({hubs.length})</h3>
            <button onClick={(): void => setShowAdd(true)} style={addHubBtn}>+ Add hub</button>
          </div>
          <ul style={list}>
            {hubs.map((h) => {
              const upCost = hubUpgradeCost(h.iata, h.level);
              const atMax = h.level >= MAX_HUB_LEVEL;
              return (
                <li key={h.iata} style={card}>
                  <div style={cardHeader}>
                    <div>
                      <div style={cardTitle}>{h.iata}</div>
                      <div style={cardSubtitle}>
                        Lv {h.level} · +{(h.level * 5).toFixed(0)}% network bonus · {routesAtAirport(state!, h.iata)} routes
                      </div>
                    </div>
                    <div style={costText}>{atMax ? '—' : `$${formatCash(upCost, 1)}`}</div>
                  </div>
                  <button
                    disabled={atMax || cash < upCost}
                    onClick={(): void => {
                      const res = upgrade(h.iata);
                      setError(res.ok ? null : res.message);
                    }}
                    style={{ ...primaryBtn, opacity: atMax || cash < upCost ? 0.5 : 1 }}
                  >
                    {atMax ? 'Maxed' : 'Upgrade hub'}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {error && <div style={errorText}>{error}</div>}
      {showAdd && (
        <AddHubModal
          airports={airports}
          unlocked={unlocked}
          existingHubIatas={new Set(hubs.map((h) => h.iata))}
          onClose={(): void => setShowAdd(false)}
          onPick={(iata): void => {
            const res = pickHub(iata);
            if (res.ok) setShowAdd(false);
            else setError(res.message);
          }}
        />
      )}
    </div>
  );
}

function AddHubModal({
  airports, unlocked, existingHubIatas, onClose, onPick,
}: {
  airports: readonly Airport[];
  unlocked: readonly number[];
  existingHubIatas: ReadonlySet<string>;
  onClose: () => void;
  onPick: (iata: string) => void;
}) {
  const state = useGameStore((s) => s.state);
  const cash = useGameStore(selectCash);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleCountry = (iso: string): void => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(iso)) next.delete(iso); else next.add(iso);
      return next;
    });
  };
  const groupedByCountry = useMemo(() => {
    const filtered = airports.filter((a) =>
      unlocked.includes(a.region)
      && a.sizeTier === 4
      && a.intl
      && !existingHubIatas.has(a.iata),
    );
    const groups = new Map<string, Airport[]>();
    for (const a of filtered) {
      const arr = groups.get(a.country);
      if (arr) arr.push(a); else groups.set(a.country, [a]);
    }
    return [...groups.entries()]
      .map(([iso, arr]) => ({
        iso, label: countryName(iso),
        airports: arr.sort((a, b) => (a.city || '').localeCompare(b.city || '')),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [airports, unlocked, existingHubIatas]);

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalShell} onClick={(e): void => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', color: '#F8FAFC' }}>Add hub</h3>
        <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 0 }}>
          Each new hub lets you originate routes from that airport.
          The first hub in any region is free; extras cost a one-time
          fee based on the airport's size tier.
        </p>
        <div style={addHubScroller}>
          {groupedByCountry.map((group) => {
            const open = expanded.has(group.iso);
            return (
              <section key={group.iso} style={addHubCountry}>
                <button
                  onClick={(): void => toggleCountry(group.iso)}
                  style={addHubCountryHeaderBtn}
                  aria-expanded={open}
                >
                  <span>{group.label}</span>
                  <span style={addHubCountryChev}>{open ? '▾' : '▸'} {group.airports.length}</span>
                </button>
                {open && (
                  <ul style={list}>
                    {group.airports.map((a) => {
                      const cost = state ? hubPickCost(state, a.iata) : 0;
                      const afford = cash >= cost;
                      return (
                        <li key={a.iata} style={card}>
                          <div style={cardHeader}>
                            <div>
                              <div style={cardTitle}>{a.iata}</div>
                              <div style={cardSubtitle}>{a.city || group.label}</div>
                            </div>
                            <div style={addHubRight}>
                              {cost === 0
                                ? <span style={freePill}>Free</span>
                                : <span style={costText}>${formatCash(cost, 1)}</span>}
                              <button
                                disabled={!afford && cost > 0}
                                onClick={(): void => onPick(a.iata)}
                                style={{
                                  ...primaryBtn,
                                  width: 'auto',
                                  padding: '8px 14px',
                                  minHeight: 36,
                                  marginTop: 6,
                                  opacity: afford || cost === 0 ? 1 : 0.5,
                                }}
                              >
                                Pick
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <button onClick={onClose} style={cancelBtn}>Close</button>
      </div>
    </div>
  );
}

// ──── Regions tab ─────────────────────────────────────────────────────
function RegionsList() {
  const cash = useGameStore(selectCash);
  const unlocked = useGameStore(selectUnlockedRegions);
  const unlock = useGameStore((s) => s.unlockRegion);
  const [error, setError] = useState<string | null>(null);
  return (
    <ul style={list}>
      {REGIONS.map((r) => {
        const open = unlocked.includes(r.id);
        const afford = cash >= r.unlockCost;
        return (
          <li key={r.id} style={card}>
            <div style={cardHeader}>
              <div>
                <div style={cardTitle}>{r.name}</div>
                <div style={cardSubtitle}>Region {r.id}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {open
                  ? <span style={signedPill}>Unlocked</span>
                  : <span style={costText}>${formatCash(r.unlockCost, 1)}</span>}
              </div>
            </div>
            {!open && (
              <button
                disabled={!afford}
                onClick={(): void => {
                  const res = unlock(r.id);
                  setError(res.ok ? null : res.message);
                }}
                style={{ ...primaryBtn, opacity: afford ? 1 : 0.5 }}
              >
                Unlock {r.name}
              </button>
            )}
          </li>
        );
      })}
      {error && <div style={errorText}>{error}</div>}
    </ul>
  );
}

// ──── New-route modal ────────────────────────────────────────────────
function NewRouteModal({ onClose }: { onClose: () => void }) {
  const fleet = useGameStore(selectFleet);
  const cash = useGameStore(selectCash);
  const unlocked = useGameStore(selectUnlockedRegions);
  const hubs = useGameStore(selectHubs);
  const openRoute = useGameStore((s) => s.openRoute);
  const airports = useMemo(() => loadTopAirports(), []);
  const unlockedAirports = useMemo(
    () => airports.filter((a) => unlocked.includes(a.region)),
    [airports, unlocked],
  );

  const idleAircraft = fleet.filter((a) => a.routeId === null);
  const [acUid, setAcUid] = useState<string>(idleAircraft[0]?.uid ?? '');
  const selectedAc = idleAircraft.find((a) => a.uid === acUid);
  const def = selectedAc ? getAircraftDef(selectedAc.defId) : undefined;
  const [originIata, setOriginIata] = useState<string>(hubs[0]?.iata ?? '');
  const [destIata, setDestIata] = useState<string>('');
  const [destExpanded, setDestExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const toggleDestCountry = (iso: string): void => {
    setDestExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(iso)) next.delete(iso); else next.add(iso);
      return next;
    });
  };

  // Origin is restricted to the player's hubs — routes have to start
  // somewhere they actually operate from (Phase 10 hub rework).
  const originAirports = useMemo(() => {
    const result: Airport[] = [];
    for (const h of hubs) {
      const a = airports.find((x) => x.iata === h.iata);
      if (a) result.push(a);
    }
    return sortAirports(result);
  }, [hubs, airports]);

  const destAirports = useMemo(() => {
    if (!def) return [];
    const origin = unlockedAirports.find((a) => a.iata === originIata);
    if (!origin) return [];
    return sortAirports(
      unlockedAirports.filter((a) => {
        if (a.iata === originIata) return false;
        if (!a.intl) return false;
        const d = haversineKm(origin.lat, origin.lon, a.lat, a.lon);
        return d <= def.rangeKm && d >= 100;
      }),
    );
  }, [unlockedAirports, originIata, def]);

  // Group destinations by country (ISO → friendly name) so the picker
  // is navigable even with hundreds of airports per region.
  const destGroupedByCountry = useMemo(() => {
    const groups = new Map<string, Airport[]>();
    for (const a of destAirports) {
      const key = a.country || '??';
      const arr = groups.get(key);
      if (arr) arr.push(a); else groups.set(key, [a]);
    }
    const out: { iso: string; label: string; airports: Airport[] }[] = [];
    for (const [iso, arr] of groups) {
      out.push({ iso, label: countryName(iso), airports: arr });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [destAirports]);

  const distance = useMemo(() => {
    const o = airports.find((a) => a.iata === originIata);
    const d = airports.find((a) => a.iata === destIata);
    if (!o || !d) return 0;
    return haversineKm(o.lat, o.lon, d.lat, d.lon);
  }, [airports, originIata, destIata]);

  // Design Review v3 — point 9. Surface the 6 nearest reachable
  // destinations as quick-pick chips so the player doesn't have to drill
  // through country accordions for a regional hop.
  const quickDestinations = useMemo(() => {
    return destAirports.slice(0, 6);
  }, [destAirports]);
  const cost = distance > 0 ? routeOpenCost(distance) : 0;
  const canOpen = !!(selectedAc && originIata && destIata && originIata !== destIata && cost > 0 && cash >= cost);

  // Estimated revenue per minute at the current state — uses the same
  // formulas as the live engine so the player sees a realistic number.
  const estimatedPerMin = useMemo(() => {
    if (!selectedAc || !originIata || !destIata || distance <= 0) return 0;
    const baseLoad = 0.55 + 0.03 * selectedAc.upgrades.marketing;
    const estRoute = {
      id: 'est',
      originIata,
      destIata,
      distanceKm: distance,
      aircraftUid: selectedAc.uid,
      pricing: 'balanced' as const,
      loadFactor: Math.min(0.98, baseLoad),
      legProgress: 0,
      legDirection: 'outbound' as const,
    };
    return cashPerSecond(estRoute, selectedAc, hubs) * 60;
  }, [selectedAc, originIata, destIata, distance, hubs]);

  // Route Authorization screen — Design Review v6 point 17. After
  // tapping Authorize Route, show a brief signature-stamp animation
  // before actually opening the route. Lands a "ROUTE AUTHORIZED"
  // stamp over the preview card, then dismisses.
  const [authorizing, setAuthorizing] = useState(false);
  const onConfirm = (): void => {
    if (!selectedAc) return;
    if (authorizing) return;
    setAuthorizing(true);
    haptics.medium();
    window.setTimeout(() => {
      const res = openRoute(originIata, destIata, selectedAc.uid);
      if (res.ok) { haptics.heavy(); onClose(); }
      else { haptics.warning(); setError(res.message); setAuthorizing(false); }
    }, 950);
  };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalShell} onClick={(e): void => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px', color: '#F8FAFC' }}>New route</h3>
        {idleAircraft.length === 0 ? (
          <div style={empty}>No idle aircraft. Buy or close an existing route first.</div>
        ) : (
          <>
            <label style={formLabel}>Aircraft</label>
            <select value={acUid} onChange={(e): void => setAcUid(e.target.value)} style={selectStyle}>
              {idleAircraft.map((a) => {
                const ad = getAircraftDef(a.defId);
                return (
                  <option key={a.uid} value={a.uid}>
                    {ad?.displayName ?? '?'} · {a.condition.toFixed(0)}% cond · range {ad?.rangeKm.toLocaleString()} km
                  </option>
                );
              })}
            </select>

            <label style={formLabel}>Origin (hub)</label>
            {hubs.length === 0 ? (
              <div style={empty}>No hubs yet. Add one from Network → Hubs.</div>
            ) : (
              <select
                {...(!originIata ? { 'data-tutorial': 'routes-origin-select' } : {})}
                value={originIata}
                onChange={(e): void => { setOriginIata(e.target.value); setDestIata(''); }}
                style={selectStyle}
              >
                <option value="">— pick a hub —</option>
                {originAirports.map((a) => (
                  <option key={a.iata} value={a.iata}>
                    {a.iata} · {a.city || a.country} ({countryName(a.country)})
                  </option>
                ))}
              </select>
            )}

            <label style={formLabel}>Destination</label>
            {/* Design Review v3 — point 9. Quick-pick reachable
                destinations as chips. The country accordion below stays
                as a secondary filter. */}
            {originIata && quickDestinations.length > 0 && (
              <div style={quickDestRow}>
                <div style={quickDestKicker}>NEAREST · TAP TO PICK</div>
                <div style={quickDestChipsRow}>
                  {quickDestinations.map((a) => (
                    <button
                      key={a.iata}
                      onClick={(): void => { setDestIata(a.iata); setDestExpanded(new Set()); }}
                      style={{
                        ...quickDestChip,
                        ...(destIata === a.iata ? quickDestChipActive : {}),
                      }}
                    >
                      <span style={quickDestChipIata}>{a.iata}</span>
                      <span style={quickDestChipCity}>{a.city || countryName(a.country)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!originIata ? (
              <div style={empty}>Pick an origin hub first.</div>
            ) : (() => {
              const destAirport = destIata
                ? destAirports.find((a) => a.iata === destIata) ?? null
                : null;
              return (
                <div
                  {...(!destIata ? { 'data-tutorial': 'routes-dest-select' } : {})}
                  style={destAccordion}
                >
                  <div style={destCurrentRow}>
                    {destAirport
                      ? (
                        <span style={destCurrentText}>
                          <b>{destAirport.iata}</b> · {destAirport.city || countryName(destAirport.country)}
                        </span>
                      )
                      : <span style={destCurrentPlaceholder}>— pick a country / airport —</span>}
                    {destIata && (
                      <button
                        onClick={(): void => setDestIata('')}
                        style={destClearBtn}
                        aria-label="Clear destination"
                      >
                        clear
                      </button>
                    )}
                  </div>
                  {/* Once a destination is picked the country list
                      collapses so the player can see the route summary
                      and confirm button. Tap "clear" to pick again. */}
                  {!destIata && (
                    <div style={destScroller}>
                      {destGroupedByCountry.length === 0 ? (
                        <div style={empty}>No reachable destinations in range.</div>
                      ) : destGroupedByCountry.map((group) => {
                        const open = destExpanded.has(group.iso);
                        return (
                          <section key={group.iso} style={addHubCountry}>
                            <button
                              onClick={(): void => toggleDestCountry(group.iso)}
                              style={addHubCountryHeaderBtn}
                              aria-expanded={open}
                            >
                              <span>{group.label}</span>
                              <span style={addHubCountryChev}>{open ? '▾' : '▸'} {group.airports.length}</span>
                            </button>
                            {open && (
                              <ul style={list}>
                                {group.airports.map((a) => {
                                  return (
                                    <li key={a.iata} style={destListItem}>
                                      <button
                                        onClick={(): void => {
                                          setDestIata(a.iata);
                                          // Collapse all countries — the
                                          // selected airport now stands
                                          // alone in the header above.
                                          setDestExpanded(new Set());
                                        }}
                                        style={destItemBtn}
                                      >
                                        <div style={destItemLeft}>
                                          <div style={destItemIata}>{a.iata}</div>
                                          <div style={destItemCity}>{a.city || group.label}</div>
                                        </div>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Route Preview Card — Design Review v3, point 9. */}
            {distance > 0 && def && (
              <div style={routePreview}>
                <div style={routePreviewKicker}>ROUTE PREVIEW</div>
                <div style={routePreviewTitle}>
                  {originIata}  →  {destIata}
                </div>
                <div style={routePreviewGrid}>
                  <Preview label="Distance" value={`${Math.round(distance).toLocaleString()} km`} />
                  <Preview label="Cycle" value={`~${Math.round(distance / def.cruiseSpeedKmh * 3.6)} s`} />
                  <Preview label="Aircraft" value={def.displayName} />
                  <Preview label="Est. revenue" value={`$${formatCash(estimatedPerMin, 1)}/min`} accent="#34D399" />
                  <Preview label="Opening fee" value={`$${formatCash(cost)}`} accent="#F4C75B" />
                  <Preview label="Demand" value="Stable" accent="#5AC8FA" />
                </div>
                <div style={routePreviewFoot}>
                  Risk: <b style={{ color: distance > def.rangeKm * 0.9 ? '#F59E0B' : '#34D399' }}>
                    {distance > def.rangeKm * 0.9 ? 'near max range' : 'low'}
                  </b>
                  {' · Best aircraft for this leg: '}
                  <b>{def.rangeKm >= distance ? def.displayName : 'longer-range aircraft'}</b>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={onClose} style={cancelBtn}>Cancel</button>
              <button
                onClick={onConfirm}
                disabled={!canOpen}
                {...(canOpen ? { 'data-tutorial': 'routes-confirm-button' } : {})}
                style={{ ...confirmBtn, opacity: canOpen ? 1 : 0.4 }}
              >
                Authorize Route ✓
              </button>
            </div>
            {error && <div style={errorText}>{error}</div>}
          </>
        )}
        {/* Authorization stamp overlay — Design Review v6 point 17.
            Briefly covers the modal with a "ROUTE AUTHORIZED" stamp
            that lands with a spring + flash. */}
        {authorizing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={authOverlay as Record<string, unknown>}
          >
            <motion.div
              initial={{ scale: 1.8, rotate: -22, opacity: 0 }}
              animate={{ scale: 1, rotate: -12, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 14 }}
              style={authStamp as Record<string, unknown>}
            >
              <div style={authStampTitle}>ROUTE AUTHORIZED</div>
              <div style={authStampSub}>{originIata} → {destIata}</div>
              <div style={authStampSig}>Signed · SkyHaven Authority</div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function sortAirports(arr: Airport[]): Airport[] {
  return arr.sort((a, b) =>
    b.sizeTier - a.sizeTier
    || a.country.localeCompare(b.country)
    || a.city.localeCompare(b.city),
  );
}

function Preview({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={previewCell}>
      <div style={previewCellLabel}>{label}</div>
      <div style={{ ...previewCellValue, color: accent ?? '#F8FAFC' }}>{value}</div>
    </div>
  );
}


// ───────────────────────────────────────────────────────────────────────
const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const tabBtn: React.CSSProperties = {
  background: 'transparent', color: '#94A3B8', border: 0, padding: '6px 10px', borderRadius: 6,
  cursor: 'pointer', fontSize: 12, minHeight: 32, fontFamily: 'inherit',
};
const tabActive: React.CSSProperties = { background: 'rgba(90,200,250,0.18)', color: '#5AC8FA' };

/** Pricing-mode catalogue (Design Review v3 — point 10). Each mode now
 *  exposes concrete deltas: load, revenue/passenger, reputation, fuel.
 *  The UI renders these as small chips so the strategic consequence is
 *  visible at a glance rather than buried in prose. */
interface PricingMode {
  readonly id: 'economy' | 'balanced' | 'premium';
  readonly label: string;
  readonly tagline: string;
  readonly chips: readonly { label: string; tone: 'pos' | 'neg' | 'neutral' }[];
  readonly pax: string;
  readonly warn?: (ctx: { hubLevel: number }) => string | null;
}
const PRICING_MODES: readonly PricingMode[] = [
  { id: 'economy', label: 'Economy',
    tagline: 'Pack the cabin, move the volume.',
    chips: [
      { label: 'Load +20%', tone: 'pos' },
      { label: 'Rev/pax −15%', tone: 'neg' },
      { label: 'Reputation +2', tone: 'pos' },
      { label: 'Fuel pressure +0', tone: 'neutral' },
    ],
    pax: '••••• economy',
  },
  { id: 'balanced', label: 'Balanced',
    tagline: 'Steady demand, steady margin.',
    chips: [
      { label: 'Load +0%', tone: 'neutral' },
      { label: 'Rev/pax +0%', tone: 'neutral' },
      { label: 'Reputation +0', tone: 'neutral' },
      { label: 'Fuel pressure +0', tone: 'neutral' },
    ],
    pax: '••• economy · •• business',
  },
  { id: 'premium', label: 'Premium',
    tagline: 'Fewer seats sold, but each one pays.',
    chips: [
      { label: 'Load −25%', tone: 'neg' },
      { label: 'Rev/pax +60%', tone: 'pos' },
      { label: 'Reputation +5', tone: 'pos' },
      { label: 'Fuel pressure −10%', tone: 'pos' },
    ],
    pax: '★ ★ ★ premium · business',
    warn: ({ hubLevel }) => hubLevel < 1 ? 'Premium yield capped — build a Lounge to unlock full uplift.' : null,
  },
];
// Cabin preview (Design Review v4 — point 11)
const cabinWrap: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 4,
  background: 'rgba(11,17,32,0.45)',
  border: '1px solid rgba(148,163,184,0.18)',
  borderRadius: 8,
  padding: '6px 10px 4px',
};
const cabinKicker: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.2em',
  color: '#94A3B8',
  marginBottom: 2,
};

const pricingTagline: React.CSSProperties = {
  fontSize: 11,
  color: '#CBD5E1',
  marginTop: 8,
  fontStyle: 'italic',
};
const consequenceRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 6,
};
const conseqChip: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.04em',
  padding: '3px 7px',
  borderRadius: 999,
  border: '1px solid',
  background: 'rgba(11,17,32,0.55)',
  fontFeatureSettings: '"tnum" 1',
};
const paxStrip: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  letterSpacing: '0.12em',
  color: '#94A3B8',
};
const paxWarn: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: '#F4C75B',
  background: 'rgba(244,199,91,0.08)',
  border: '1px solid rgba(244,199,91,0.3)',
  borderRadius: 6,
  padding: '6px 8px',
};
const dotsBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(148,163,184,0.25)',
  color: '#94A3B8',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.06em',
};
const menuPop: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  bottom: 'calc(100% + 4px)',
  background: '#0B1426',
  border: '1px solid rgba(148,163,184,0.25)',
  borderRadius: 8,
  padding: 4,
  minWidth: 200,
  boxShadow: '0 10px 24px rgba(0,0,0,0.5)',
  zIndex: 5,
};
const menuItemDanger: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 0,
  color: '#F87171',
  textAlign: 'left',
  padding: '8px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 6,
};
const confirmBox: React.CSSProperties = {
  padding: 8,
};
const confirmText: React.CSSProperties = {
  fontSize: 11,
  color: '#CBD5E1',
  lineHeight: 1.45,
  marginBottom: 8,
};
const confirmRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 6,
};
const confirmCancel: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(148,163,184,0.3)',
  color: '#94A3B8',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const confirmDanger: React.CSSProperties = {
  background: '#F87171',
  color: '#0B1120',
  border: 0,
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const body: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 12 };
const list: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 };
const sectionTitle: React.CSSProperties = {
  fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
  color: '#94A3B8', margin: '16px 4px 8px',
};
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12,
  border: '1px solid rgba(255,255,255,0.06)',
};
const cardHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 };
const cardTitle: React.CSSProperties = { color: '#F8FAFC', fontSize: 15, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 };
const cardSubtitle: React.CSSProperties = { color: '#94A3B8', fontSize: 11, marginTop: 2 };
const rateText: React.CSSProperties = { color: '#34D399', fontSize: 14, fontWeight: 700, fontFeatureSettings: '"tnum" 1' };
const pricingRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 10 };
const pricingBtn: React.CSSProperties = {
  background: 'rgba(11,17,32,0.6)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#94A3B8', padding: '8px', borderRadius: 6, cursor: 'pointer',
  fontSize: 12, fontFamily: 'inherit', minHeight: 36,
};
const pricingActive: React.CSSProperties = {
  background: 'rgba(90,200,250,0.18)', color: '#5AC8FA',
  borderColor: 'rgba(90,200,250,0.5)',
};
const primaryBtn: React.CSSProperties = {
  width: '100%', marginTop: 10, padding: 10, borderRadius: 8,
  background: '#5AC8FA', color: '#0B1120', border: 0, fontWeight: 700,
  cursor: 'pointer', minHeight: 40, fontFamily: 'inherit',
};

// Quick destination chips (Design Review v3 — point 9)
const quickDestRow: React.CSSProperties = {
  margin: '4px 0 10px',
};
const quickDestKicker: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.18em',
  color: '#94A3B8', marginBottom: 6,
};
const quickDestChipsRow: React.CSSProperties = {
  display: 'flex', gap: 6, flexWrap: 'wrap',
};
const quickDestChip: React.CSSProperties = {
  background: 'rgba(11,17,32,0.55)',
  border: '1px solid rgba(148,163,184,0.3)',
  borderRadius: 999,
  padding: '6px 12px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#CBD5E1',
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 6,
};
const quickDestChipActive: React.CSSProperties = {
  background: 'rgba(90,200,250,0.18)',
  borderColor: '#5AC8FA',
  color: '#5AC8FA',
  boxShadow: '0 0 12px rgba(90,200,250,0.4)',
};
const quickDestChipIata: React.CSSProperties = {
  fontWeight: 800, fontSize: 12, letterSpacing: '0.02em',
};
const quickDestChipCity: React.CSSProperties = {
  fontSize: 11, color: 'inherit', opacity: 0.85,
};

// Route Preview Card (Design Review v3 — point 9)
const routePreview: React.CSSProperties = {
  marginTop: 14,
  padding: '14px 14px 12px',
  borderRadius: 12,
  background: 'linear-gradient(150deg, rgba(11,17,32,0.85), rgba(15,23,42,0.85))',
  border: '1px solid rgba(90,200,250,0.35)',
  boxShadow: '0 0 18px rgba(90,200,250,0.18)',
};
const routePreviewKicker: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
  color: '#5AC8FA',
};
const routePreviewTitle: React.CSSProperties = {
  fontSize: 22, fontWeight: 900, color: '#F8FAFC',
  letterSpacing: '0.04em',
  marginTop: 4,
  fontFeatureSettings: '"tnum" 1',
};
const routePreviewGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 6,
  marginTop: 10,
};
const previewCell: React.CSSProperties = {
  background: 'rgba(11,17,32,0.55)',
  border: '1px solid rgba(148,163,184,0.18)',
  borderRadius: 8,
  padding: '8px 10px',
};
const previewCellLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.18em',
  color: '#64748B',
};
const previewCellValue: React.CSSProperties = {
  fontSize: 13, fontWeight: 800, marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};
const routePreviewFoot: React.CSSProperties = {
  marginTop: 10,
  fontSize: 11,
  color: '#94A3B8',
  lineHeight: 1.5,
};
// Route Health styles (Design Review v5 — point 17)
const inauguralBadge: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.16em', fontWeight: 800,
  color: '#0B1120',
  background: 'linear-gradient(135deg, #F4C75B, #FCE9A5)',
  padding: '2px 7px', borderRadius: 4,
  marginLeft: 6,
  boxShadow: '0 0 8px rgba(244,199,91,0.55)',
};
const healthRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 6,
  marginTop: 10,
};
const healthChip: React.CSSProperties = {
  background: 'rgba(11,17,32,0.55)',
  border: '1px solid',
  borderRadius: 8,
  padding: '6px 8px',
  textAlign: 'center',
};
const healthChipLabel: React.CSSProperties = {
  fontSize: 8, letterSpacing: '0.18em',
  color: '#64748B', fontWeight: 800,
  textTransform: 'uppercase',
};
const healthChipValue: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, marginTop: 1,
};
const recBox = (tone: 'pos' | 'neutral' | 'warn'): React.CSSProperties => {
  const accent = tone === 'pos' ? '#34D399' : tone === 'warn' ? '#F4C75B' : '#5AC8FA';
  return {
    marginTop: 8,
    background: `linear-gradient(140deg, ${accent}1c, rgba(11,17,32,0.55))`,
    border: `1px solid ${accent}55`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: 8,
    padding: '8px 10px',
  };
};
const recKicker: React.CSSProperties = {
  fontSize: 8, fontWeight: 800, letterSpacing: '0.22em',
  color: '#94A3B8',
};
const recText: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, marginTop: 2,
  color: '#F8FAFC', lineHeight: 1.4,
};
const advancedToggle = (open: boolean): React.CSSProperties => ({
  marginTop: 8,
  width: '100%',
  background: 'transparent',
  border: '1px dashed rgba(148,163,184,0.3)',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  color: open ? '#5AC8FA' : '#94A3B8',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textAlign: 'left',
});
const advancedBlock: React.CSSProperties = {
  marginTop: 8,
  paddingTop: 8,
  borderTop: '1px solid rgba(148,163,184,0.1)',
};
const hubBadge: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.1em', fontWeight: 700,
  color: '#F4C75B', background: 'rgba(244,199,91,0.14)',
  border: '1px solid rgba(244,199,91,0.4)',
  padding: '2px 6px', borderRadius: 4,
};
const cargoBadge: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.1em', fontWeight: 700,
  color: '#8B5CF6', background: 'rgba(139,92,246,0.14)',
  border: '1px solid rgba(139,92,246,0.4)',
  padding: '2px 6px', borderRadius: 4,
};
const signedPill: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#34D399', background: 'rgba(52,211,153,0.12)',
  padding: '3px 8px', borderRadius: 4,
};
const costText: React.CSSProperties = { color: '#F4C75B', fontWeight: 700, fontFeatureSettings: '"tnum" 1' };
const empty: React.CSSProperties = { padding: 32, textAlign: 'center', color: '#94A3B8' };
const modalBackdrop: React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'grid', placeItems: 'center', padding: 16, zIndex: 100,
};
const modalShell: React.CSSProperties = {
  position: 'relative',
  background: '#0B1120', borderRadius: 14, padding: 16,
  width: '100%', maxWidth: 420,
  // Fill nearly the entire panel so the destination list, route
  // preview and the Authorize button all stay on-screen without the
  // player having to scroll the modal.
  maxHeight: 'calc(100% - 12px)', overflowY: 'auto',
  border: '1px solid rgba(255,255,255,0.08)',
};
const formLabel: React.CSSProperties = {
  display: 'block', marginTop: 12, marginBottom: 4,
  color: '#94A3B8', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
};
const selectStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC',
  padding: '10px', borderRadius: 8, fontSize: 14, fontFamily: 'inherit',
  minHeight: 44,
};
// Route Authorization stamp overlay (Design Review v6 — point 17)
const authOverlay: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(7,10,24,0.65)',
  borderRadius: 18,
  zIndex: 4,
};
const authStamp: React.CSSProperties = {
  textAlign: 'center',
  padding: '20px 28px',
  background: 'rgba(244,199,91,0.08)',
  border: '4px solid #F4C75B',
  color: '#F4C75B',
  borderRadius: 12,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  boxShadow: '0 18px 36px rgba(0,0,0,0.6), 0 0 32px rgba(244,199,91,0.55)',
};
const authStampTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: '0.14em',
};
const authStampSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.12em',
  color: '#F8FAFC',
};
const authStampSig: React.CSSProperties = {
  marginTop: 8,
  fontSize: 9,
  letterSpacing: '0.18em',
  color: '#CBD5E1',
  fontStyle: 'italic',
  fontFamily: 'serif',
};
const cancelBtn: React.CSSProperties = {
  flex: 1, padding: 12, background: 'transparent', color: '#94A3B8',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
  cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
};
const confirmBtn: React.CSSProperties = {
  flex: 1, padding: 12, background: '#5AC8FA', color: '#0B1120',
  border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700,
  minHeight: 44, fontFamily: 'inherit',
};
const errorText: React.CSSProperties = {
  marginTop: 8, padding: '6px 10px', fontSize: 11, color: '#F87171',
  background: 'rgba(248,113,113,0.08)', borderRadius: 6,
};
const hubsHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  margin: '4px 0 8px',
};
const addHubBtn: React.CSSProperties = {
  background: '#5AC8FA', color: '#0B1120', border: 0,
  padding: '8px 14px', borderRadius: 8, fontWeight: 700,
  cursor: 'pointer', minHeight: 36, fontFamily: 'inherit',
};
const addHubScroller: React.CSSProperties = {
  flex: 1, minHeight: 0, overflowY: 'auto',
  display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10,
};
const addHubCountry: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const addHubCountryHeaderBtn: React.CSSProperties = {
  width: '100%',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
  color: '#5AC8FA', fontWeight: 700,
  padding: '8px 10px',
  background: 'rgba(90,200,250,0.06)',
  border: '1px solid rgba(90,200,250,0.18)',
  borderRadius: 8,
  cursor: 'pointer', fontFamily: 'inherit',
  minHeight: 40,
};
const addHubCountryChev: React.CSSProperties = {
  fontSize: 11, color: '#94A3B8', letterSpacing: '0.02em',
};
const destAccordion: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: 10,
};
const destCurrentRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
};
const destCurrentText: React.CSSProperties = {
  fontSize: 13, color: '#F8FAFC',
};
const destCurrentPlaceholder: React.CSSProperties = {
  fontSize: 12, color: '#94A3B8',
};
const destClearBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(248,113,113,0.45)',
  color: '#F87171', borderRadius: 6, padding: '4px 8px',
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  cursor: 'pointer', fontFamily: 'inherit',
};
const destScroller: React.CSSProperties = {
  // Cap the country list so it scrolls internally instead of pushing
  // the Authorize button below the fold. 30 dvh keeps it sensible on
  // both phones and tablets.
  maxHeight: 'min(220px, 30dvh)', overflowY: 'auto',
  display: 'flex', flexDirection: 'column', gap: 8,
  paddingRight: 4,
};
const destListItem: React.CSSProperties = { margin: 0 };
const destItemBtn: React.CSSProperties = {
  width: '100%',
  background: 'rgba(11,17,32,0.55)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: '8px 12px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  cursor: 'pointer', fontFamily: 'inherit',
  textAlign: 'left', color: '#F8FAFC', minHeight: 44,
};
const destItemLeft: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 };
const destItemIata: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: '#F8FAFC',
};
const destItemCity: React.CSSProperties = { fontSize: 11, color: '#94A3B8' };
const addHubRight: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4,
};
const freePill: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#34D399', background: 'rgba(52,211,153,0.14)',
  border: '1px solid rgba(52,211,153,0.4)',
  padding: '3px 8px', borderRadius: 4, fontWeight: 700,
};
