/**
 * First-Takeoff Cinematic (Design Review v2 — point 1).
 *
 * The first 30 seconds of the new-player experience. Plays once,
 * between IntroSplash dismissal and the live world view. Six beats:
 *
 *   1. Curtain rise — dark backdrop, fade in.
 *   2. Pan over a small regional airport: one gate, one runway, three
 *      tiny passenger silhouettes walking to the gate.
 *   3. Aircraft (Tier-1 turboprop) pushes back from the gate and
 *      taxis along the runway to centre stage.
 *   4. Takeoff arc — the plane climbs from the runway up across the
 *      sky, leaving a soft contrail.
 *   5. Money burst at the top of the arc: "+$5 000" in gold,
 *      confetti pop, brief satisfying chime.
 *   6. Welcome card slides in: "Your first route is live. Welcome to
 *      your aviation empire." with a single CTA to enter the world.
 *
 * Skippable at any time via the corner skip-affordance (tap anywhere
 * inside the "skip" target). Honours prefers-reduced-motion by
 * collapsing the timing.
 *
 * Mounts under `uiStore.cinematicSeen === false`. On dismissal, sets
 * the flag so it never replays.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { selectTailColor, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { ConfettiBurst } from '../design/ConfettiBurst';
import { AircraftIllustration } from '../design/SvgAircraft';
import { COLOR, MOTION, RADIUS, SPACE } from '../design/tokens';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

// Design Review v6 — point 3. The cinematic is now a clean 5-second
// sequence with a single text overlay at the end ("First flight
// cleared.") instead of a welcome card. The next surface (FounderCard
// / HomeShell) takes over directly.
const TOTAL_MS = 5000;

export function FirstTakeoffCinematic() {
  const tailColor = useGameStore(selectTailColor);
  const cinematicSeen = useUiStore((s) => s.cinematicSeen);
  const markCinematicSeen = useUiStore((s) => s.markCinematicSeen);
  const introDismissed = useUiStore((s) => s.introDismissed);
  const tutorialCompleted = useGameStore((s) => s.state?.tutorialCompleted ?? true);

  // Track stage so beats progress reliably even if the device is slow.
  const [stage, setStage] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);

  const visible = introDismissed && !tutorialCompleted && !cinematicSeen;

  // Drive the timeline once mounted.
  useEffect(() => {
    if (!visible) return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setStage(1), 200));   // walking (boarding)
    timers.push(window.setTimeout(() => { setStage(2); haptics.medium(); }, 1300)); // pushback
    timers.push(window.setTimeout(() => { setStage(3); sfx.confirm(); }, 2300));    // takeoff
    timers.push(window.setTimeout(() => { setStage(4); haptics.success(); sfx.success(); }, 3600)); // money burst + status
    // At TOTAL_MS we auto-mark the cinematic as seen and clear it.
    // No welcome card — the founder flow takes over directly.
    timers.push(window.setTimeout(() => { markCinematicSeen(); }, TOTAL_MS));
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [visible, markCinematicSeen]);

  const skip = (): void => {
    haptics.light();
    sfx.tick();
    markCinematicSeen();
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="cinematic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: MOTION.duration.medium / 1000 }}
        style={shell as Record<string, unknown>}
      >
        {/* Sky gradient + stars */}
        <div style={sky(tailColor)} aria-hidden />
        <Stars />

        {/* Skyline silhouette */}
        <Skyline tailColor={tailColor} />

        {/* Airport ground layer (always visible) */}
        <Ground />
        <Terminal />
        <Gate stage={stage} tailColor={tailColor} />
        <Runway stage={stage} />
        <Passengers stage={stage} />

        {/* Aircraft animated through stages */}
        <Aircraft stage={stage} tailColor={tailColor} />

        {/* Destination plate appears just before the money burst —
            grounds the player: this wasn't a number out of nowhere,
            this was a flight that flew somewhere and earned. */}
        {stage >= 3 && stage < 4 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            style={routePlate as Record<string, unknown>}
          >
            DXB  →  MCT  ·  348 KM  ·  ATR 42
          </motion.div>
        )}

        {/* Money burst at peak */}
        {stage >= 4 && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.6 }}
              animate={{ opacity: 1, y: -30, scale: 1.0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              style={moneyBurst as Record<string, unknown>}
            >
              +$5 000
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              style={moneyCaption as Record<string, unknown>}
            >
              First Flight Revenue · DXB → MCT
            </motion.div>
            <ConfettiBurst seed={42} count={60} palette={[tailColor, COLOR.gold.base, COLOR.gold.light, '#FFFFFF']} />
          </>
        )}

        {/* Top status banner */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={statusBanner as Record<string, unknown>}
        >
          <span style={statusDot} />
          {stage <= 1 && 'BOARDING IN PROGRESS'}
          {stage === 2 && 'PUSHBACK CONFIRMED'}
          {stage === 3 && 'CLEARED FOR DEPARTURE'}
          {stage >= 4 && 'YOUR FIRST FLIGHT — AIRBORNE'}
        </motion.div>

        {/* Clean text overlay — Design Review v6 point 3. Replaces
            the bulky welcome card. The next surface (FounderCard) is
            what the player wants to interact with; no panel here. */}
        <AnimatePresence>
          {stage >= 4 && (
            <motion.div
              key="cleared"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
              style={clearedOverlay as Record<string, unknown>}
            >
              <div style={clearedKicker(tailColor)}>★ FIRST FLIGHT CLEARED ★</div>
              <div style={clearedBody}>+$5 000 logged · ready for the founder flow</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skip control (always visible) */}
        {stage < 4 && (
          <button onClick={skip} style={skipBtn} aria-label="Skip intro">
            Skip ▸
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Scene sub-components ─────────────────────────────────────── */

function Stars() {
  return (
    <svg style={absFull} viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {Array.from({ length: 60 }).map((_, i) => {
        const x = (i * 73) % 800;
        const y = ((i * 41) % 250) + 10;
        const r = 0.6 + ((i * 17) % 10) / 10;
        return <circle key={i} cx={x} cy={y} r={r} fill="#F8FAFC" opacity={0.4 + ((i * 11) % 5) / 12} />;
      })}
    </svg>
  );
}

function Skyline({ tailColor }: { tailColor: string }) {
  // Distant city silhouette behind the airport.
  return (
    <svg style={skylineStyle} viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="cine-skyline" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B2347" />
          <stop offset="1" stopColor="#0A0F1F" />
        </linearGradient>
      </defs>
      <path
        d="M0 300 L0 240 L40 240 L40 200 L80 200 L80 220 L130 220 L130 170 L180 170 L180 210 L240 210 L240 180 L300 180 L300 200 L360 200 L360 160 L420 160 L420 200 L480 200 L480 230 L540 230 L540 180 L600 180 L600 210 L660 210 L660 170 L720 170 L720 200 L800 200 L800 300 Z"
        fill="url(#cine-skyline)"
      />
      {/* A few lit windows */}
      {[
        { x: 50, y: 215 }, { x: 140, y: 190 }, { x: 250, y: 195 },
        { x: 370, y: 175 }, { x: 490, y: 215 }, { x: 610, y: 195 }, { x: 670, y: 185 },
      ].map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width="3" height="3" fill={tailColor} opacity="0.7">
          <animate attributeName="opacity" values="0.4;0.95;0.4" dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
        </rect>
      ))}
    </svg>
  );
}

function Ground() {
  return <div style={ground} aria-hidden />;
}

function Terminal() {
  // Tiny one-gate terminal silhouette on the left.
  return (
    <svg style={terminalStyle} viewBox="0 0 200 100" aria-hidden>
      <path d="M0 100 L0 60 L20 50 L80 50 L100 60 L100 100 Z" fill="#1E2A44" />
      <path d="M20 50 L80 50 L80 30 L60 22 L40 22 L20 30 Z" fill="#243254" />
      <rect x="30" y="62" width="6" height="14" fill="#5AC8FA" opacity="0.6" />
      <rect x="44" y="62" width="6" height="14" fill="#5AC8FA" opacity="0.6" />
      <rect x="58" y="62" width="6" height="14" fill="#5AC8FA" opacity="0.6" />
      <rect x="72" y="62" width="6" height="14" fill="#5AC8FA" opacity="0.6" />
      {/* Tiny control tower behind */}
      <rect x="105" y="38" width="6" height="62" fill="#2A3556" />
      <rect x="100" y="32" width="16" height="8" rx="1" fill="#3A4A75" />
      <circle cx="108" cy="32" r="1" fill="#F87171">
        <animate attributeName="opacity" values="0.2;1;0.2" dur="1.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function Gate({ stage, tailColor }: { stage: number; tailColor: string }) {
  // Jet bridge silhouette — disappears once the plane pushes back.
  const opacity = stage <= 1 ? 1 : 0;
  return (
    <motion.div
      animate={{ opacity }}
      transition={{ duration: 0.4 }}
      style={gateBridge(tailColor) as Record<string, unknown>}
      aria-hidden
    />
  );
}

function Runway({ stage }: { stage: number }) {
  // Runway with strobing approach lights once cleared for departure.
  return (
    <div style={runwayStyle} aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          style={{
            ...runwayLight,
            left: `${5 + i * 7}%`,
            background: stage >= 3 ? '#F4C75B' : 'rgba(244,199,91,0.3)',
            boxShadow: stage >= 3 ? '0 0 8px #F4C75B' : 'none',
            animation: stage >= 3 ? `runway-strobe 1.2s ${i * 0.08}s infinite` : 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes runway-strobe {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Passengers({ stage }: { stage: number }) {
  // Three little silhouettes walking from terminal to gate.
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ x: 60, opacity: 0 }}
          animate={stage >= 1 ? { x: 150, opacity: stage <= 1 ? 1 : 0 } : { opacity: 0 }}
          transition={{ delay: 0.2 + i * 0.25, duration: 1.4, ease: 'easeInOut' }}
          style={{ ...passenger, bottom: `${18 + i * 0}%`, left: 0 } as Record<string, unknown>}
          aria-hidden
        >
          <svg width="14" height="22" viewBox="0 0 14 22">
            <circle cx="7" cy="5" r="3" fill="#94A3B8" />
            <rect x="4" y="9" width="6" height="9" rx="1.5" fill="#94A3B8" />
            <rect x="4" y="18" width="2" height="4" fill="#94A3B8" />
            <rect x="8" y="18" width="2" height="4" fill="#94A3B8" />
          </svg>
        </motion.div>
      ))}
    </>
  );
}

function Aircraft({ stage, tailColor }: { stage: number; tailColor: string }) {
  // Stage 0/1: at gate (left ~25%).
  // Stage 2:   taxi to runway centre (left ~50%, slight rotation).
  // Stage 3:   takeoff — slide right + rise + tilt up.
  // Stage 4+:  airborne, gentle climb continues.
  let x = '20%', y = '0%', rotate = 0, scale = 0.78;
  if (stage === 2) { x = '38%'; y = '0%'; rotate = 0; scale = 0.78; }
  if (stage === 3) { x = '60%'; y = '-30%'; rotate = -8; scale = 0.85; }
  if (stage >= 4) { x = '78%'; y = '-65%'; rotate = -14; scale = 0.95; }
  return (
    <motion.div
      animate={{ x, y, rotate, scale }}
      transition={{ duration: 1.6, ease: 'easeInOut' }}
      style={aircraftWrap as Record<string, unknown>}
    >
      <AircraftIllustration defId="t1.atr42" tailColor={tailColor} width={200} />
      {/* Contrail (only after takeoff) */}
      {stage >= 3 && (
        <div style={contrail(tailColor)} aria-hidden />
      )}
    </motion.div>
  );
}

/* ─── Styles ───────────────────────────────────────────────────── */

const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 92,
  background: COLOR.bg.deep,
  overflow: 'hidden',
};

const absFull: React.CSSProperties = {
  position: 'absolute', inset: 0,
  width: '100%', height: '100%',
};

const sky = (tail: string): React.CSSProperties => ({
  ...absFull,
  background: `radial-gradient(ellipse at 70% 30%, ${tail}30 0%, ${COLOR.bg.canvas} 55%, ${COLOR.bg.deep} 85%)`,
});

const skylineStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '32%',
  left: 0, right: 0,
  width: '100%',
  height: 140,
  opacity: 0.85,
};

