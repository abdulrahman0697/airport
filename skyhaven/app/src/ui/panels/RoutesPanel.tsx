import { useMemo, useState } from 'react';
import { getAircraftDef } from '../../data/aircraft';
import { loadTopAirports, type Airport } from '../../data/airports';
import { conditionBand } from '../../engine/condition';
import { haversineKm } from '../../engine/distance';
import { cashPerSecond, legDurationMs } from '../../engine/economy';
import { routeOpenCost } from '../../engine/actions';
import type { Route, RoutePricing } from '../../engine/types';
import {
  selectCash,
  selectFleet,
  selectRoutes,
  useGameStore,
} from '../../state/store';
import { formatCash, formatRate } from '../format';

export function RoutesPanel() {
  const [showNew, setShowNew] = useState(false);
  const routes = useGameStore(selectRoutes);

  return (
    <div style={shell}>
      <div style={header}>
        <h2 style={title}>Routes</h2>
        <div style={subtitle}>{routes.length} active</div>
        <button onClick={(): void => setShowNew(true)} style={newBtn}>+ New route</button>
      </div>
      <div style={body}>
        {routes.length === 0 ? (
          <div style={empty}>No active routes. Open your first one →</div>
        ) : (
          <ul style={list}>
            {routes.map((r) => <RouteRow key={r.id} route={r} />)}
          </ul>
        )}
      </div>
      {showNew && <NewRouteModal onClose={(): void => setShowNew(false)} />}
    </div>
  );
}

function RouteRow({ route }: { route: Route }) {
  const aircraft = useGameStore((s) => s.state?.fleet.find((a) => a.uid === route.aircraftUid));
  const setPricing = useGameStore((s) => s.setRoutePricing);
  const closeRoute = useGameStore((s) => s.closeRoute);
  const [error, setError] = useState<string | null>(null);
  if (!aircraft) return null;
  const def = getAircraftDef(aircraft.defId);
  if (!def) return null;

  const cps = cashPerSecond(route, aircraft);
  const leg = legDurationMs(route, aircraft) / 1000;
  const band = conditionBand(aircraft.condition);
  const condColor = band === 'normal' ? '#34D399' : band === 'degraded' ? '#F59E0B' : '#F87171';

  const onPricing = (p: RoutePricing): void => {
    const res = setPricing(route.id, p);
    setError(res.ok ? null : res.message);
  };
  const onClose = (): void => {
    const res = closeRoute(route.id);
    setError(res.ok ? null : res.message);
  };

  return (
    <li style={card}>
      <div style={cardHeader}>
        <div>
          <div style={cardTitle}>{route.originIata} ↔ {route.destIata}</div>
          <div style={cardSubtitle}>
            {def.displayName} · {Math.round(route.distanceKm).toLocaleString()} km · leg {leg.toFixed(1)}s
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={rateText}>{formatRate(cps)}</div>
          <div style={{ color: condColor, fontSize: 11, marginTop: 2 }}>
            {aircraft.condition.toFixed(0)}% · {(route.loadFactor * 100).toFixed(0)}% load
          </div>
        </div>
      </div>

      <div style={pricingRow}>
        {(['economy', 'balanced', 'premium'] as const).map((p) => (
          <button
            key={p}
            onClick={(): void => onPricing(p)}
            style={{ ...pricingBtn, ...(route.pricing === p ? pricingActive : {}) }}
          >
            {p[0]!.toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <button onClick={onClose} style={closeBtn}>Close route</button>
      {error && <div style={errorText}>{error}</div>}
    </li>
  );
}

function NewRouteModal({ onClose }: { onClose: () => void }) {
  const fleet = useGameStore(selectFleet);
  const cash = useGameStore(selectCash);
  const openRoute = useGameStore((s) => s.openRoute);
  const airports = useMemo(() => loadTopAirports(), []);

  const idleAircraft = fleet.filter((a) => a.routeId === null);
  const [acUid, setAcUid] = useState<string>(idleAircraft[0]?.uid ?? '');
  const selectedAc = idleAircraft.find((a) => a.uid === acUid);
  const def = selectedAc ? getAircraftDef(selectedAc.defId) : undefined;
  const [originIata, setOriginIata] = useState<string>('');
  const [destIata, setDestIata] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Filter airports by range from origin (if origin set) using the
  // aircraft's rangeKm. Origin list is unrestricted.
  const originAirports = useMemo(
    () => sortAirports(airports.slice()), [airports],
  );
  const destAirports = useMemo(() => {
    if (!def) return [];
    const origin = airports.find((a) => a.iata === originIata);
    if (!origin) return sortAirports(airports.slice());
    return sortAirports(
      airports.filter((a) => {
        if (a.iata === originIata) return false;
        const d = haversineKm(origin.lat, origin.lon, a.lat, a.lon);
        return d <= def.rangeKm && d >= 100;
      }),
    );
  }, [airports, originIata, def]);

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
    if (res.ok) onClose();
    else setError(res.message);
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

            <label style={formLabel}>Origin</label>
            <AirportSelect
              value={originIata}
              options={originAirports}
              onChange={(v): void => { setOriginIata(v); setDestIata(''); }}
            />

            <label style={formLabel}>Destination</label>
            <AirportSelect
              value={destIata}
              options={destAirports}
              onChange={setDestIata}
              disabled={!originIata}
            />

            {distance > 0 && (
              <div style={summaryBox}>
                <div>Distance: <b>{Math.round(distance).toLocaleString()} km</b></div>
                <div>Opening fee: <b style={{ color: '#F4C75B' }}>${formatCash(cost, 1)}</b></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={onClose} style={cancelBtn}>Cancel</button>
              <button onClick={onConfirm} disabled={!canOpen}
                style={{ ...confirmBtn, opacity: canOpen ? 1 : 0.4 }}>
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

function sortAirports(arr: Airport[]): Airport[] {
  return arr.sort((a, b) =>
    b.sizeTier - a.sizeTier
    || a.country.localeCompare(b.country)
    || a.city.localeCompare(b.city),
  );
}

function AirportSelect({
  value, options, onChange, disabled,
}: {
  value: string;
  options: readonly Airport[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  // For Phase 3 we use a native <select>. Phase 5 swaps in a searchable
  // virtualised list once airport counts get large.
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(e): void => onChange(e.target.value)}
      style={selectStyle}
    >
      <option value="">— select airport —</option>
      {options.slice(0, 600).map((a) => (
        <option key={a.iata} value={a.iata}>
          {a.iata} · {a.city || a.country} ({a.country})
        </option>
      ))}
    </select>
  );
}

const shell: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' };
const header: React.CSSProperties = { padding: '20px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' };
const title: React.CSSProperties = { margin: 0, fontSize: 22, color: '#F8FAFC' };
const subtitle: React.CSSProperties = { color: '#94A3B8', fontSize: 12, marginTop: 2 };
const newBtn: React.CSSProperties = {
  marginTop: 12, padding: '10px 14px', borderRadius: 8,
  background: '#5AC8FA', color: '#0B1120', border: 0,
  fontWeight: 700, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
};
const body: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: 12 };
const list: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 };
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12,
  border: '1px solid rgba(255,255,255,0.06)',
};
const cardHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const cardTitle: React.CSSProperties = { color: '#F8FAFC', fontSize: 15, fontWeight: 600 };
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
