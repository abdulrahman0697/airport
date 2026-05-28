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
                  regionId={pending}
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
  regionId: number;
  onPick: (iata: string) => void;
}

/**
 * Per-region map definition — bounding box + stylised land path +
 * display label. Each region paints its own outline so the player
 * sees the geography of whatever region they actually picked
 * (Middle East ≠ Europe ≠ North America etc.). The bbox is also
 * used by `project()` to position the pins, so the same lat/lon
 * lands in different viewport positions depending on the region.
 *
 * Paths are intentionally stylised — broad shapes drawn within the
 * 320×220 viewBox that read as the continent at a glance without
 * trying to be cartographic. The 3 recommended airport pins anchor
 * the player's attention; the land outlines just give a sense of
 * place.
 */
interface RegionMap {
  label: string;
  bbox: { latMin: number; latMax: number; lonMin: number; lonMax: number };
  paths: readonly string[];
}
const MAP_W = 320;
const MAP_H = 220;
const REGION_MAPS: Record<number, RegionMap> = {
  // North America — wide continent narrowing toward Mexico
  1: {
    label: 'NORTH AMERICA',
    bbox: { latMin: 15, latMax: 60, lonMin: -130, lonMax: -60 },
    paths: [
      // Main landmass (Canada + US)
      'M 18 20 Q 60 12 110 18 Q 160 14 210 20 Q 260 24 300 32 L 308 60 Q 290 80 270 90 Q 240 110 210 105 Q 180 110 150 100 Q 120 110 100 100 Q 70 110 50 100 Q 25 90 16 60 Q 12 38 18 20 Z',
      // Mexico / Central America tail
      'M 150 100 Q 158 130 168 155 Q 178 180 198 195 Q 215 200 222 188 Q 215 170 200 150 Q 188 135 178 125 Q 170 115 165 105 Z',
    ],
  },
  // Latin America — South America inverted triangle + Central America stub
  2: {
    label: 'LATIN AMERICA',
    bbox: { latMin: -55, latMax: 25, lonMin: -85, lonMax: -35 },
    paths: [
      // S America silhouette
      'M 70 40 Q 100 30 140 40 Q 180 35 215 50 Q 240 70 245 100 Q 240 130 220 155 Q 200 180 175 200 L 160 210 Q 150 215 140 205 Q 130 190 130 170 Q 115 160 95 155 Q 75 140 70 120 Q 60 95 55 75 Q 55 55 70 40 Z',
      // C America stub
      'M 40 30 Q 55 30 60 45 Q 62 55 55 60 Q 45 60 38 50 Z',
    ],
  },
  // Europe — continental Europe + UK islands + Scandinavia
  3: {
    label: 'EUROPE',
    bbox: { latMin: 35, latMax: 66, lonMin: -10, lonMax: 35 },
    paths: [
      // Mainland + Scandinavia
      'M 50 80 Q 80 55 130 60 Q 170 55 210 50 Q 250 38 280 30 Q 300 45 305 70 Q 295 95 270 110 Q 240 105 215 115 Q 195 110 175 120 L 160 145 Q 150 165 145 175 L 138 185 Q 130 175 130 160 Q 130 145 120 138 Q 100 132 80 130 Q 60 120 55 105 Q 50 92 50 80 Z',
      // UK + Ireland
      'M 22 60 Q 38 55 42 70 Q 40 90 30 95 Q 18 95 18 80 Q 18 65 22 60 Z',
      // Iberia
      'M 35 110 Q 60 105 75 115 Q 80 130 70 138 Q 50 142 40 132 Q 30 122 35 110 Z',
      // Italy peninsula already mostly drawn via mainland sweep
    ],
  },
  // Middle East — Eurasia block + Arabian peninsula
  4: {
    label: 'MIDDLE EAST',
    bbox: { latMin: 12, latMax: 42, lonMin: 32, lonMax: 62 },
    paths: [
      // Northern landmass (Anatolia + Iran + Caucasus)
      'M 14 38 Q 50 25 100 32 Q 150 22 200 30 Q 250 26 290 36 Q 308 56 305 80 Q 280 100 240 102 Q 200 110 170 100 Q 140 108 110 100 Q 80 108 55 100 Q 28 88 16 70 Q 8 52 14 38 Z',
      // Arabian peninsula
      'M 130 100 Q 155 130 175 158 Q 198 178 218 180 Q 232 178 232 162 Q 222 142 205 124 Q 188 110 170 102 Q 150 104 130 100 Z',
    ],
  },
  // Africa — broad rounded triangle pointing down
  5: {
    label: 'AFRICA',
    bbox: { latMin: -35, latMax: 38, lonMin: -20, lonMax: 52 },
    paths: [
      // Continent silhouette
      'M 60 35 Q 110 20 170 30 Q 230 26 270 38 Q 290 60 280 88 Q 270 115 250 138 Q 235 158 210 168 Q 195 184 175 196 L 162 205 Q 152 208 148 198 Q 138 178 142 158 Q 132 150 120 145 Q 100 130 88 110 Q 75 92 68 70 Q 56 50 60 35 Z',
      // Madagascar
      'M 270 160 Q 282 168 286 182 Q 282 196 274 200 Q 266 195 264 182 Q 264 168 270 160 Z',
    ],
  },
  // South Asia — Indian subcontinent triangle + Sri Lanka
  6: {
    label: 'SOUTH ASIA',
    bbox: { latMin: 5, latMax: 38, lonMin: 62, lonMax: 95 },
    paths: [
      // Indian subcontinent + Himalayan northland
      'M 30 60 Q 80 40 140 45 Q 200 38 260 50 Q 290 62 305 80 Q 295 98 270 102 Q 240 100 220 110 L 200 130 Q 180 150 170 170 L 158 188 Q 148 192 142 180 Q 140 165 138 148 Q 128 132 112 120 Q 95 110 78 102 Q 55 90 38 78 Q 26 70 30 60 Z',
      // Sri Lanka
      'M 152 198 Q 162 198 164 208 Q 162 218 154 218 Q 148 212 150 202 Z',
    ],
  },
  // East Asia — continent + Japan archipelago
  7: {
    label: 'EAST ASIA',
    bbox: { latMin: 18, latMax: 52, lonMin: 100, lonMax: 145 },
    paths: [
      // Mainland China + Korea
      'M 18 30 Q 60 18 110 22 Q 160 18 210 28 Q 230 45 235 70 Q 232 95 220 118 Q 200 138 178 150 Q 158 158 138 158 Q 118 158 100 150 Q 80 140 65 125 Q 45 110 32 90 Q 18 70 18 30 Z',
      // Korea protrusion
      'M 200 100 Q 215 110 218 130 Q 215 148 205 152 Q 195 142 196 122 Z',
      // Japan archipelago
      'M 245 60 Q 262 70 268 88 Q 272 105 260 110 Q 248 105 244 88 Q 240 72 245 60 Z',
      'M 270 110 Q 282 118 286 130 Q 282 142 275 145 Q 268 138 268 122 Z',
      // Taiwan
      'M 195 158 Q 202 162 203 172 Q 199 180 195 180 Q 191 172 192 162 Z',
    ],
  },
  // Southeast Asia — peninsula + island scatter
  8: {
    label: 'SOUTHEAST ASIA',
    bbox: { latMin: -10, latMax: 25, lonMin: 90, lonMax: 140 },
    paths: [
      // Mainland (Thailand/Vietnam)
      'M 30 30 Q 60 22 90 30 Q 110 35 115 55 Q 110 80 95 100 L 88 122 Q 80 135 70 130 Q 65 115 70 95 Q 60 90 50 80 Q 38 65 30 50 Q 24 38 30 30 Z',
      // Sumatra
      'M 70 130 Q 100 138 130 150 Q 145 165 138 175 Q 110 175 90 168 Q 70 158 65 145 Z',
      // Java
      'M 150 175 Q 180 178 210 178 Q 232 178 245 188 Q 232 198 200 196 Q 175 196 155 192 Z',
      // Borneo
      'M 158 110 Q 185 105 205 118 Q 215 138 205 152 Q 180 158 162 148 Q 152 130 158 110 Z',
      // Philippines
      'M 230 60 Q 240 70 240 85 Q 235 95 226 95 Q 222 85 222 70 Z',
      'M 230 105 Q 240 110 240 122 Q 235 130 226 125 Q 222 115 226 108 Z',
    ],
  },
  // Oceania — Australia blob + NZ + island scatter
  9: {
    label: 'OCEANIA',
    bbox: { latMin: -45, latMax: 0, lonMin: 110, lonMax: 180 },
    paths: [
      // Australia
      'M 30 90 Q 70 70 120 75 Q 170 70 220 80 Q 240 100 235 130 Q 220 155 188 170 Q 158 178 130 175 Q 100 178 70 168 Q 40 155 28 130 Q 20 108 30 90 Z',
      // New Zealand
      'M 270 175 Q 280 180 282 195 Q 278 208 270 210 Q 264 200 266 188 Z',
      'M 285 195 Q 295 200 296 212 Q 290 220 283 218 Q 280 208 282 198 Z',
      // PNG
      'M 165 50 Q 200 55 230 60 Q 232 72 215 75 Q 185 72 165 65 Z',
    ],
  },
};