const ground: React.CSSProperties = {
  position: 'absolute',
  bottom: 0, left: 0, right: 0, height: '24%',
  background: `linear-gradient(180deg, #0E1832 0%, ${COLOR.bg.deep} 100%)`,
  borderTop: `1px solid ${COLOR.border.medium}`,
};

const terminalStyle: React.CSSProperties = {
  position: 'absolute',
  left: '4%', bottom: '14%',
  width: 240, height: 120,
};

const gateBridge = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  left: '22%', bottom: '18%',
  width: 60, height: 8,
  background: `linear-gradient(90deg, #2A3556, ${tail}88)`,
  borderRadius: 4,
  boxShadow: `0 0 6px ${tail}55`,
});

const runwayStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '14%', left: '32%', right: '4%',
  height: 8,
  borderRadius: 4,
  background: 'linear-gradient(90deg, #1E293B, #2A3556, #1E293B)',
  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)',
};

const runwayLight: React.CSSProperties = {
  position: 'absolute',
  width: 6, height: 6,
  borderRadius: 999,
  top: -1,
};

const passenger: React.CSSProperties = {
  position: 'absolute',
  bottom: '18%',
};

const aircraftWrap: React.CSSProperties = {
  position: 'absolute',
  bottom: '14%',
  left: 0,
  width: 200,
  transformOrigin: 'center center',
  zIndex: 5,
};

