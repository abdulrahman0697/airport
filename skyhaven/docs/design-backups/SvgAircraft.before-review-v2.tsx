/**
 * Programmatic aircraft illustrations (Design pass D1).
 *
 * 46 aircraft × hand-drawn art is unrealistic, so we bucket by
 * category + tier into 9 stylised silhouettes that capture the era /
 * size of each grouping. Each silhouette accepts the airline's
 * `tailColor` so the fleet feels like *yours*, not a stock template.
 *
 * Designed as side-elevation SVGs with viewBox 0 0 320 100 — caller
 * controls render size via CSS. Use `<AircraftIllustration>` from any
 * place a card / modal needs the visual.
 */
import { getAircraftDef } from '../../data/aircraft';
import type { AircraftDef } from '../../engine/types';
import { COLOR } from './tokens';

export interface AircraftIllustrationProps {
  defId: string;
  tailColor: string;
  /** Display width in px. Height auto-scales (aspect 320:100). */
  width?: number;
  /** Optional CSS override (margin, etc.). */
  style?: React.CSSProperties;
}

export function AircraftIllustration({
  defId,
  tailColor,
  width = 280,
  style,
}: AircraftIllustrationProps) {
  const def = getAircraftDef(defId);
  if (!def) return null;
  const variant = pickVariant(def);
  const height = (width * 100) / 320;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 320 100"
      style={{ display: 'block', ...style }}
      role="img"
      aria-label={`${def.displayName} silhouette`}
    >
      <defs>
        <linearGradient id={`fuselage-${defId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8FAFC" />
          <stop offset="0.55" stopColor="#CBD5E1" />
          <stop offset="1" stopColor="#94A3B8" />
        </linearGradient>
        <linearGradient id={`tail-${defId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tailColor} stopOpacity="1" />
          <stop offset="1" stopColor={tailColor} stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id={`stripe-${defId}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tailColor} stopOpacity="0.0" />
          <stop offset="0.18" stopColor={tailColor} stopOpacity="0.55" />
          <stop offset="1" stopColor={tailColor} stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {variant === 'turboprop'   && <TurbopropArt   id={defId} />}
      {variant === 'regional'    && <RegionalJetArt id={defId} />}
      {variant === 'narrowbody'  && <NarrowbodyArt  id={defId} />}
      {variant === 'narrowxl'    && <NarrowXLArt    id={defId} />}
      {variant === 'widebody'    && <WidebodyArt    id={defId} />}
      {variant === 'widejumbo'   && <WideJumboArt   id={defId} />}
      {variant === 'megaliner'   && <MegaLinerArt   id={defId} />}
      {variant === 'cargo'       && <CargoArt       id={defId} />}
      {variant === 'classic'     && <ClassicArt     id={defId} />}
    </svg>
  );
}

type Variant =
  | 'turboprop'
  | 'regional'
  | 'narrowbody'
  | 'narrowxl'
  | 'widebody'
  | 'widejumbo'
  | 'megaliner'
  | 'cargo'
  | 'classic';

function pickVariant(def: AircraftDef): Variant {
  if (def.category === 'cargo') return 'cargo';
  if (def.id.startsWith('classic.')) return 'classic';
  if (def.tier === 1) return 'turboprop';
  if (def.tier === 2) return 'regional';
  if (def.tier === 3 || def.tier === 4) return 'narrowbody';
  if (def.tier === 5) return 'widebody';
  if (def.tier === 6 || def.tier === 7) return 'widejumbo';
  if (def.tier >= 8) return 'megaliner';
  // Long-range narrowbody variants are visually "narrowxl"
  if (def.id.endsWith('xlr')) return 'narrowxl';
  return 'narrowbody';
}

/* ─── Shared sub-shapes ──────────────────────────────────────────── */

function Engine({ cx, cy, r, tail }: { cx: number; cy: number; r: number; tail: string }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={r * 1.5} ry={r} fill="#1E293B" />
      <ellipse cx={cx + r * 0.3} cy={cy} rx={r * 1.2} ry={r * 0.8} fill={tail} opacity={0.92} />
      <ellipse cx={cx - r * 0.8} cy={cy} rx={r * 0.35} ry={r * 0.55} fill="#0B1120" />
    </g>
  );
}

function Window({ cx, cy }: { cx: number; cy: number }) {
  return <rect x={cx - 1.6} y={cy - 1.1} width={3.2} height={2.2} rx={0.5} fill="#0B1120" />;
}

function PassengerWindows({ y, x0, x1, gap = 6 }: { y: number; x0: number; x1: number; gap?: number }) {
  const els: React.ReactNode[] = [];
  for (let x = x0; x <= x1; x += gap) {
    els.push(<Window key={x} cx={x} cy={y} />);
  }
  return <>{els}</>;
}

/* ─── Variant 1: turboprop (T1) ──────────────────────────────────── */

function TurbopropArt({ id }: { id: string }) {
  return (
    <g>
      {/* High wing */}
      <path d="M 80 35 L 240 32 L 240 40 L 80 43 Z" fill={`url(#tail-${id})`} opacity="0.85" />
      <path d="M 80 35 L 240 32 L 240 36 L 80 39 Z" fill={`url(#stripe-${id})`} />

      {/* Fuselage */}
      <path d="M 30 50 Q 50 42 90 42 L 240 42 Q 270 42 280 50 Q 270 58 240 58 L 90 58 Q 50 58 30 50 Z"
            fill={`url(#fuselage-${id})`} />

      {/* Nose cone */}
      <path d="M 30 50 Q 18 50 18 50 Q 18 50 30 50 Z" fill="#94A3B8" />

      {/* Tail fin */}
      <path d="M 240 42 L 268 22 L 280 22 L 270 42 Z" fill={`url(#tail-${id})`} />
      <path d="M 240 58 L 280 70 L 268 70 L 240 60 Z" fill="#94A3B8" opacity="0.55" />

      {/* Cockpit */}
      <path d="M 40 48 Q 45 44 50 46 L 55 47 L 55 50 L 40 50 Z" fill="#0B1120" opacity="0.85" />

      {/* Windows */}
      <PassengerWindows y={50} x0={68} x1={230} gap={8} />

      {/* Two propeller engines on wing */}
      <ellipse cx={140} cy={36} rx={9} ry={5} fill="#1E293B" />
      <ellipse cx={140} cy={36} rx={6} ry={3.5} fill="#0B1120" />
      <line x1={140} y1={30} x2={140} y2={42} stroke="#475569" strokeWidth="1" />
      <line x1={134} y1={36} x2={146} y2={36} stroke="#475569" strokeWidth="1" />

      <ellipse cx={200} cy={36} rx={9} ry={5} fill="#1E293B" />
      <ellipse cx={200} cy={36} rx={6} ry={3.5} fill="#0B1120" />
      <line x1={200} y1={30} x2={200} y2={42} stroke="#475569" strokeWidth="1" />
      <line x1={194} y1={36} x2={206} y2={36} stroke="#475569" strokeWidth="1" />
    </g>
  );
}

/* ─── Variant 2: regional jet (T2) ───────────────────────────────── */

function RegionalJetArt({ id }: { id: string }) {
  return (
    <g>
      {/* Low wing */}
      <path d="M 80 56 L 250 54 L 250 62 L 80 64 Z" fill={`url(#tail-${id})`} opacity="0.85" />

      {/* Fuselage */}
      <path d="M 28 50 Q 48 42 88 42 L 250 42 Q 285 42 300 50 Q 285 58 250 58 L 88 58 Q 48 58 28 50 Z"
            fill={`url(#fuselage-${id})`} />

      {/* Cockpit */}
      <path d="M 36 48 Q 44 44 52 47 L 56 49 L 36 49 Z" fill="#0B1120" opacity="0.9" />

      {/* T-tail */}
      <path d="M 250 42 L 280 20 L 296 20 L 288 38 L 270 42 Z" fill={`url(#tail-${id})`} />
      <rect x={260} y={18} width={36} height={4} fill={`url(#stripe-${id})`} />

      {/* Windows */}
      <PassengerWindows y={50} x0={70} x1={240} gap={7} />

      {/* Engines mounted on rear fuselage */}
      <Engine cx={232} cy={50} r={5} tail={COLOR.ink.faint} />

      {/* Tail stripe */}
      <rect x={80} y={49} width={170} height={2.5} fill={`url(#stripe-${id})`} />
    </g>
  );
}

/* ─── Variant 3: narrowbody (T3-T4) ──────────────────────────────── */

function NarrowbodyArt({ id }: { id: string }) {
  return (
    <g>
      {/* Wing (swept) */}
      <path d="M 100 58 L 220 53 L 260 64 L 240 68 L 120 66 Z" fill={`url(#tail-${id})`} opacity="0.85" />

      {/* Fuselage */}
      <path d="M 22 50 Q 42 40 88 40 L 252 40 Q 290 40 308 50 Q 290 60 252 60 L 88 60 Q 42 60 22 50 Z"
            fill={`url(#fuselage-${id})`} />

      {/* Belly stripe */}
      <path d="M 30 54 Q 50 56 90 56 L 250 56 Q 282 56 296 54 L 296 58 Q 282 60 250 60 L 90 60 Q 50 60 30 58 Z"
            fill={`url(#stripe-${id})`} opacity="0.6" />

      {/* Cockpit */}
      <path d="M 32 47 Q 42 43 54 46 L 58 49 L 32 50 Z" fill="#0B1120" opacity="0.9" />

      {/* Tail fin */}
      <path d="M 252 40 L 290 14 L 304 14 L 296 36 L 270 40 Z" fill={`url(#tail-${id})`} />

      {/* Horizontal stab */}
      <path d="M 268 40 L 312 36 L 312 44 L 268 44 Z" fill={`url(#tail-${id})`} opacity="0.75" />

      {/* Windows */}
      <PassengerWindows y={48} x0={64} x1={244} gap={6} />

      {/* Underwing engines */}
      <Engine cx={150} cy={66} r={6} tail={COLOR.ink.faint} />
      <Engine cx={190} cy={66} r={6} tail={COLOR.ink.faint} />
    </g>
  );
}

/* ─── Variant 3b: narrowbody XL (long range) ─────────────────────── */

function NarrowXLArt({ id }: { id: string }) {
  return (
    <g>
      <NarrowbodyArt id={id} />
      {/* Extra winglets */}
      <path d="M 254 64 L 263 60 L 265 64 Z" fill={`url(#tail-${id})`} />
      <path d="M 117 65 L 109 60 L 108 64 Z" fill={`url(#tail-${id})`} />
    </g>
  );
}

/* ─── Variant 4: widebody (T5) ───────────────────────────────────── */

function WidebodyArt({ id }: { id: string }) {
  return (
    <g>
      {/* Wing */}
      <path d="M 90 60 L 230 53 L 280 70 L 240 74 L 110 70 Z" fill={`url(#tail-${id})`} opacity="0.88" />

      {/* Fat fuselage */}
      <path d="M 16 50 Q 40 36 84 36 L 256 36 Q 296 36 314 50 Q 296 64 256 64 L 84 64 Q 40 64 16 50 Z"
            fill={`url(#fuselage-${id})`} />

      {/* Cockpit + nose dome */}
      <path d="M 24 48 Q 36 42 52 45 L 58 49 L 24 50 Z" fill="#0B1120" opacity="0.92" />

      {/* Belly stripe accent */}
      <rect x={70} y={49} width={200} height={3} fill={`url(#stripe-${id})`} opacity="0.7" />

      {/* Tail fin */}
      <path d="M 254 36 L 292 8 L 308 8 L 298 34 L 268 36 Z" fill={`url(#tail-${id})`} />
      <path d="M 272 36 L 314 32 L 314 42 L 272 42 Z" fill={`url(#tail-${id})`} opacity="0.7" />

      {/* Windows — double row for the wide */}
      <PassengerWindows y={45} x0={60} x1={248} gap={6} />
      <PassengerWindows y={54} x0={62} x1={246} gap={6} />

      {/* Underwing engines */}
      <Engine cx={142} cy={72} r={7} tail={COLOR.ink.faint} />
      <Engine cx={196} cy={72} r={7} tail={COLOR.ink.faint} />
    </g>
  );
}

/* ─── Variant 5: wide jumbo (T6-T7) ──────────────────────────────── */

function WideJumboArt({ id }: { id: string }) {
  return (
    <g>
      {/* Wing — wider, more sweep */}
      <path d="M 70 62 L 250 50 L 304 76 L 260 80 L 100 76 Z" fill={`url(#tail-${id})`} opacity="0.88" />

      {/* Fuselage */}
      <path d="M 14 50 Q 38 32 80 32 L 264 32 Q 304 32 316 50 Q 304 68 264 68 L 80 68 Q 38 68 14 50 Z"
            fill={`url(#fuselage-${id})`} />

      {/* Belly accent */}
      <rect x={62} y={50} width={216} height={3.5} fill={`url(#stripe-${id})`} opacity="0.65" />

      {/* Cockpit */}
      <path d="M 22 49 Q 36 41 54 44 L 60 49 L 22 50 Z" fill="#0B1120" opacity="0.92" />

      {/* Tail fin */}
      <path d="M 262 32 L 298 2 L 314 2 L 302 30 L 276 32 Z" fill={`url(#tail-${id})`} />
      <path d="M 280 32 L 318 28 L 318 38 L 280 38 Z" fill={`url(#tail-${id})`} opacity="0.7" />

      {/* Windows */}
      <PassengerWindows y={42} x0={56} x1={258} gap={5.5} />
      <PassengerWindows y={56} x0={58} x1={256} gap={5.5} />

      {/* 4 underwing engines */}
      <Engine cx={120} cy={78} r={6.5} tail={COLOR.ink.faint} />
      <Engine cx={160} cy={78} r={6.5} tail={COLOR.ink.faint} />
      <Engine cx={200} cy={78} r={6.5} tail={COLOR.ink.faint} />
      <Engine cx={240} cy={78} r={6.5} tail={COLOR.ink.faint} />
    </g>
  );
}

/* ─── Variant 6: mega-liner (T8 A380-class) ──────────────────────── */

function MegaLinerArt({ id }: { id: string }) {
  return (
    <g>
      {/* Wing */}
      <path d="M 60 64 L 252 52 L 310 78 L 260 82 L 90 78 Z" fill={`url(#tail-${id})`} opacity="0.9" />

      {/* Double-deck fuselage */}
      <path d="M 10 50 Q 36 28 76 28 L 268 28 Q 306 28 318 50 Q 306 72 268 72 L 76 72 Q 36 72 10 50 Z"
            fill={`url(#fuselage-${id})`} />

      {/* Upper-deck distinctive bump line */}
      <path d="M 30 38 L 110 30 L 110 34 L 30 42 Z" fill="#94A3B8" opacity="0.55" />

      {/* Cockpit */}
      <path d="M 18 48 Q 34 38 56 42 L 64 49 L 18 50 Z" fill="#0B1120" opacity="0.94" />

      {/* Belly stripe */}
      <rect x={52} y={50} width={228} height={4} fill={`url(#stripe-${id})`} opacity="0.7" />

      {/* Tail fin */}
      <path d="M 266 28 L 302 -2 L 318 -2 L 304 28 L 280 28 Z" fill={`url(#tail-${id})`} />
      <path d="M 284 28 L 318 24 L 318 36 L 284 36 Z" fill={`url(#tail-${id})`} opacity="0.7" />

      {/* Triple-row windows */}
      <PassengerWindows y={36} x0={54} x1={260} gap={5} />
      <PassengerWindows y={48} x0={56} x1={260} gap={5} />
      <PassengerWindows y={60} x0={58} x1={258} gap={5} />

      {/* 4 large engines */}
      <Engine cx={120} cy={80} r={7.5} tail={COLOR.ink.faint} />
      <Engine cx={166} cy={80} r={7.5} tail={COLOR.ink.faint} />
      <Engine cx={210} cy={80} r={7.5} tail={COLOR.ink.faint} />
      <Engine cx={250} cy={80} r={7.5} tail={COLOR.ink.faint} />
    </g>
  );
}

/* ─── Variant 7: cargo ───────────────────────────────────────────── */

function CargoArt({ id }: { id: string }) {
  return (
    <g>
      {/* Wing (high) */}
      <path d="M 70 36 L 252 34 L 252 44 L 70 46 Z" fill={`url(#tail-${id})`} opacity="0.88" />

      {/* Boxy fuselage with nose that lifts */}
      <path d="M 18 50 Q 36 40 82 40 L 254 40 Q 290 40 306 50 Q 290 62 254 62 L 82 62 Q 36 62 18 50 Z"
            fill={`url(#fuselage-${id})`} />

      {/* Nose hinge line (signature freighter look) */}
      <line x1={56} y1={40} x2={70} y2={50} stroke="#475569" strokeWidth="1" />
      <line x1={56} y1={60} x2={70} y2={50} stroke="#475569" strokeWidth="1" />

      {/* Cargo door rectangle */}
      <rect x={120} y={44} width={80} height={14} fill="#94A3B8" opacity="0.35" />

      {/* Cockpit */}
      <path d="M 30 48 Q 42 44 54 46 L 58 49 L 30 49 Z" fill="#0B1120" opacity="0.9" />

      {/* Tail */}
      <path d="M 256 40 L 290 10 L 304 10 L 294 38 L 274 40 Z" fill={`url(#tail-${id})`} />
      <path d="M 272 40 L 312 36 L 312 44 L 272 44 Z" fill={`url(#tail-${id})`} opacity="0.7" />

      {/* Two big engines */}
      <Engine cx={140} cy={38} r={7} tail={COLOR.ink.faint} />
      <Engine cx={200} cy={38} r={7} tail={COLOR.ink.faint} />
    </g>
  );
}

/* ─── Variant 8: classic (1960s prop / DC-3 vibe) ────────────────── */

function ClassicArt({ id }: { id: string }) {
  return (
    <g>
      {/* Low-set tapered wing */}
      <path d="M 90 56 L 230 52 L 230 60 L 90 64 Z" fill={`url(#tail-${id})`} opacity="0.9" />

      {/* Slim fuselage */}
      <path d="M 24 50 Q 42 44 84 44 L 248 44 Q 280 44 296 50 Q 280 56 248 56 L 84 56 Q 42 56 24 50 Z"
            fill={`url(#fuselage-${id})`} />

      {/* Riveted seam highlights for the vintage feel */}
      <line x1={70} y1={47} x2={246} y2={47} stroke="#94A3B8" strokeWidth="0.4" opacity="0.5" />
      <line x1={70} y1={53} x2={246} y2={53} stroke="#94A3B8" strokeWidth="0.4" opacity="0.5" />

      {/* Round windows */}
      {[80, 100, 120, 140, 160, 180, 200, 220].map((x) => (
        <circle key={x} cx={x} cy={50} r={1.6} fill="#0B1120" />
      ))}

      {/* Two prop engines */}
      <ellipse cx={148} cy={36} rx={10} ry={5} fill="#1E293B" />
      <ellipse cx={148} cy={36} rx={6} ry={3.5} fill="#0B1120" />
      <line x1={148} y1={28} x2={148} y2={44} stroke="#475569" strokeWidth="1" />
      <line x1={140} y1={36} x2={156} y2={36} stroke="#475569" strokeWidth="1" />

      <ellipse cx={196} cy={36} rx={10} ry={5} fill="#1E293B" />
      <ellipse cx={196} cy={36} rx={6} ry={3.5} fill="#0B1120" />
      <line x1={196} y1={28} x2={196} y2={44} stroke="#475569" strokeWidth="1" />
      <line x1={188} y1={36} x2={204} y2={36} stroke="#475569" strokeWidth="1" />

      {/* Tail (small classic) */}
      <path d="M 248 44 L 274 24 L 286 24 L 280 42 L 264 44 Z" fill={`url(#tail-${id})`} />

      {/* Vintage stripe along the body */}
      <rect x={70} y={48.5} width={180} height={1.5} fill={`url(#stripe-${id})`} />
    </g>
  );
}
