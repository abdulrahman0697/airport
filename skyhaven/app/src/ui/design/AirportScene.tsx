/**
 * AirportScene (Design Review v2 — points 2, 14, 22, 23).
 *
 * A living illustration of the player's home airport. Grows with
 * tier — gates / runways / lounge / tower / parking visibly appear
 * as the player upgrades.
 *
 * Pure SVG, deterministic. The same set of layers always renders;
 * each layer's opacity / visibility is bound to a tier threshold so
 * progression manifests visually.
 *
 *   Tier 1 — single small terminal + one gate + one runway
 *   Tier 2 — adds a second gate + cargo apron
 *   Tier 3 — adds a control tower with a beacon
 *   Tier 4 — adds parking + ground vehicles
 *   Tier 5 — adds a premium lounge wing + lit windows row
 *   Tier 6 — adds a second runway + skybridge
 *   Tier 7 — adds a metro / rail line
 *   Tier 8 — adds a hotel tower
 *
 * Animated ambient activity: passenger silhouettes walking, ground
 * vehicles moving on the apron, tower beacon strobing, baggage belt
 * scrolling. Honours prefers-reduced-motion at the consumer level —
 * the SVG animations are CSS-driven and stop with the OS pref.
 */
import { COLOR } from './tokens';

export interface AirportSceneProps {
  /** Player tier 1..8 — drives which layers render. */
  tier: number;
  /** Airline tail color for tinting jet-bridges, lights, accents. */
  tailColor: string;
  /** Optional width override (px). Height auto from 16:9-ish aspect. */
  width?: number;
}