const contrail = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  left: -120,
  top: '50%',
  width: 120,
  height: 2,
  marginTop: -1,
  background: `linear-gradient(90deg, ${tail}00, ${tail}88)`,
  filter: 'blur(0.5px)',
});

const statusBanner: React.CSSProperties = {
  position: 'absolute',
  top: 'max(16px, env(safe-area-inset-top, 16px))',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: SPACE.s,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.24em',
  color: COLOR.accent.cyan,
  background: COLOR.bg.elevated,
  border: `1px solid ${COLOR.accent.cyan}55`,
  padding: '8px 18px',
  borderRadius: RADIUS.pill,
  whiteSpace: 'nowrap',
};

const statusDot: React.CSSProperties = {
  width: 8, height: 8, borderRadius: 999,
  background: COLOR.accent.cyan,
  boxShadow: `0 0 10px ${COLOR.accent.cyan}`,
  animation: 'breathe 1.4s ease-in-out infinite',
};

const routePlate: React.CSSProperties = {
  position: 'absolute',
  top: '36%',
  left: '50%',
  transform: 'translateX(-50%)',
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: '0.28em',
  color: COLOR.accent.cyan,
  background: 'rgba(11,17,32,0.78)',
  border: `1px solid ${COLOR.accent.cyan}55`,
  padding: '6px 14px',
  borderRadius: 999,
  fontFeatureSettings: '"tnum" 1',
  zIndex: 10,
};

