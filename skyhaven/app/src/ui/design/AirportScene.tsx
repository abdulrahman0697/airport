/**
 * AirportScene — Design Review v3 (point 13, 16).
 *
 * The emotional center of the game. Grows physically with tier and is
 * tappable: terminal, runway, cargo apron, tower, parking and hotel
 * each fire `onZoneTap` so a parent can open a zone-detail card.
 *
 * Passenger streams (point 16) are a core visual: tiny coloured dots
 * walk from the terminal entrance to the gates. The number of dots
 * scales with active route load; if `premium` is requested a few
 * gold dots appear; if `cargoBacklog` is true the cargo apron shows
 * extra crates and a slow truck.
 *
 *   Tier 1 — single small terminal + one gate + one runway
 *   Tier 2 — adds second gate + cargo apron + baggage belt
 *   Tier 3 — adds control tower with strobing beacon
 *   Tier 4 — adds parking + ground vehicles
 *   Tier 5 — adds premium lounge wing + lit windows row
 *   Tier 6 — adds second runway + skybridge
 *   Tier 7 — adds metro / rail line
 *   Tier 8 — adds hotel tower
 *
 * Pure SVG. CSS animations stop with prefers-reduced-motion.
 */
import { COLOR } from './tokens';

export type AirportZone =
  | 'terminal'
  | 'gate'
  | 'runway'
  | 'tower'
  | 'cargo'
  | 'parking'
  | 'lounge'
  | 'hotel'
  | 'metro';

/**
 * Passenger mix per pricing strategy (Design Review v4 — point 17).
 * The four-segment system makes the player's strategy visible without
 * reading stats: route mix shifts the dot colours, route problems
 * shift the dot speed/queue.
 *
 *   economy  → blue  (#5AC8FA)
 *   business → gold  (#F4C75B)
 *   tourist  → green (#34D399)
 *   vip      → white (#FFFFFF)
 */
export type PaxSegment = 'economy' | 'business' | 'tourist' | 'vip';

export interface PaxMix {
  readonly economy: number;
  readonly business: number;
  readonly tourist: number;
  readonly vip: number;
}

export interface AirportSceneProps {
  /** Player tier 1..8 — drives which layers render. */
  tier: number;
  /** Airline tail color for tinting jet-bridges, lights, accents. */
  tailColor: string;
  /** Optional width override (px). Height auto from 16:9-ish aspect. */
  width?: number;
  /** Number of passenger silhouettes to animate (0..12). */
  passengerLoad?: number;
  /** Mix shown — counts per segment (sums close to passengerLoad). */
  paxMix?: PaxMix;
  /** Legacy hint: any premium routes → adds gold dots. Kept for back compat. */
  premium?: boolean;
  /** Cargo crates pile up + slower truck. */
  cargoBacklog?: boolean;
  /** A tap fires with the zone that was hit. */
  onZoneTap?: (z: AirportZone) => void;
  /** When provided, draws a soft "ghost" of the next-tier upgrade. */
  showNextGhost?: boolean;
}