export function AirportScene({ tier, tailColor, width = 360 }: AirportSceneProps) {
  const height = (width * 200) / 400;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 200"
      role="img"
      aria-label={`Home airport at Tier ${tier}`}
      style={{ display: 'block', borderRadius: 12, overflow: 'hidden' }}
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
          @keyframes drift-passenger { 0% { transform: translateX(0); } 100% { transform: translateX(50px); } }
          @keyframes belt-scroll { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -16; } }
          @keyframes plane-taxi { 0% { transform: translateX(0); } 50% { transform: translateX(40px); } 100% { transform: translateX(0); } }
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

      {/* Runway 1 (always present) */}
      <rect x="40" y="155" width="320" height="6" rx="3" fill="#1E293B" />
      {/* Centerline dashes */}
      {[60, 100, 140, 180, 220, 260, 300, 340].map((cx) => (
        <rect key={cx} x={cx} y={157.5} width="14" height="1" fill="#94A3B8" opacity="0.6" />
      ))}
      {/* Runway approach lights */}
      {[44, 50, 56].map((cx) => (
        <circle key={cx} cx={cx} cy={158} r="1.2" fill={COLOR.gold.base} opacity="0.8" />
      ))}

      {/* Runway 2 (Tier ≥ 6) */}
      {tier >= 6 && (
        <>
          <rect x="40" y="175" width="320" height="6" rx="3" fill="#1E293B" />
          {[60, 100, 140, 180, 220, 260, 300, 340].map((cx) => (
            <rect key={`r2-${cx}`} x={cx} y={177.5} width="14" height="1" fill="#94A3B8" opacity="0.5" />
          ))}
        </>
      )}

      {/* Apron / taxiway */}
      <rect x="60" y="142" width="220" height="2" fill="#1E293B" opacity="0.7" />

      {/* Terminal — always present */}
      <g>
        {/* Main building */}
        <path d="M50 145 L50 125 L70 118 L160 118 L180 125 L180 145 Z" fill="url(#airport-terminal)" />
        {/* Roofline accent */}
        <path d="M50 125 L70 118 L160 118 L180 125" stroke={tailColor} strokeOpacity="0.4" strokeWidth="0.8" fill="none" />
        {/* Front windows row */}
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
        {/* Top floor — only if tier >= 5 ("premium lounge wing") */}
        {tier >= 5 && (
          <>
            <rect x="62" y="110" width="100" height="9" fill="#314370" stroke={tailColor} strokeOpacity="0.5" strokeWidth="0.6" />
            {[64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144, 152].map((x, i) => (
              <rect key={`up-${x}`} x={x} y={112} width="3" height="4" fill={COLOR.gold.base} opacity="0.7"
                style={{ animation: `pulse-window ${4 + (i % 3)}s ease-in-out ${(i * 0.25)}s infinite` }} />
            ))}
            <text x={68} y={108} fill={COLOR.gold.base} fontSize="3" fontWeight="800" letterSpacing="0.18em">VIP LOUNGE</text>
          </>
        )}
      </g>

      {/* Gate 1 — always present */}
      <Gate x={90} tail={tailColor} />
      {/* Gate 2 — Tier ≥ 2 */}
      {tier >= 2 && <Gate x={130} tail={tailColor} />}
      {/* Gate 3 — Tier ≥ 4 */}
      {tier >= 4 && <Gate x={170} tail={tailColor} />}

      {/* Control Tower — Tier ≥ 3 */}
      {tier >= 3 && (
        <g>
          <rect x="195" y="100" width="6" height="45" fill="#2A3556" />
          <rect x="190" y="92" width="16" height="9" rx="1.5" fill="#3A4A75" />
          <rect x="192" y="94" width="12" height="3" fill="#0F1734" />
          <circle cx="198" cy="92" r="1.5" fill="#F87171" style={{ animation: 'pulse-beacon 1.4s ease-in-out infinite' }} />
        </g>
      )}

      {/* Cargo apron — Tier ≥ 2 */}
      {tier >= 2 && (
        <g>
          <rect x="215" y="138" width="50" height="7" fill="#243254" opacity="0.8" />
          {/* Baggage belt */}
          <path d="M218 141.5 L262 141.5" stroke={COLOR.ink.muted} strokeWidth="0.8" strokeDasharray="4 4"
            style={{ animation: 'belt-scroll 1.6s linear infinite' }} />
          {/* Cargo crates */}
          <rect x="222" y="139" width="3.5" height="2" fill={COLOR.gold.base} opacity="0.8" />
          <rect x="232" y="139" width="3.5" height="2" fill={COLOR.gold.base} opacity="0.7" />
          <rect x="246" y="139" width="3.5" height="2" fill={COLOR.gold.base} opacity="0.8" />
          <text x={216} y={134} fill={COLOR.ink.faint} fontSize="3" letterSpacing="0.12em">CARGO</text>
        </g>
      )}

      {/* Parking + ground vehicles — Tier ≥ 4 */}
      {tier >= 4 && (
        <g>
          <rect x="278" y="138" width="50" height="7" fill="#1E2944" opacity="0.7" />
          {/* Parked cars */}
          {[280, 287, 294, 301, 308, 315, 322].map((cx) => (
            <rect key={cx} x={cx} y={140} width="4" height="2" fill="#3A4A75" />
          ))}
          {/* Ground service vehicle drifting on apron */}
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

      {/* Metro / rail line — Tier ≥ 7 */}
      {tier >= 7 && (
        <g>
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

      {/* Hotel tower — Tier ≥ 8 */}
      {tier >= 8 && (
        <g>
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

      {/* Walking passenger silhouettes */}
      <g style={{ animation: 'drift-passenger 5s ease-in-out infinite alternate' }}>
        <Passenger x={75} />
        <Passenger x={82} />
      </g>
      {tier >= 3 && (
        <g style={{ animation: 'drift-passenger 7s ease-in-out infinite alternate' }}>
          <Passenger x={155} />
        </g>
      )}

      {/* A small plane parked at gate 1, gently taxiing */}
      <g style={{ animation: 'plane-taxi 6s ease-in-out infinite' }}>
        <ParkedPlane cx={95} tailColor={tailColor} />
      </g>
    </svg>
  );
}

function Gate({ x, tail }: { x: number; tail: string }) {
  // Jet bridge stub + gate number plate.
  return (
    <g>
      <rect x={x - 1} y="145" width="2" height="6" fill="#2A3556" />
      <rect x={x - 4} y="143" width="8" height="2.5" fill={tail} opacity="0.75" />
    </g>
  );
}

function Passenger({ x }: { x: number }) {
  return (
    <g transform={`translate(${x}, 138)`}>
      <circle cx="0" cy="0" r="1.3" fill="#94A3B8" />
      <rect x={-1} y={1.2} width="2" height="3" rx="0.5" fill="#94A3B8" />
    </g>
  );
}

function ParkedPlane({ cx, tailColor }: { cx: number; tailColor: string }) {
  // Tiny top-down silhouette — fuselage + wings.
  return (
    <g transform={`translate(${cx}, 148)`}>
      {/* Fuselage */}
      <ellipse cx="0" cy="0" rx="6" ry="1.4" fill="#F8FAFC" />
      {/* Wings */}
      <path d="M-1 -0.5 L-4 -3 L-2 -3.2 L1 -0.5 Z" fill={tailColor} opacity="0.85" />
      <path d="M-1 0.5 L-4 3 L-2 3.2 L1 0.5 Z" fill={tailColor} opacity="0.85" />
      {/* Tail fin */}
      <path d="M-5 -1 L-7 -2 L-6 0 L-7 2 L-5 1 Z" fill={tailColor} opacity="0.9" />
    </g>
  );
}