const moneyCaption: React.CSSProperties = {
  position: 'absolute',
  top: '34%',
  right: '8%',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.20em',
  color: COLOR.gold.base,
  textTransform: 'uppercase',
  zIndex: 10,
  maxWidth: 220,
  textAlign: 'right',
};

const moneyBurst: React.CSSProperties = {
  position: 'absolute',
  top: '24%', right: '20%',
  fontSize: 44,
  fontWeight: 900,
  color: COLOR.gold.base,
  textShadow: `0 0 18px ${COLOR.gold.base}, 0 4px 8px rgba(0,0,0,0.6)`,
  letterSpacing: '0.04em',
  fontFeatureSettings: '"tnum" 1',
  zIndex: 10,
};

// Cleared overlay (Design Review v6 — point 3). Replaces the bulky
// welcome card with a single "First flight cleared." centered text
// moment so the cinematic ends on emotion, not on a panel.
const clearedOverlay: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0,
  bottom: '24%',
  textAlign: 'center',
  zIndex: 20,
  pointerEvents: 'none',
};
const clearedKicker = (tail: string): React.CSSProperties => ({
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: '0.32em',
  color: tail,
  textShadow: `0 0 24px ${tail}, 0 4px 12px rgba(0,0,0,0.6)`,
});
const clearedBody: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.18em',
  color: COLOR.ink.muted,
  textTransform: 'uppercase',
};


const skipBtn: React.CSSProperties = {
  position: 'absolute',
  top: 'max(16px, env(safe-area-inset-top, 16px))',
  right: 16,
  background: COLOR.bg.glass,
  color: COLOR.ink.muted,
  border: `1px solid ${COLOR.border.medium}`,
  borderRadius: RADIUS.pill,
  padding: '6px 14px',
  fontSize: 11,
  fontFamily: 'inherit',
  cursor: 'pointer',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontWeight: 700,
  zIndex: 30,
};