export function AirportScene({
  tier, tailColor, width = 360,
  passengerLoad = 3,
  paxMix,
  premium = false,
  cargoBacklog = false,
  onZoneTap,
  showNextGhost = false,
}: AirportSceneProps) {
  const height = (width * 200) / 400;
  const tap = (z: AirportZone): React.MouseEventHandler<SVGElement> => () => onZoneTap?.(z);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 200"
      role="img"
      aria-label={`Home airport at Tier ${tier}`}
      style={{ display: 'block', borderRadius: 12, overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="airport-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A2348" />
          <stop offset="0.7" stopColor="#0F1734" />
          <stop offset="1" stopColor="#0B1120" />
        </linearGradient>
        <linearGradient id="airport-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A2244" />
          <stop offset="1" stopColor="#070A18" />
        </linearGradient>
        <linearGradient id="airport-terminal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A4A75" />
          <stop offset="1" stopColor="#1F2A4D" />
        </linearGradient>
        <linearGradient id={`airport-jet-${tailColor.replace('#', '')}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tailColor} stopOpacity="0.4" />
          <stop offset="1" stopColor={tailColor} stopOpacity="0.95" />
        </linearGradient>
        <style>{`
          @keyframes pulse-beacon { 0%,100% { opacity: 0.15; } 50% { opacity: 1; } }
          @keyframes pulse-window { 0%,100% { opacity: 0.55; } 50% { opacity: 0.95; } }
          @keyframes drift-vehicle { 0% { transform: translateX(0); } 100% { transform: translateX(60px); } }
          @keyframes drift-vehicle-back { 0% { transform: translateX(60px); } 100% { transform: translateX(0); } }
          @keyframes drift-passenger { 0% { transform: translateX(0); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateX(80px); opacity: 0; } }
          @keyframes belt-scroll { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -16; } }
          @keyframes plane-taxi { 0% { transform: translateX(0); } 50% { transform: translateX(40px); } 100% { transform: translateX(0); } }
          @keyframes runway-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
          @keyframes ghost-pulse { 0%,100% { opacity: 0.25; } 50% { opacity: 0.55; } }
          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; }
          }
        `}</style>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width="400" height="120" fill="url(#airport-sky)" />
      {/* Distant horizon city silhouette */}
      <path
        d="M0 120 L0 95 L30 95 L30 80 L60 80 L60 90 L100 90 L100 70 L140 70 L140 85 L180 85 L180 75 L220 75 L220 92 L260 92 L260 78 L300 78 L300 86 L340 86 L340 80 L380 80 L380 92 L400 92 L400 120 Z"
        fill="#10172E"
        opacity="0.85"
      />
      {/* Twinkling far-city lights */}
      {[
        { x: 35, y: 100 }, { x: 75, y: 92 }, { x: 115, y: 80 },
        { x: 155, y: 92 }, { x: 195, y: 84 }, { x: 235, y: 96 },
        { x: 285, y: 86 }, { x: 325, y: 92 },
      ].map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width="1.6"
          height="1.6"
          fill={tailColor}
          opacity="0.7"
          style={{ animation: `pulse-window ${2.5 + (i % 3)}s ease-in-out ${(i * 0.4)}s infinite` }}
        />
      ))}

      {/* Ground */}
      <rect x="0" y="120" width="400" height="80" fill="url(#airport-ground)" />

      {/* Runway 1 (always present) — clickable zone */}
      <g onClick={tap('runway')} style={{ cursor: onZoneTap ? 'pointer' : 'default' }}>
        <rect x="40" y="155" width="320" height="6" rx="3" fill="#1E293B" />
        {[60, 100, 140, 180, 220, 260, 300, 340].map((cx) => (
          <rect key={cx} x={cx} y={157.5} width="14" height="1" fill="#94A3B8" opacity="0.6" />
        ))}
        {[44, 50, 56].map((cx, i) => (
          <circle key={cx} cx={cx} cy={158} r="1.2" fill={COLOR.gold.base}
            opacity="0.8"
            style={{ animation: `runway-pulse ${1.4 + i * 0.2}s ease-in-out ${i * 0.1}s infinite` }} />
        ))}
        {[346, 352, 358].map((cx, i) => (
          <circle key={cx} cx={cx} cy={158} r="1.2" fill={COLOR.gold.base}
            opacity="0.8"
            style={{ animation: `runway-pulse ${1.4 + i * 0.2}s ease-in-out ${i * 0.1}s infinite` }} />
        ))}
      </g>

      {/* Runway 2 (Tier ≥ 6) */}
      {tier >= 6 && (
        <g onClick={tap('runway')} style={{ cursor: onZoneTap ? 'pointer' : 'default' }}>
          <rect x="40" y="175" width="320" height="6" rx="3" fill="#1E293B" />
          {[60, 100, 140, 180, 220, 260, 300, 340].map((cx) => (
            <rect key={`r2-${cx}`} x={cx} y={177.5} width="14" height="1" fill="#94A3B8" opacity="0.5" />
          ))}
        </g>
      )}

      {/* Apron / taxiway */}
      <rect x="60" y="142" width="220" height="2" fill="#1E293B" opacity="0.7" />

      {/* Terminal — always present, clickable */}
      <g onClick={tap('terminal')} style={{ cursor: onZoneTap ? 'pointer' : 'default' }}>
        <path d="M50 145 L50 125 L70 118 L160 118 L180 125 L180 145 Z" fill="url(#airport-terminal)" />
        <path d="M50 125 L70 118 L160 118 L180 125" stroke={tailColor} strokeOpacity="0.4" strokeWidth="0.8" fill="none" />
        {[55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 165, 175].map((x, i) => (
          <rect
            key={x}
            x={x}
            y={133}
            width="4"
            height="6"
            fill={tailColor}
            opacity="0.55"
            style={{ animation: `pulse-window ${3 + (i % 3)}s ease-in-out ${(i * 0.2)}s infinite` }}
          />
        ))}
        {/* Premium lounge wing — Tier ≥ 5 — clickable as 'lounge' */}
        {tier >= 5 && (
          <g onClick={tap('lounge')}>
            <rect x="62" y="110" width="100" height="9" fill="#314370" stroke={tailColor} strokeOpacity="0.5" strokeWidth="0.6" />
            {[64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144, 152].map((x, i) => (
              <rect key={`up-${x}`} x={x} y={112} width="3" height="4" fill={COLOR.gold.base} opacity="0.7"
                style={{ animation: `pulse-window ${4 + (i % 3)}s ease-in-out ${(i * 0.25)}s infinite` }} />
            ))}
            <text x={68} y={108} fill={COLOR.gold.base} fontSize="3" fontWeight="800" letterSpacing="0.18em">VIP LOUNGE</text>
          </g>
        )}
      </g>

      {/* Gates — clickable as 'gate' */}
      <g onClick={tap('gate')} style={{ cursor: onZoneTap ? 'pointer' : 'default' }}>
        <Gate x={90} tail={tailColor} />
        {tier >= 2 && <Gate x={130} tail={tailColor} />}
        {tier >= 4 && <Gate x={170} tail={tailColor} />}
      </g>

      {/* Control Tower — Tier ≥ 3 — clickable */}
      {tier >= 3 && (
        <g onClick={tap('tower')} style={{ cursor: onZoneTap ? 'pointer' : 'default' }}>
          <rect x="195" y="100" width="6" height="45" fill="#2A3556" />
          <rect x="190" y="92" width="16" height="9" rx="1.5" fill="#3A4A75" />
          <rect x="192" y="94" width="12" height="3" fill="#0F1734" />
          <circle cx="198" cy="92" r="1.5" fill="#F87171" style={{ animation: 'pulse-beacon 1.4s ease-in-out infinite' }} />
        </g>
      )}

      {/* Cargo apron — Tier ≥ 2 — clickable */}
      {tier >= 2 && (
        <g onClick={tap('cargo')} style={{ cursor: onZoneTap ? 'pointer' : 'default' }}>
          <rect x="215" y="138" width="50" height="7" fill="#243254" opacity="0.8" />
          <path d="M218 141.5 L262 141.5" stroke={COLOR.ink.muted} strokeWidth="0.8" strokeDasharray="4 4"
            style={{ animation: 'belt-scroll 1.6s linear infinite' }} />
          <rect x="222" y="139" width="3.5" height="2" fill={COLOR.gold.base} opacity="0.8" />
          <rect x="232" y="139" width="3.5" height="2" fill={COLOR.gold.base} opacity="0.7" />
          <rect x="246" y="139" width="3.5" height="2" fill={COLOR.gold.base} opacity="0.8" />
          {cargoBacklog && (
            <>
              <rect x="216" y="136.5" width="3" height="2" fill={COLOR.gold.base} opacity="0.9" />
              <rect x="220" y="136.5" width="3" height="2" fill={COLOR.gold.base} opacity="0.7" />
              <rect x="226" y="136.5" width="3" height="2" fill={COLOR.gold.light} opacity="0.85" />
              <g style={{ animation: 'drift-vehicle 7s ease-in-out infinite alternate' }}>
                <rect x="218" y="143.5" width="7" height="2" fill={tailColor} opacity="0.85" />
                <circle cx={219} cy={145.5} r="0.6" fill="#0B1120" />
                <circle cx={224} cy={145.5} r="0.6" fill="#0B1120" />
              </g>
            </>
          )}
          <text x={216} y={134} fill={COLOR.ink.faint} fontSize="3" letterSpacing="0.12em">CARGO</text>
        </g>
      )}

      {/* Parking + ground vehicles — Tier ≥ 4 — clickable */}
      {tier >= 4 && (
        <g onClick={tap('parking')} style={{ cursor: onZoneTap ? 'pointer' : 'default' }}>
          <rect x="278" y="138" width="50" height="7" fill="#1E2944" opacity="0.7" />
          {[280, 287, 294, 301, 308, 315, 322].map((cx) => (
            <rect key={cx} x={cx} y={140} width="4" height="2" fill="#3A4A75" />
          ))}
          <g style={{ animation: 'drift-vehicle 4s ease-in-out infinite alternate' }}>
            <rect x="68" y="143" width="6" height="2" fill={COLOR.gold.base} opacity="0.85" />
            <circle cx={69} cy={145} r="0.6" fill="#0B1120" />
            <circle cx={73} cy={145} r="0.6" fill="#0B1120" />
          </g>
          <g style={{ animation: 'drift-vehicle-back 6s ease-in-out infinite alternate' }}>
            <rect x="200" y="143" width="5" height="2" fill={tailColor} opacity="0.85" />
            <circle cx={201} cy={145} r="0.5" fill="#0B1120" />
            <circle cx={204} cy={145} r="0.5" fill="#0B1120" />
          </g>
        </g>
      )}

      {/* Skybridge — Tier ≥ 6 */}
      {tier >= 6 && (
        <path d="M180 122 L210 122" stroke={tailColor} strokeOpacity="0.7" strokeWidth="2.5" />
      )}

      {/* Metro / rail line — Tier ≥ 7 — clickable */}
      {tier >= 7 && (
        <g onClick={tap('metro')} style={{ cursor: onZoneTap ? 'pointer' : 'default' }}>
          <rect x="0" y="190" width="400" height="3" fill="#1A2347" />
          <rect x="50" y="189" width="20" height="5" fill={tailColor} opacity="0.7" />
          <rect x="73" y="189" width="20" height="5" fill={tailColor} opacity="0.7" />
          <rect x="96" y="189" width="20" height="5" fill={tailColor} opacity="0.7" />
          {[10, 30, 130, 150, 170, 250, 270, 290, 350, 370].map((cx) => (
            <rect key={cx} x={cx} y={192} width="6" height="1" fill="#475569" />
          ))}
          <text x={5} y={188} fill={COLOR.ink.faint} fontSize="3" letterSpacing="0.12em">METRO</text>
        </g>
      )}

      {/* Hotel tower — Tier ≥ 8 — clickable */}
      {tier >= 8 && (
        <g onClick={tap('hotel')} style={{ cursor: onZoneTap ? 'pointer' : 'default' }}>
          <rect x="340" y="80" width="20" height="65" fill="#243254" />
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((row) => (
            <g key={row}>
              {[342, 346, 350, 354, 358].map((cx, c) => (
                <rect key={cx} x={cx} y={84 + row * 6} width="2" height="3" fill={COLOR.gold.base} opacity={(c + row) % 2 === 0 ? 0.9 : 0.55}
                  style={{ animation: `pulse-window ${4 + (row % 3)}s ease-in-out ${(row + c) * 0.18}s infinite` }} />
              ))}
            </g>
          ))}
          <text x={341} y={78} fill={COLOR.gold.base} fontSize="2.6" fontWeight="800" letterSpacing="0.1em">HOTEL</text>
        </g>
      )}

      {/* Ghost of next-tier upgrade — drawn faint so the player sees
          what's "almost here" without confusion. */}
      {showNextGhost && <NextTierGhost tier={tier} tailColor={tailColor} />}

      {/* Passenger streams — coloured dots walking from terminal to gates.
          Each dot carries a segment colour: economy/business/tourist/vip.
          The strategy is visible without reading stats. */}
      <PassengerStreams
        count={passengerLoad}
        {...(paxMix ? { mix: paxMix } : {})}
        premium={premium}
        tailColor={tailColor}
      />

      {/* A small plane parked at gate 1, gently taxiing */}
      <g style={{ animation: 'plane-taxi 6s ease-in-out infinite' }}>
        <ParkedPlane cx={95} tailColor={tailColor} />
      </g>
    </svg>
  );
}

function Gate({ x, tail }: { x: number; tail: string }) {
  return (
    <g>
      <rect x={x - 1} y="145" width="2" height="6" fill="#2A3556" />
      <rect x={x - 4} y="143" width="8" height="2.5" fill={tail} opacity="0.75" />
    </g>
  );
}

const SEGMENT_COLOR: Record<PaxSegment, string> = {
  economy: '#5AC8FA',
  business: '#F4C75B',
  tourist: '#34D399',
  vip: '#F8FAFC',
};

function PassengerStreams({
  count, mix, premium, tailColor,
}: {
  count: number;
  mix?: PaxMix;
  premium: boolean;
  tailColor: string;
}) {
  // Build a deterministic ordered list of segments based on the mix.
  // If no mix is provided, default to mostly economy with a sprinkle of
  // business when `premium` is set (legacy behaviour).
  const n = Math.max(0, Math.min(12, count));
  const segments = buildSegmentSequence(n, mix, premium);

  const hasBusiness = segments.includes('business');
  const hasVip = segments.includes('vip');

  return (
    <g aria-hidden>
      {segments.map((seg, i) => {
        const color = SEGMENT_COLOR[seg];
        const startY = 140 + (i % 3) - 1;
        // VIP pax move slower (premium feel); tourist groups walk in pairs.
        const speed = seg === 'vip' ? 5.5 : seg === 'business' ? 3.6 : 4 + (i % 3);
        return (
          <g
            key={i}
            style={{
              animation: `drift-passenger ${speed}s linear ${i * 0.55}s infinite`,
              transformOrigin: '60px 140px',
            }}
          >
            <Passenger x={60} y={startY} color={color} accent={seg === 'vip'} />
          </g>
        );
      })}
      {hasVip && (
        <text x={120} y={108} fill={SEGMENT_COLOR.vip} fontSize="3" fontWeight="800" letterSpacing="0.16em" opacity="0.85">
          ★ VIP ARRIVAL
        </text>
      )}
      {hasBusiness && !hasVip && (
        <text x={120} y={114} fill={SEGMENT_COLOR.business} fontSize="3" fontWeight="800" letterSpacing="0.16em" opacity="0.75">
          BUSINESS CLASS BOARDING
        </text>
      )}
      {/* Subtle accent on the entrance */}
      <circle cx={60} cy={143} r="2" fill={tailColor} opacity="0.18" />
    </g>
  );
}

function buildSegmentSequence(n: number, mix: PaxMix | undefined, premium: boolean): PaxSegment[] {
  if (n === 0) return [];
  const effective: PaxMix = mix ?? {
    economy: Math.max(1, n - (premium ? 2 : 0)),
    business: premium ? 1 : 0,
    tourist: 0,
    vip: premium ? 1 : 0,
  };
  const total = Math.max(1, effective.economy + effective.business + effective.tourist + effective.vip);
  // Allocate slots proportionally; round to ints and pad with economy.
  const econ = Math.round(n * (effective.economy / total));
  const biz = Math.round(n * (effective.business / total));
  const tour = Math.round(n * (effective.tourist / total));
  const vip = Math.round(n * (effective.vip / total));
  const arr: PaxSegment[] = [];
  for (let i = 0; i < econ; i++) arr.push('economy');
  for (let i = 0; i < biz; i++) arr.push('business');
  for (let i = 0; i < tour; i++) arr.push('tourist');
  for (let i = 0; i < vip; i++) arr.push('vip');
  while (arr.length < n) arr.push('economy');
  while (arr.length > n) arr.pop();
  // Interleave so dots don't clump by segment — feels organic.
  const ordered: PaxSegment[] = [];
  let i = 0;
  while (arr.length > 0) {
    const idx = i % arr.length;
    ordered.push(arr[idx]!);
    arr.splice(idx, 1);
    i = (i + 3) % Math.max(1, arr.length);
  }
  return ordered;
}

function Passenger({ x, y, color = '#94A3B8', accent }: { x: number; y?: number; color?: string; accent?: boolean }) {
  return (
    <g transform={`translate(${x}, ${y ?? 138})`}>
      <circle cx="0" cy="0" r={accent ? 1.5 : 1.3} fill={color} />
      <rect x={-1} y={1.2} width="2" height="3" rx="0.5" fill={color} />
      {accent && <circle cx="0" cy="0" r="2.4" fill="none" stroke={color} strokeWidth="0.5" opacity="0.6" />}
    </g>
  );
}

function ParkedPlane({ cx, tailColor }: { cx: number; tailColor: string }) {
  return (
    <g transform={`translate(${cx}, 148)`}>
      <ellipse cx="0" cy="0" rx="6" ry="1.4" fill="#F8FAFC" />
      <path d="M-1 -0.5 L-4 -3 L-2 -3.2 L1 -0.5 Z" fill={tailColor} opacity="0.85" />
      <path d="M-1 0.5 L-4 3 L-2 3.2 L1 0.5 Z" fill={tailColor} opacity="0.85" />
      <path d="M-5 -1 L-7 -2 L-6 0 L-7 2 L-5 1 Z" fill={tailColor} opacity="0.9" />
    </g>
  );
}

/** Faint outline of what the next tier will add. */
function NextTierGhost({ tier, tailColor }: { tier: number; tailColor: string }) {
  const style = { animation: 'ghost-pulse 2.4s ease-in-out infinite' };
  switch (tier + 1) {
    case 2:
      return (
        <g style={style} aria-hidden>
          <rect x={129} y={143} width={2} height={8} fill={tailColor} strokeDasharray="2 2" stroke={tailColor} strokeWidth={0.4} opacity={0.4} />
          <text x={120} y={158} fill={tailColor} fontSize="3" opacity="0.7">+ gate 2</text>
        </g>
      );
    case 3:
      return (
        <g style={style} aria-hidden>
          <rect x={195} y={100} width={6} height={45} fill="none" stroke={tailColor} strokeWidth="0.5" strokeDasharray="2 2" />
          <text x={188} y={97} fill={tailColor} fontSize="3" opacity="0.7">+ tower</text>
        </g>
      );
    case 4:
      return (
        <g style={style} aria-hidden>
          <rect x={278} y={138} width={50} height={7} fill="none" stroke={tailColor} strokeWidth="0.5" strokeDasharray="2 2" />
          <text x={290} y={134} fill={tailColor} fontSize="3" opacity="0.7">+ parking</text>
        </g>
      );
    case 5:
      return (
        <g style={style} aria-hidden>
          <rect x={62} y={110} width={100} height={9} fill="none" stroke={tailColor} strokeWidth="0.5" strokeDasharray="2 2" />
          <text x={88} y={108} fill={tailColor} fontSize="3" opacity="0.7">+ lounge</text>
        </g>
      );
    case 6:
      return (
        <g style={style} aria-hidden>
          <rect x={40} y={175} width={320} height={6} fill="none" stroke={tailColor} strokeWidth="0.5" strokeDasharray="2 2" />
          <text x={160} y={188} fill={tailColor} fontSize="3" opacity="0.7">+ runway 2</text>
        </g>
      );
    case 7:
      return (
        <g style={style} aria-hidden>
          <rect x={0} y={190} width={400} height={3} fill="none" stroke={tailColor} strokeWidth="0.5" strokeDasharray="3 3" />
          <text x={170} y={199} fill={tailColor} fontSize="3" opacity="0.7">+ metro</text>
        </g>
      );
    case 8:
      return (
        <g style={style} aria-hidden>
          <rect x={340} y={80} width={20} height={65} fill="none" stroke={tailColor} strokeWidth="0.5" strokeDasharray="2 2" />
          <text x={324} y={78} fill={tailColor} fontSize="3" opacity="0.7">+ hotel</text>
        </g>
      );
    default:
      return null;
  }
}