// Design Review v6 — point 5. One reason per card. The previous
// "tag + line" was redundant.
const RECOMMENDED_PROFILES: Record<string, { tag: string; profile: 'HIGH' | 'BALANCED' | 'EASY' }> = {
  DXB: { tag: 'Fastest growth, expensive upgrades', profile: 'HIGH' },
  DOH: { tag: 'Balanced route demand', profile: 'BALANCED' },
  MCT: { tag: 'Cheapest first expansion', profile: 'EASY' },
  AUH: { tag: 'Wealthy premium pax', profile: 'HIGH' },
  RUH: { tag: 'Huge market, scale fast', profile: 'HIGH' },
  JED: { tag: 'Seasonal surges, loyal pax', profile: 'BALANCED' },
  KWI: { tag: 'Business travel corridor', profile: 'BALANCED' },
  BAH: { tag: 'Easy entry, short hops', profile: 'EASY' },
};

function FounderMarketMap({ airports, tailColor, regionId, onPick }: FounderMarketMapProps) {
  // Pick the three best matches present in the region.
  const ranked = (() => {
    const high: Airport | null = pickFirst(airports, ['DXB', 'AUH', 'RUH']);
    const balanced: Airport | null = pickFirst(airports, ['DOH', 'JED', 'KWI']);
    const easy: Airport | null = pickFirst(airports, ['MCT', 'BAH']);
    const picks = [high, balanced, easy].filter((x): x is Airport => x !== null);
    if (picks.length >= 3) return picks.slice(0, 3);
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
      <div style={fmmKicker(tailColor)}>FOUNDER MARKET MAP · TAP A CITY TO FOUND YOUR BASE</div>
      {/* Stylised regional map — Design Review v6 point 4. The
          recommended bases sit as glowing pins on a soft regional
          backdrop instead of in flat rows. */}
      <RegionalMapBackdrop ranked={ranked} tailColor={tailColor} regionId={regionId} onPick={onPick} />
      <div style={fmmCards}>
        {ranked.map((a) => {
          const profile = RECOMMENDED_PROFILES[a.iata] ?? {
            tag: `Operate from ${a.city || countryName(a.country)}`, profile: 'BALANCED' as const,
          };
          const difficulty: 'EASY' | 'BALANCED' | 'AGGRESSIVE' =
            profile.profile === 'HIGH' ? 'AGGRESSIVE'
            : profile.profile === 'EASY' ? 'EASY' : 'BALANCED';
          const accent = profile.profile === 'HIGH' ? COLOR.gold.base
            : profile.profile === 'EASY' ? COLOR.success : tailColor;
          return (
            <button
              key={a.iata}
              onClick={(): void => onPick(a.iata)}
              style={fmmCard(accent)}
            >
              <div style={fmmCardHead}>
                <span style={fmmIata}>{a.iata}</span>
                <span style={{ ...fmmDifficulty, color: '#0B1120', background: accent }}>
                  {difficulty}
                </span>
              </div>
              <div style={fmmCity}>{a.city || countryName(a.country)}</div>
              <div style={fmmReason}>{profile.tag}</div>
              <div style={fmmCta(accent)}>Found base →</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RegionalMapBackdrop({
  ranked, tailColor, regionId, onPick,
}: {
  ranked: readonly Airport[];
  tailColor: string;
  regionId: number;
  onPick: (iata: string) => void;
}) {
  // Look up the region-specific map definition. Fallback to Europe
  // (id 3) if an unknown region somehow comes through.
  const mapDef = REGION_MAPS[regionId] ?? REGION_MAPS[3]!;
  const W = MAP_W, H = MAP_H;

  // Project lat/lon into the SVG viewport using THIS region's bbox.
  // Pads the projection slightly inside the edges so pins never crowd
  // the frame.
  const project = (lat: number, lon: number): { x: number; y: number } => {
    const { latMin, latMax, lonMin, lonMax } = mapDef.bbox;
    const x = ((lon - lonMin) / (lonMax - lonMin)) * W;
    const y = H - ((lat - latMin) / (latMax - latMin)) * H;
    return {
      x: Math.max(28, Math.min(W - 28, x)),
      y: Math.max(28, Math.min(H - 28, y)),
    };
  };

  return (
    <div style={mapBackdropWrap}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}>
        <defs>
          <radialGradient id={`map-sea-${regionId}`} cx="0.5" cy="0.5" r="0.85">
            <stop offset="0" stopColor="#10172E" />
            <stop offset="1" stopColor="#070A18" />
          </radialGradient>
          <linearGradient id={`map-land-${regionId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1A2347" />
            <stop offset="1" stopColor="#0E1832" />
          </linearGradient>
          <radialGradient id={`pin-glow-${regionId}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={tailColor} stopOpacity="0.45" />
            <stop offset="1" stopColor={tailColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sea backdrop */}
        <rect x="0" y="0" width={W} height={H} fill={`url(#map-sea-${regionId})`} />

        {/* Region-specific land masses */}
        {mapDef.paths.map((d, i) => (
          <path
            key={`land-${i}`}
            d={d}
            fill={`url(#map-land-${regionId})`}
            stroke={tailColor}
            strokeOpacity="0.18"
            strokeWidth="0.6"
          />
        ))}

        {/* Compass */}
        <g transform={`translate(${W - 30} 22)`} opacity="0.55">
          <circle cx="0" cy="0" r="11" fill="none" stroke={tailColor} strokeWidth="0.7" />
          <path d="M 0 -8 L 2 0 L 0 8 L -2 0 Z" fill={tailColor} opacity="0.9" />
          <text x="0" y="-13" textAnchor="middle" fontSize="6" fontWeight="800"
            fill={tailColor} letterSpacing="0.2em">N</text>
        </g>

        {/* Region label */}
        <text x="14" y="20" fontSize="11" fontWeight="800" letterSpacing="0.18em"
          fill={tailColor} opacity="0.85">{mapDef.label}</text>

        {/* Recommended base pins — only the three picks, no clutter */}
        {ranked.map((a) => {
          const pt = project(a.lat, a.lon);
          const profile = RECOMMENDED_PROFILES[a.iata];
          const accent = profile?.profile === 'HIGH' ? COLOR.gold.base
            : profile?.profile === 'EASY' ? COLOR.success : tailColor;
          const cityName = (a.city || countryName(a.country)).toUpperCase().slice(0, 14);
          return (
            <g key={a.iata} onClick={(): void => onPick(a.iata)} style={{ cursor: 'pointer' }}>
              {/* Soft halo around the pin */}
              <circle cx={pt.x} cy={pt.y} r="20" fill={`url(#pin-glow-${regionId})`} />
              {/* Main pin */}
              <circle cx={pt.x} cy={pt.y} r="6" fill={accent}
                style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />
              <circle cx={pt.x} cy={pt.y} r="2.4" fill="#0B1120" />
              {/* IATA label above with subtle text shadow plate */}
              <rect x={pt.x - 13} y={pt.y - 21} width="26" height="11" rx="1.5"
                fill="rgba(11,17,32,0.78)" />
              <text x={pt.x} y={pt.y - 13} textAnchor="middle" fontSize="8"
                fontWeight="900" letterSpacing="0.14em" fill={accent}>
                {a.iata}
              </text>
              {/* City label below */}
              <text x={pt.x} y={pt.y + 18} textAnchor="middle" fontSize="7"
                fontWeight="700" letterSpacing="0.08em" fill="#E2E8F0"
                style={{ paintOrder: 'stroke', stroke: '#0B1120', strokeWidth: 2 }}>
                {cityName}
              </text>
            </g>
          );
        })}
      </svg>
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
const mapBackdropWrap: React.CSSProperties = {
  marginBottom: 8,
  borderRadius: 12,
  overflow: 'hidden',
  background: 'linear-gradient(180deg, #0F1734, #050912)',
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 4,
};
const fmmCardHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 6,
};
const fmmDifficulty: React.CSSProperties = {
  fontSize: 7,
  fontWeight: 900,
  letterSpacing: '0.16em',
  padding: '2px 5px',
  borderRadius: 3,
};
const fmmReason: React.CSSProperties = {
  fontSize: 10,
  color: '#CBD5E1',
  marginTop: 4,
  lineHeight: 1.4,
  flex: 1,
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
