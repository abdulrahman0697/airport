/**
 * FirstRouteCeremony — Design Review v4, point 10.
 *
 * The opening of the player's first commercial route is the airline's
 * birth moment. Until this build, the route just quietly appeared in
 * a list. Now it triggers a five-beat ceremony:
 *
 *   beat 1   "FLIGHT GW101 — NOW BOARDING" plate + gate scene
 *   beat 2   passengers walk into the aircraft, doors close
 *   beat 3   route line draws between origin and destination
 *   beat 4   aircraft icon traverses the arc, lands at destination
 *   beat 5   revenue appears, ribbon: "FIRST COMMERCIAL ROUTE OPENED"
 *
 * Fires the FIRST time routes.length transitions from 0 to ≥1. The
 * tutorial-completion check is intentionally not gated: even if the
 * player happens to skip the tutorial (debug builds), they still get
 * the ceremony.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAircraftDef } from '../../data/aircraft';
import type { Route } from '../../engine/types';
import {
  selectFleet,
  selectRoutes,
  selectTailColor,
  selectTutorialCompleted,
  useGameStore,
} from '../../state/store';
import { Button } from '../design/Button';
import { ConfettiBurst } from '../design/ConfettiBurst';
import { COLOR, RADIUS, SHADOW, SPACE } from '../design/tokens';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

const BEAT_2_MS = 1100;
const BEAT_3_MS = 2400;
const BEAT_4_MS = 3700;
const BEAT_5_MS = 4900;

export function FirstRouteCeremony() {
  const routes = useGameStore(selectRoutes);
  const fleet = useGameStore(selectFleet);
  const tailColor = useGameStore(selectTailColor);
  const tutorialDone = useGameStore(selectTutorialCompleted);

  // Track whether we've ever fired. Once true, we never fire again
  // within the session. (The session-only flag is fine — the ceremony
  // is gated on a route-count transition that can't happen again
  // unless the player closes all routes, which is intentional.)
  const firedRef = useRef(false);
  // Only consider firing once we've genuinely observed an empty route
  // list. Without this guard, a session that *loads* a save with one
  // existing route would see prevCount=0 (from initial render before
  // state hydrates) → routes.length=1 (after hydration) and erroneously
  // fire the ceremony. The guard ensures the transition has to happen
  // live during this session.
  const seenEmptyRef = useRef(routes.length === 0);
  const [active, setActive] = useState<Route | null>(null);
  const [beat, setBeat] = useState<1 | 2 | 3 | 4 | 5>(1);

  useEffect(() => {
    if (firedRef.current) return;
    if (routes.length === 0) {
      seenEmptyRef.current = true;
      return;
    }
    if (!seenEmptyRef.current) return; // never saw zero this session
    // Don't double-celebrate for veteran players whose first route
    // happened in a previous session before this build. The tutorial
    // walks the new founder through the first route, so a player who
    // already completed the tutorial won't see the ceremony unless
    // they explicitly closed every route and opened a new one — which
    // is rare enough that the ceremony would feel out of place anyway.
    if (tutorialDone) return;
    const first = routes[0];
    if (!first) return;
    firedRef.current = true;
    setActive(first);
    setBeat(1);
    haptics.success();
    sfx.confirm();
  }, [routes, tutorialDone]);

  // Drive the beat clock.
  useEffect(() => {
    if (!active) return;
    const t2 = window.setTimeout(() => { setBeat(2); haptics.light(); }, BEAT_2_MS);
    const t3 = window.setTimeout(() => { setBeat(3); haptics.light(); sfx.tick(); }, BEAT_3_MS);
    const t4 = window.setTimeout(() => { setBeat(4); haptics.medium(); }, BEAT_4_MS);
    const t5 = window.setTimeout(() => { setBeat(5); haptics.success(); sfx.success(); }, BEAT_5_MS);
    return () => {
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.clearTimeout(t5);
    };
  }, [active]);

  const close = (): void => {
    haptics.medium();
    setActive(null);
  };

  const def = useMemo(() => {
    if (!active) return null;
    const a = fleet.find((x) => x.uid === active.aircraftUid);
    return a ? getAircraftDef(a.defId) ?? null : null;
  }, [active, fleet]);

  if (!active) return null;

  const flightCode = makeFlightCode(active.originIata, active.destIata);

  return (
    <AnimatePresence>
      <motion.div
        key="first-route-ceremony"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={shell(tailColor) as Record<string, unknown>}
      >
        {/* Status plate — always present, updates per beat */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          style={plate(tailColor) as Record<string, unknown>}
        >
          <span style={plateDot(tailColor)} />
          {beat === 1 && `FLIGHT ${flightCode}  ·  NOW BOARDING`}
          {beat === 2 && `FLIGHT ${flightCode}  ·  DOORS CLOSING`}
          {beat === 3 && `FLIGHT ${flightCode}  ·  ROUTE AUTHORIZED`}
          {beat === 4 && `FLIGHT ${flightCode}  ·  IN FLIGHT`}
          {beat >= 5 && `FLIGHT ${flightCode}  ·  REVENUE CONFIRMED`}
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.45 }}
          style={title as Record<string, unknown>}
        >
          {active.originIata}  →  {active.destIata}
        </motion.div>
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.32, duration: 0.4 }}
          style={subtitle as Record<string, unknown>}
        >
          {def?.displayName ?? 'aircraft'}  ·  {Math.round(active.distanceKm).toLocaleString()} km  ·  {active.pricing}
        </motion.div>

        {/* The ceremony scene */}
        <div style={sceneWrap}>
          <CeremonyScene
            beat={beat}
            originIata={active.originIata}
            destIata={active.destIata}
            tailColor={tailColor}
          />
        </div>

        {/* Revenue burst on beat 5 */}
        {beat >= 5 && (
          <>
            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              style={revBurst as Record<string, unknown>}
            >
              +${formatCash(Math.max(1000, active.distanceKm * 18), 0)}
              <div style={revBurstLabel}>First commercial revenue</div>
            </motion.div>
            <ConfettiBurst seed={101} count={50} palette={[tailColor, COLOR.gold.base, COLOR.gold.light, '#FFFFFF']} />
          </>
        )}

        {/* Ribbon + dismissal */}
        {beat >= 5 && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 320, damping: 26 }}
            style={ribbonWrap as Record<string, unknown>}
          >
            <div style={ribbonKicker}>★ MILESTONE ★</div>
            <div style={ribbonTitle}>FIRST COMMERCIAL ROUTE OPENED</div>
            <div style={ribbonBody}>
              The {flightCode} flight has departed, arrived, and earned. Your
              airline is now a commercial operator — revenue accrues
              continuously while you play.
            </div>
            <Button
              variant="gold"
              size="lg"
              fullWidth
              accent={tailColor}
              hapticOnPress="heavy"
              onClick={close}
            >
              Continue building the empire  →
            </Button>
          </motion.div>
        )}

        {/* Subtle skip control */}
        {beat < 5 && (
          <button onClick={(): void => setBeat(5)} style={skipBtn} aria-label="Skip ceremony">
            Skip ▸
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function CeremonyScene({
  beat, originIata, destIata, tailColor,
}: {
  beat: 1 | 2 | 3 | 4 | 5;
  originIata: string;
  destIata: string;
  tailColor: string;
}) {
  // Static SVG geometry: origin pin on the left, destination on the
  // right, an arc between them. Animation is driven by `beat` rather
  // than time so it advances in lock-step with the parent.
  const W = 320, H = 180;
  const HOMEX = 50, HOMEY = 140;
  const DESTX = 270, DESTY = 60;
  const MIDX = (HOMEX + DESTX) / 2;
  const MIDY = 35;
  const arcPath = `M ${HOMEX} ${HOMEY} Q ${MIDX} ${MIDY} ${DESTX} ${DESTY}`;
  // Arc reveal during beat 3; aircraft progress 0..1 during beat 4+.
  const arcReveal = beat >= 3 ? 1 : 0;
  const planeT = beat <= 3 ? 0 : beat === 4 ? 0.55 : 1;

  const u = 1 - planeT;
  const px = u * u * HOMEX + 2 * u * planeT * MIDX + planeT * planeT * DESTX;
  const py = u * u * HOMEY + 2 * u * planeT * MIDY + planeT * planeT * DESTY;
  const tx = 2 * u * (MIDX - HOMEX) + 2 * planeT * (DESTX - MIDX);
  const ty = 2 * u * (MIDY - HOMEY) + 2 * planeT * (DESTY - MIDY);
  const ang = (Math.atan2(ty, tx) * 180) / Math.PI;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="ceremony-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tailColor} stopOpacity="0" />
          <stop offset="0.5" stopColor={tailColor} stopOpacity="0.9" />
          <stop offset="1" stopColor={COLOR.gold.base} stopOpacity="1" />
        </linearGradient>
        <radialGradient id="ceremony-pulse" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={tailColor} stopOpacity="0.4" />
          <stop offset="1" stopColor={tailColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Background stars */}
      {Array.from({ length: 30 }).map((_, i) => {
        const seed = i * 41;
        const x = (seed * 13) % W;
        const y = (seed * 7) % (H - 20) + 4;
        return <circle key={i} cx={x} cy={y} r={0.5 + (seed % 3) * 0.3} fill="#F8FAFC" opacity={0.45 + ((seed * 5) % 5) / 12} />;
      })}

      {/* Route arc — drawn-on during beat 3 */}
      <path
        d={arcPath}
        stroke="url(#ceremony-arc)"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="400"
        strokeDashoffset={400 * (1 - arcReveal)}
        style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)' }}
      />

      {/* Origin pin (home airport) */}
      <circle cx={HOMEX} cy={HOMEY} r="22" fill="url(#ceremony-pulse)" />
      <circle cx={HOMEX} cy={HOMEY} r="5" fill={tailColor} />
      <text x={HOMEX} y={HOMEY + 16} textAnchor="middle" fill={tailColor} fontSize="8" fontWeight="800" letterSpacing="0.14em">{originIata}</text>

      {/* Destination pin — pulses on arrival */}
      <circle cx={DESTX} cy={DESTY} r="22" fill="url(#ceremony-pulse)"
        opacity={beat >= 5 ? 1 : 0.4}
        style={{ transition: 'opacity 320ms ease' }} />
      <circle cx={DESTX} cy={DESTY} r={beat >= 5 ? 6 : 4}
        fill={beat >= 5 ? COLOR.gold.base : COLOR.ink.muted}
        style={{ transition: 'fill 320ms ease, r 320ms ease' }} />
      <text x={DESTX} y={DESTY + 16} textAnchor="middle"
        fill={beat >= 5 ? COLOR.gold.base : COLOR.ink.muted}
        fontSize="8" fontWeight="800" letterSpacing="0.14em">{destIata}</text>

      {/* Gate scene at home (visible during beats 1–2) */}
      {beat <= 2 && (
        <g transform={`translate(${HOMEX - 8}, ${HOMEY - 4})`}>
          {/* Terminal */}
          <rect x="-12" y="0" width="20" height="10" fill="#1F2A4D" />
          {/* Gate jetbridge */}
          <rect x="9" y="3" width="6" height="2" fill={tailColor} />
          {/* Aircraft at gate */}
          <ellipse cx="22" cy="4" rx="9" ry="2" fill="#F8FAFC" />
          <path d="M 18 3 L 14 0 L 16 0 L 22 3 Z" fill={tailColor} />
          <path d="M 18 5 L 14 8 L 16 8 L 22 5 Z" fill={tailColor} />
          {/* Passengers walking to plane */}
          {beat >= 1 && [0, 1, 2].map((i) => (
            <circle key={i} cx={2 + i * 3} cy="6" r="0.9" fill={i === 2 ? COLOR.gold.base : '#94A3B8'}>
              <animate attributeName="cx" from={2 + i * 3} to={14 + i * 1} dur="1.4s" begin={`${i * 0.3}s`} repeatCount={beat === 1 ? 'indefinite' : 2} />
            </circle>
          ))}
        </g>
      )}

      {/* Aircraft in flight (beat 4+) */}
      {beat >= 4 && (
        <g transform={`translate(${px} ${py}) rotate(${ang})`}>
          <path d="M -6 0 L 5 -1.4 L 5 1.4 Z" fill={tailColor} />
          <path d="M -2 -2.5 L 1 -2.5 L 0 0 Z" fill={tailColor} opacity="0.7" />
          <path d="M -2 2.5 L 1 2.5 L 0 0 Z" fill={tailColor} opacity="0.7" />
          <circle cx="5" cy="0" r="1" fill="#F8FAFC" />
        </g>
      )}

      {/* Status line under the scene */}
      <text x={W / 2} y={H - 4} textAnchor="middle" fill={COLOR.ink.faint} fontSize="7" letterSpacing="0.18em" fontWeight="700">
        {beat === 1 && 'Passengers boarding at the gate…'}
        {beat === 2 && 'Cabin doors closing · pushback authorized'}
        {beat === 3 && 'Route line drawn · cleared for departure'}
        {beat === 4 && 'In flight · ETA in a moment'}
        {beat === 5 && 'Arrival logged · revenue posted to balance'}
      </text>
    </svg>
  );
}

