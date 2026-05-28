import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { loadTopAirports, type Airport } from '../../data/airports';
import { getRegion, REGIONS } from '../../data/regions';
import { hubPickCost } from '../../engine/actions';
import {
  selectHubs,
  selectPendingHubPickRegion,
  selectTailColor,
  useGameStore,
} from '../../state/store';
import { countryName } from '../countryNames';
import { COLOR } from '../design/tokens';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';

/**
 * Hub picker — full-screen overlay shown whenever the engine sets a
 * `pendingHubPickRegion`. That happens on a fresh save (the player's
 * home region) and after every successful region unlock. The player
 * taps one of the major airports in the region to make it their hub.
 * The first hub in a region is free; subsequent hubs cost.
 */

export function HubPicker() {
  const pending = useGameStore(selectPendingHubPickRegion);
  const tailColor = useGameStore(selectTailColor);
  const hubs = useGameStore(selectHubs);
  const pickHub = useGameStore((s) => s.pickHub);
  const dismiss = useGameStore((s) => s.dismissHubPick);
  const chooseStartingRegion = useGameStore((s) => s.chooseStartingRegion);
  const state = useGameStore((s) => s.state);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const isFirstEverHub = hubs.length === 0;

  const regionDef = pending !== null ? getRegion(pending) : null;
  const airports = useMemo(() => {
    if (pending === null) return [] as Airport[];
    return loadTopAirports()
      .filter((a) => a.region === pending && a.sizeTier === 4 && isInternational(a))
      .sort((a, b) =>
        (a.country.localeCompare(b.country))
        || (a.city || '').localeCompare(b.city || ''));
  }, [pending]);
  const airportsByCountry = useMemo(() => {
    const groups = new Map<string, Airport[]>();
    for (const a of airports) {
      const arr = groups.get(a.country);
      if (arr) arr.push(a); else groups.set(a.country, [a]);
    }
    return [...groups.entries()]
      .map(([iso, arr]) => ({ iso, label: countryName(iso), airports: arr }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [airports]);

  const toggleCountry = (iso: string): void => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(iso)) next.delete(iso); else next.add(iso);
      return next;
    });
  };

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

  const onChangeStarter = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const id = Number(e.target.value);
    if (!Number.isFinite(id)) return;
    const res = chooseStartingRegion(id);
    if (res.ok) { setExpanded(new Set()); setError(null); }
    else setError(res.message);
  };

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

            {isFirstEverHub && (
              <>
                {/* Founder Market Map — Design Review v5 point 4.
                    Three recommended starting bases as bold cards
                    above the country list, so the very first
                    strategic choice feels like founding an airline,
                    not selecting a filter. */}
                <FounderMarketMap
                  airports={airports}
                  tailColor={tailColor}
                  onPick={handlePick}
                />
                <div style={starterRow}>
                  <label style={starterLabel}>Or change starting region</label>
                  <select
                    value={pending ?? ''}
                    onChange={onChangeStarter}
                    style={starterSelect}
                  >
                    {REGIONS.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div style={moreBasesKicker}>↓ EXPLORE ALL BASES IN {regionDef?.name?.toUpperCase() ?? 'REGION'}</div>
              </>
            )}

            <div style={listScroller}>
              {airportsByCountry.map((group) => {
                const open = expanded.has(group.iso);
                return (
                  <section key={group.iso} style={countrySection}>
                    <button
                      onClick={(): void => toggleCountry(group.iso)}
                      style={countryHeaderBtn}
                      aria-expanded={open}
                    >
                      <span>{group.label}</span>
                      <span style={countryChev}>{open ? '▾' : '▸'} {group.airports.length}</span>
                    </button>
                    {open && (
                      <ul style={list}>
                        {group.airports.map((a) => {
                          const cost = hubPickCost(state, a.iata);
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
                                    <span style={city}>{a.city || group.label}</span>
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
                    )}
                  </section>
                );
              })}
            </div>

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

/**
 * Phase 10 polish: hub list is too long because Tier-4 includes some
 * national airports that aren't really international. The build script
 * now flags each airport with an `intl` boolean derived from its name;
 * this picker honours that flag.
 */
function isInternational(a: Airport): boolean {
  return a.intl;
}

// Founder Market Map (Design Review v5 — point 4). Three recommended
// starting bases in the player's current region, rendered as bold
// cards atop a stylised regional map. Each card carries a strategic
// "personality" so the choice feels like founding an airline, not
// scrolling through Bahrain → Iran → Iraq → Kuwait.
interface FounderMarketMapProps {
  airports: readonly Airport[];
  tailColor: string;
  onPick: (iata: string) => void;
}

const RECOMMENDED_PROFILES: Record<string, { tag: string; line: string; profile: 'HIGH' | 'BALANCED' | 'EASY' }> = {
  DXB: { tag: 'High demand', line: 'High cost · high reward.', profile: 'HIGH' },
  DOH: { tag: 'Balanced growth', line: 'Steady demand · solid margins.', profile: 'BALANCED' },
  MCT: { tag: 'Easy first route', line: 'Low cost · quick to profit.', profile: 'EASY' },
  AUH: { tag: 'Premium hub', line: 'Wealthy pax · premium yield.', profile: 'HIGH' },
  RUH: { tag: 'Massive market', line: 'Huge demand · scale fast.', profile: 'HIGH' },
  JED: { tag: 'Pilgrimage gateway', line: 'Seasonal surges · loyal pax.', profile: 'BALANCED' },
  KWI: { tag: 'Wealthy corridor', line: 'Business travel · steady cash.', profile: 'BALANCED' },
  BAH: { tag: 'Small but easy', line: 'Easy entry · short hops.', profile: 'EASY' },
};

function FounderMarketMap({ airports, tailColor, onPick }: FounderMarketMapProps) {
  // Pick the three best matches present in the region. Preserve our
  // explicit order: 1 high, 1 balanced, 1 easy. Fall back to the top
  // three airports if explicit profiles aren't found.
  const ranked = (() => {
    const high: Airport | null = pickFirst(airports, ['DXB', 'AUH', 'RUH']);
    const balanced: Airport | null = pickFirst(airports, ['DOH', 'JED', 'KWI']);
    const easy: Airport | null = pickFirst(airports, ['MCT', 'BAH']);
    const picks = [high, balanced, easy].filter((x): x is Airport => x !== null);
    if (picks.length >= 3) return picks.slice(0, 3);
    // Top up with whichever airports we have.
    const seen = new Set(picks.map((p) => p.iata));
    for (const a of airports) {
      if (seen.has(a.iata)) continue;
      picks.push(a);
      if (picks.length >= 3) break;
    }
    return picks.slice(0, 3);
  })();

  return (
    <div style={fmmWrap}>
      <div style={fmmKicker(tailColor)}>FOUNDER MARKET MAP · RECOMMENDED BASES</div>
      <div style={fmmCards}>
        {ranked.map((a) => {
          const profile = RECOMMENDED_PROFILES[a.iata] ?? {
            tag: 'Available hub', line: `Operate from ${a.city || countryName(a.country)}.`, profile: 'BALANCED' as const,
          };
          const accent = profile.profile === 'HIGH' ? COLOR.gold.base
            : profile.profile === 'EASY' ? COLOR.success : tailColor;
          return (
            <button
              key={a.iata}
              onClick={(): void => onPick(a.iata)}
              style={fmmCard(accent)}
            >
              <div style={fmmIata}>{a.iata}</div>
              <div style={fmmCity}>{a.city || countryName(a.country)}</div>
              <div style={{ ...fmmTag, color: accent }}>{profile.tag}</div>
              <div style={fmmLine}>{profile.line}</div>
              <div style={fmmCta(accent)}>Found base →</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function pickFirst(airports: readonly Airport[], iatas: string[]): Airport | null {
  for (const iata of iatas) {
    const found = airports.find((a) => a.iata === iata);
    if (found) return found;
  }
  return null;
}

const fmmWrap: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 4,
  padding: '8px 0 4px',
};
const fmmKicker = (tail: string): React.CSSProperties => ({
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.22em',
  color: tail,
  marginBottom: 8,
});
const fmmCards: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 6,
};
const fmmCard = (accent: string): React.CSSProperties => ({
  background: `linear-gradient(180deg, ${accent}22, rgba(11,17,32,0.55))`,
  border: `1px solid ${accent}55`,
  borderRadius: 10,
  padding: '10px 8px 8px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
  color: '#F8FAFC',
  minHeight: 124,
  display: 'flex',
  flexDirection: 'column',
});
const fmmIata: React.CSSProperties = {
  fontSize: 18, fontWeight: 900, letterSpacing: '0.04em',
  fontFamily: '"Courier New", monospace',
};
const fmmCity: React.CSSProperties = {
  fontSize: 11, color: '#CBD5E1', marginTop: 2,
  letterSpacing: '0.04em',
};
const fmmTag: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
  marginTop: 6,
  textTransform: 'uppercase',
};
const fmmLine: React.CSSProperties = {
  fontSize: 10, color: '#94A3B8', marginTop: 4, lineHeight: 1.4,
  flex: 1,
};
const fmmCta = (accent: string): React.CSSProperties => ({
  marginTop: 6,
  fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
  color: accent,
  textTransform: 'uppercase',
});
const moreBasesKicker: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.2em',
  color: '#64748B',
  margin: '4px 0 6px',
  textAlign: 'center',
};

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
  display: 'flex', flexDirection: 'column', gap: 4,
};
const listScroller: React.CSSProperties = {
  flex: 1, minHeight: 0, overflowY: 'auto',
  display: 'flex', flexDirection: 'column', gap: 12,
  paddingRight: 4,
};
const countrySection: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
};
const countryHeaderBtn: React.CSSProperties = {
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
const countryChev: React.CSSProperties = {
  fontSize: 11, color: '#94A3B8', letterSpacing: '0.02em',
};
const starterRow: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
  marginBottom: 12, padding: '10px 12px',
  background: 'rgba(244,199,91,0.08)',
  border: '1px solid rgba(244,199,91,0.32)',
  borderRadius: 10,
};
const starterLabel: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: '#F4C75B', fontWeight: 700,
};
const starterSelect: React.CSSProperties = {
  width: '100%', background: 'rgba(11,17,32,0.7)', color: '#F8FAFC',
  border: '1px solid rgba(244,199,91,0.4)', borderRadius: 8,
  padding: '10px', fontSize: 14, fontFamily: 'inherit',
  minHeight: 40,
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
