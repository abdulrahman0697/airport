import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { loadTopAirports, type Airport } from '../../data/airports';
import { getRegion } from '../../data/regions';
import { hubPickCost } from '../../engine/actions';
import {
  selectPendingHubPickRegion,
  selectTailColor,
  useGameStore,
} from '../../state/store';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';

/**
 * Hub picker — full-screen overlay shown whenever the engine sets a
 * `pendingHubPickRegion`. That happens on a fresh save (the player's
 * home region) and after every successful region unlock. The player
 * taps one of the major airports in the region to make it their hub.
 * The first hub in a region is free; subsequent hubs cost.
 */
const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

export function HubPicker() {
  const pending = useGameStore(selectPendingHubPickRegion);
  const tailColor = useGameStore(selectTailColor);
  const pickHub = useGameStore((s) => s.pickHub);
  const dismiss = useGameStore((s) => s.dismissHubPick);
  const state = useGameStore((s) => s.state);
  const [error, setError] = useState<string | null>(null);

  const regionDef = pending !== null ? getRegion(pending) : null;
  const airports = useMemo(() => {
    if (pending === null) return [] as Airport[];
    return loadTopAirports()
      .filter((a) => a.region === pending && a.sizeTier === 4)
      .sort((a, b) =>
        (a.country.localeCompare(b.country))
        || (a.city || '').localeCompare(b.city || ''));
  }, [pending]);

  const handlePick = (iata: string): void => {
    const res = pickHub(iata);
    if (res.ok) {
      haptics.success();
      setError(null);
    } else {
      haptics.warning();
      setError(res.message);
    }
  };

  if (pending === null || !state) return null;
  const isFirstInRegion = !state.hubs.some((h) => {
    const ap = airports.find((a) => a.iata === h.iata);
    return ap && ap.region === pending;
  });

  return (
    <AnimatePresence>
      <motion.div
        key={`hub-picker-${pending}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={backdrop as Record<string, unknown>}
      >
        <motion.div
          initial={{ y: 24, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          style={card(tailColor) as Record<string, unknown>}
        >
          <div style={{ ...accentBar, background: tailColor }} />
          <div style={inner}>
            <div style={{ ...kicker, color: tailColor }}>
              {isFirstInRegion ? 'New foothold' : 'Add a hub'}
            </div>
            <h2 style={title}>{regionDef?.name ?? `Region ${pending}`}</h2>
            <p style={body}>
              {isFirstInRegion
                ? 'Pick the airport you want to operate from in this region. This first hub is free.'
                : 'Pick an additional hub — extra hubs grow your network reach.'}
            </p>

            <ul style={list}>
              {airports.map((a) => {
                const cost = hubPickCost(state, a.iata);
                const country = safeCountryName(a.country);
                const owned = state.hubs.some((h) => h.iata === a.iata);
                return (
                  <li key={a.iata} style={item}>
                    <button
                      onClick={(): void => handlePick(a.iata)}
                      disabled={owned || (state.cash < cost)}
                      style={{
                        ...itemBtn,
                        opacity: owned ? 0.4 : state.cash < cost ? 0.55 : 1,
                      }}
                    >
                      <div style={itemLeft}>
                        <div style={iata}>{a.iata}</div>
                        <div style={cityRow}>
                          <span style={city}>{a.city || country}</span>
                          <span style={countryLabel}>{country}</span>
                        </div>
                      </div>
                      <div style={itemRight}>
                        {owned
                          ? <span style={ownedPill}>Hub</span>
                          : cost === 0
                            ? <span style={freePill}>Free</span>
                            : <span style={costText}>${formatCash(cost, 1)}</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {error && <div style={errorText}>{error}</div>}

            <button onClick={(): void => { dismiss(); }} style={skipBtn}>
              Decide later
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function safeCountryName(iso: string): string {
  try { return COUNTRY_NAMES.of(iso) ?? iso; } catch { return iso; }
}

// ─── Styles ──────────────────────────────────────────────────────────
const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(4px)',
  display: 'grid', placeItems: 'center',
  zIndex: 65, padding: 12,
};
const card = (accent: string): React.CSSProperties => ({
  width: '100%', maxWidth: 420,
  maxHeight: '92dvh',
  display: 'flex', flexDirection: 'column',
  background: 'linear-gradient(160deg, #182143, #0B1120)',
  borderRadius: 18, overflow: 'hidden',
  border: `1px solid ${accent}44`,
  boxShadow: `0 24px 70px rgba(0,0,0,0.6), 0 0 48px ${accent}33`,
});
const accentBar: React.CSSProperties = { height: 5 };
const inner: React.CSSProperties = {
  padding: '18px 20px 18px',
  display: 'flex', flexDirection: 'column',
  flex: 1, minHeight: 0,
};
const kicker: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
  fontWeight: 700,
};
const title: React.CSSProperties = {
  margin: '6px 0 4px', fontSize: 22, color: '#F8FAFC', fontWeight: 700,
};
const body: React.CSSProperties = {
  margin: '0 0 12px', color: '#94A3B8', fontSize: 12, lineHeight: 1.55,
};
const list: React.CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0,
  display: 'flex', flexDirection: 'column', gap: 6,
  overflowY: 'auto', flex: 1, minHeight: 0,
};
const item: React.CSSProperties = { margin: 0 };
const itemBtn: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '10px 12px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
  minHeight: 56,
};
const itemLeft: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 };
const iata: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: '#F8FAFC', letterSpacing: '0.06em',
};
const cityRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const city: React.CSSProperties = { fontSize: 11, color: '#F8FAFC' };
const countryLabel: React.CSSProperties = { fontSize: 10, color: '#94A3B8' };
const itemRight: React.CSSProperties = { display: 'flex', alignItems: 'center' };
const freePill: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#34D399', background: 'rgba(52,211,153,0.14)',
  border: '1px solid rgba(52,211,153,0.4)',
  padding: '3px 8px', borderRadius: 4, fontWeight: 700,
};
const ownedPill: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#94A3B8', background: 'rgba(148,163,184,0.10)',
  padding: '3px 8px', borderRadius: 4,
};
const costText: React.CSSProperties = {
  color: '#F4C75B', fontWeight: 700, fontSize: 12,
  fontFeatureSettings: '"tnum" 1',
};
const skipBtn: React.CSSProperties = {
  marginTop: 10, padding: 10,
  background: 'transparent', color: '#94A3B8',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12, minHeight: 40,
};
const errorText: React.CSSProperties = {
  marginTop: 8, padding: '6px 10px', fontSize: 11, color: '#F87171',
  background: 'rgba(248,113,113,0.08)', borderRadius: 6,
};
