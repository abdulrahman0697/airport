import { useMemo, useState } from 'react';
import { getAircraftDef } from '../../data/aircraft';
import { loadTopAirports, type Airport } from '../../data/airports';
import { REGIONS } from '../../data/regions';
import { conditionBand } from '../../engine/condition';
import { haversineKm } from '../../engine/distance';
import { cashPerSecond, legDurationMs } from '../../engine/economy';
import { routeOpenCost } from '../../engine/actions';
import {
  hubUpgradeCost,
  MAX_HUB_LEVEL,
  routesAtAirport,
} from '../../engine/hubs';
import type { Route } from '../../engine/types';
import {
  selectCash,
  selectFleet,
  selectHubs,
  selectRoutes,
  selectUnlockedRegions,
  useGameStore,
} from '../../state/store';
import { formatCash, formatRate } from '../format';
import { haptics } from '../juice/haptics';

export function RoutesPanel() {
  const [tab, setTab] = useState<'routes' | 'hubs' | 'regions'>('routes');
  const [showNew, setShowNew] = useState(false);
  const routes = useGameStore(selectRoutes);
  const hubs = useGameStore(selectHubs);

  return (
    <div style={shell}>
      <div style={header}>
        <h2 style={title}>Network</h2>
        <div role="tablist" style={tabs}>
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
        {tab === 'routes' && (
          <button
            data-tutorial="routes-new-button"
            onClick={(): void => setShowNew(true)}
            style={newBtn}
          >
            + New route
          </button>
        )}
      </div>
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
  const setPricing = useGameStore((s) => s.setRoutePricing);
  const closeRoute = useGameStore((s) => s.closeRoute);
  const [error, setError] = useState<string | null>(null);
  if (!aircraft) return null;
  const def = getAircraftDef(aircraft.defId);
  if (!def) return null;

  const cps = cashPerSecond(route, aircraft, hubs);
  const leg = legDurationMs(route, aircraft) / 1000;
  const band = conditionBand(aircraft.condition);
  const condColor = band === 'normal' ? '#34D399' : band === 'degraded' ? '#F59E0B' : '#F87171';
  const touchesHub = hubs.some((h) => h.iata === route.originIata || h.iata === route.destIata);
  const isCargo = def.category === 'cargo';

  return (
    <li style={card}>
      <div style={cardHeader}>
        <div>
          <div style={cardTitle}>
            {route.originIata} ↔ {route.destIata}
            {touchesHub && <span style={hubBadge}>HUB</span>}
            {isCargo && <span style={cargoBadge}>CARGO</span>}
          </div>
          <div style={cardSubtitle}>
            {def.displayName} · {Math.round(route.distanceKm).toLocaleString()} km · leg {leg.toFixed(1)}s
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={rateText}>{formatRate(cps)}</div>
          <div style={{ color: condColor, fontSize: 11, marginTop: 2 }}>
            {aircraft.condition.toFixed(0)}%
            {!isCargo && ` · ${(route.loadFactor * 100).toFixed(0)}% load`}
            {isCargo && ' · full'}
          </div>
        </div>
      </div>

      {!isCargo && (
        <div style={pricingRow}>
          {(['economy', 'balanced', 'premium'] as const).map((p) => (
            <button key={p}
              onClick={(): void => {
                const res = setPricing(route.id, p);
                setError(res.ok ? null : res.message);
              }}
              style={{ ...pricingBtn, ...(route.pricing === p ? pricingActive : {}) }}
            >
              {p[0]!.toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={(): void => {
          const res = closeRoute(route.id);
          setError(res.ok ? null : res.message);
        }}
        style={closeBtn}
      >
        Close route
      </button>
      {error && <div style={errorText}>{error}</div>}
    </li>
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
  const candidates = useMemo(() => {
    return airports
      .filter((a) => unlocked.includes(a.region) && a.sizeTier === 4 && !existingHubIatas.has(a.iata))
      .sort((a, b) => a.country.localeCompare(b.country) || (a.city || '').localeCompare(b.city || ''));
  }, [airports, unlocked, existingHubIatas]);

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalShell} onClick={(e): void => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', color: '#F8FAFC' }}>Add hub</h3>
        <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 0 }}>
          Each new hub lets you originate routes from that airport.
          The first hub in any region is free; extras cost based on tier.
        </p>
        <ul style={list}>
          {candidates.slice(0, 50).map((a) => (
            <li key={a.iata} style={card}>
              <div style={cardHeader}>
                <div>
                  <div style={cardTitle}>{a.iata}</div>
                  <div style={cardSubtitle}>{a.city || a.country} ({countryName(a.country)})</div>
                </div>
                <button
                  onClick={(): void => onPick(a.iata)}
                  style={{ ...primaryBtn, width: 'auto', padding: '8px 14px', minHeight: 36 }}
                >
                  Pick
                </button>
              </div>
            </li>
          ))}
        </ul>
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
  const [error, setError] = useState<string | null>(null);

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
  const cost = distance > 0 ? routeOpenCost(distance) : 0;
  const canOpen = !!(selectedAc && originIata && destIata && originIata !== destIata && cost > 0 && cash >= cost);

  const onConfirm = (): void => {
    if (!selectedAc) return;
    const res = openRoute(originIata, destIata, selectedAc.uid);
    if (res.ok) { haptics.heavy(); onClose(); }
    else { haptics.warning(); setError(res.message); }
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
            <select
              {...(originIata && !destIata ? { 'data-tutorial': 'routes-dest-select' } : {})}
              disabled={!originIata}
              value={destIata}
              onChange={(e): void => setDestIata(e.target.value)}
              style={selectStyle}
            >
              <option value="">— pick a country / airport —</option>
              {destGroupedByCountry.map((g) => (
                <optgroup key={g.iso} label={g.label}>
                  {g.airports.map((a) => (
                    <option key={a.iata} value={a.iata}>
                      {a.iata} · {a.city || g.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {distance > 0 && (
              <div style={summaryBox}>
                <div>Distance: <b>{Math.round(distance).toLocaleString()} km</b></div>
                <div>Opening fee: <b style={{ color: '#F4C75B' }}>${formatCash(cost, 1)}</b></div>
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
                Open route
              </button>
            </div>
            {error && <div style={errorText}>{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}

const COUNTRY_DISPLAY = new Intl.DisplayNames(['en'], { type: 'region' });
function countryName(iso: string): string {
  try { return COUNTRY_DISPLAY.of(iso) ?? iso; } catch { return iso; }
}

function sortAirports(arr: Airport[]): Airport[] {
  return arr.sort((a, b) =>
    b.sizeTier - a.sizeTier
    || a.country.localeCompare(b.country)
    || a.city.localeCompare(b.city),
  );
}


// ───────────────────────────────────────────────────────────────────────
const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const header: React.CSSProperties = { padding: '20px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' };
const title: React.CSSProperties = { margin: 0, fontSize: 22, color: '#F8FAFC' };
const tabs: React.CSSProperties = { display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' };
const tabBtn: React.CSSProperties = {
  background: 'transparent', color: '#94A3B8', border: 0, padding: '8px 14px', borderRadius: 8,
  cursor: 'pointer', fontSize: 13, minHeight: 36, fontFamily: 'inherit',
};
const tabActive: React.CSSProperties = { background: 'rgba(90,200,250,0.12)', color: '#5AC8FA' };
const newBtn: React.CSSProperties = {
  marginTop: 12, padding: '10px 14px', borderRadius: 8,
  background: '#5AC8FA', color: '#0B1120', border: 0,
  fontWeight: 700, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
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
const closeBtn: React.CSSProperties = {
  width: '100%', marginTop: 8, background: 'transparent',
  color: '#F87171', border: '1px solid rgba(248,113,113,0.4)',
  padding: '8px', borderRadius: 6, cursor: 'pointer', minHeight: 36,
  fontSize: 12, fontFamily: 'inherit',
};
const primaryBtn: React.CSSProperties = {
  width: '100%', marginTop: 10, padding: 10, borderRadius: 8,
  background: '#5AC8FA', color: '#0B1120', border: 0, fontWeight: 700,
  cursor: 'pointer', minHeight: 40, fontFamily: 'inherit',
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
  background: '#0B1120', borderRadius: 14, padding: 20,
  width: '100%', maxWidth: 420, maxHeight: '85%', overflowY: 'auto',
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
const summaryBox: React.CSSProperties = {
  marginTop: 12, padding: '10px 12px', background: 'rgba(90,200,250,0.08)',
  borderRadius: 8, fontSize: 12, color: '#F8FAFC',
  fontFeatureSettings: '"tnum" 1',
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