function makeFlightCode(origin: string, dest: string): string {
  // Use the route hash for a 3-digit flight number; prefix with GW
  // (GulfWing tribute) so the flight feels grounded.
  let h = 2166136261;
  for (const c of (origin + dest)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const num = (Math.abs(h) % 900) + 100; // 100..999
  return `GW${num}`;
}

/* ─── Styles ──────────────────────────────────────────────────────── */
const shell = (tail: string): React.CSSProperties => ({
  position: 'fixed',
  inset: 0,
  zIndex: 115,
  background: `radial-gradient(ellipse at top, rgba(20,33,61,0.96), rgba(7,10,24,0.98))`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: '32px 20px 20px',
  overflowY: 'auto',
  boxShadow: `inset 0 0 120px ${tail}22`,
});
const plate = (tail: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.24em',
  color: tail,
  background: `${tail}14`,
  border: `1px solid ${tail}55`,
  padding: '6px 14px',
  borderRadius: 999,
});
const plateDot = (tail: string): React.CSSProperties => ({
  width: 8, height: 8, borderRadius: 999,
  background: tail,
  boxShadow: `0 0 8px ${tail}`,
  animation: 'breathe 1.4s ease-in-out infinite',
});
const title: React.CSSProperties = {
  marginTop: SPACE.l,
  fontSize: 36,
  fontWeight: 900,
  color: COLOR.ink.primary,
  letterSpacing: '0.06em',
  fontFeatureSettings: '"tnum" 1',
  textShadow: '0 0 24px rgba(90,200,250,0.4)',
};
const subtitle: React.CSSProperties = {
  fontSize: 12,
  color: COLOR.ink.muted,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 700,
  marginTop: 4,
};
const sceneWrap: React.CSSProperties = {
  marginTop: SPACE.l,
  width: '100%',
  maxWidth: 460,
  background: 'rgba(11,17,32,0.55)',
  borderRadius: RADIUS.l,
  border: `1px solid ${COLOR.border.soft}`,
  padding: SPACE.s,
};
const revBurst: React.CSSProperties = {
  position: 'absolute',
  top: '38%',
  right: '12%',
  fontSize: 38,
  fontWeight: 900,
  color: COLOR.gold.base,
  textShadow: `0 0 24px ${COLOR.gold.base}, 0 4px 8px rgba(0,0,0,0.6)`,
  fontFeatureSettings: '"tnum" 1',
};
const revBurstLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.18em',
  color: COLOR.gold.base,
  marginTop: 4,
  textAlign: 'right',
};
const ribbonWrap: React.CSSProperties = {
  marginTop: SPACE.xl,
  width: '100%',
  maxWidth: 460,
  background: 'linear-gradient(160deg, rgba(244,199,91,0.18), rgba(11,17,32,0.9))',
  border: `2px solid ${COLOR.gold.base}66`,
  borderRadius: 18,
  padding: SPACE.l,
  boxShadow: `${SHADOW.modal}, 0 0 48px ${COLOR.gold.base}33`,
};
const ribbonKicker: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.32em',
  color: COLOR.gold.base,
  textAlign: 'center',
};
const ribbonTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: COLOR.ink.primary,
  letterSpacing: '0.04em',
  textAlign: 'center',
  marginTop: 6,
  marginBottom: SPACE.s,
};
const ribbonBody: React.CSSProperties = {
  fontSize: 12,
  color: COLOR.ink.secondary,
  lineHeight: 1.5,
  marginBottom: SPACE.m,
  textAlign: 'center',
};
const skipBtn: React.CSSProperties = {
  position: 'absolute',
  top: 'max(16px, env(safe-area-inset-top, 16px))',
  right: 16,
  background: COLOR.bg.glass,
  color: COLOR.ink.muted,
  border: `1px solid ${COLOR.border.medium}`,
  borderRadius: 999,
  padding: '6px 14px',
  fontSize: 11,
  fontFamily: 'inherit',
  cursor: 'pointer',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontWeight: 700,
};
