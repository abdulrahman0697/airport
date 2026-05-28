/**
 * IntroSplash (Design pass DC — full rewrite).
 *
 * The new start page. Goes for "command-deck title screen of a
 * flagship game", not "loading screen of an app." Layered scene:
 *
 *  1. Hex-grid navy background with a soft radial light at top-right
 *     evoking sunrise over the horizon.
 *  2. Orbital arc rings behind the wordmark (slow rotation, breathing
 *     opacity).
 *  3. Skyline silhouette at the bottom with deterministic random
 *     blinking windows — gives the page a "city below" feel.
 *  4. Hero aircraft (uses the SvgAircraft variant for tier-4) drifts
 *     across the horizon on a long contrail.
 *  5. Wordmark: large display kinetic-letterspaced "SKYHAVEN" with
 *     animated underline, plus "TYCOON" sub-mark in gold.
 *  6. Status pill "READY FOR DEPARTURE" with a breathing cyan dot.
 *  7. Tagline carousel below the wordmark — fades through 3 lines.
 *  8. Oversized "BEGIN BOARDING" CTA — gold gradient + breathing glow.
 *  9. Phase / version chip in bottom-left.
 *
 * Dismissal still flips `introDismissed` in uiStore so the Tutorial
 * waits for the splash to clear.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { selectTailColor, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { AircraftIllustration } from '../design/SvgAircraft';
import { Button } from '../design/Button';
import { COLOR, MOTION, RADIUS, SPACE, TYPE } from '../design/tokens';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

const TAGLINES = [
  'Start with one gate. Build a global aviation empire.',
  'Found an airline. Watch your airport breathe.',
  'Open routes, deliver aircraft, expand the airport.',
];

const WORDMARK = 'SKYHAVEN';

/**
 * Design Review v4 — point 2. The opening is now a live airport idle
 * scene, not a quiet wallpaper. Runway lights blink in sequence, a
 * beacon strobes on the control tower, two passengers walk toward the
 * gate, a baggage cart drifts across the apron, and a distant
 * aircraft silhouette occasionally crosses the sky behind the
 * wordmark.
 *
 * The CTA is a three-stage boarding sequence:
 *   idle      → "▶  Start Boarding"
 *   boarding  → passengers walk faster, doors close, indicator pulses,
 *               button locks for ~2.0s reading "Boarding in progress…"
 *   ready     → "▶  Clear for Takeoff"  (gold, glowing)
 *               tap → plane pushes back + dismissIntro fires
 *
 * Players who skip-tap during boarding fast-forward the sequence.
 */
type BoardStage = 'idle' | 'boarding' | 'ready' | 'departing';

export function IntroSplash() {
  const introDismissed = useUiStore((s) => s.introDismissed);
  const dismissIntro = useUiStore((s) => s.dismissIntro);
  const tailColor = useGameStore(selectTailColor);
  const [exiting, setExiting] = useState(false);
  const [taglineIdx, setTaglineIdx] = useState(0);
  const [stage, setStage] = useState<BoardStage>('idle');

  useEffect(() => {
    if (introDismissed) setExiting(true);
  }, [introDismissed]);

  useEffect(() => {
    if (exiting) return;
    const id = window.setInterval(() => {
      setTaglineIdx((i) => (i + 1) % TAGLINES.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [exiting]);

  // Stage progression timing — the boarding stage auto-advances after
  // ~2s so the player doesn't wait, but they can also tap to skip.
  useEffect(() => {
    if (stage !== 'boarding') return;
    const id = window.setTimeout(() => setStage('ready'), 2000);
    return () => window.clearTimeout(id);
  }, [stage]);

  const onPrimary = (): void => {
    if (stage === 'idle') {
      haptics.medium();
      sfx.tick();
      setStage('boarding');
      return;
    }
    if (stage === 'boarding') {
      // Tap to skip ahead.
      haptics.medium();
      sfx.tick();
      setStage('ready');
      return;
    }
    if (stage === 'ready') {
      haptics.success();
      sfx.confirm();
      setStage('departing');
      // Micro-takeoff cinematic — Design Review v5 point 3. After the
      // player taps Clear for Takeoff, the plane physically rolls
      // forward, the runway lights streak past, and only then does
      // the splash dismiss into the founder flow. The button promised
      // a takeoff and we make sure the player actually sees one.
      window.setTimeout(() => dismissIntro(), 1700);
    }
  };

  const primaryLabel = stage === 'idle' ? '▶  Start Boarding'
    : stage === 'boarding' ? 'Boarding in progress…'
      : stage === 'ready' ? '▶  Clear for Takeoff'
        : 'Cleared ✓';
  const primaryVariant = stage === 'ready' || stage === 'departing' ? 'gold' as const : 'primary' as const;

  // Skyline buildings — deterministic per-mount so they twinkle the same
  // across the carousel cycles. Done in JS so SSR-safe.
  const skyline = useMemo(() => buildSkyline(28), []);

  return (
    <AnimatePresence>
      {!introDismissed && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.duration.medium / 1000 }}
          style={shell as Record<string, unknown>}
        >
          {/* Background layers */}
          <div style={hexGrid} aria-hidden />
          <div style={sunriseGlow(tailColor)} aria-hidden />

          {/* Orbital arc rings behind the wordmark */}
          <div style={orbitWrap} aria-hidden>
            <OrbitRing color={tailColor} radius={140} dur={42} reverse={false} />
            <OrbitRing color={tailColor} radius={210} dur={64} reverse />
            <OrbitRing color={COLOR.gold.base} radius={280} dur={88} reverse={false} />
            {/* Radar sweep — Design Review v6 point 1. A slow
                conic-gradient wedge rotates behind the wordmark to
                give the splash a control-tower "tracking" feel. */}
            <RadarSweep tailColor={tailColor} />
          </div>

          {/* Distant aircraft drifting across the sky — keeps the
              backdrop alive even while the foreground scene is idle. */}
          <motion.div
            style={skyAircraftWrap as Record<string, unknown>}
            initial={{ x: '-30%' }}
            animate={{ x: '30%' }}
            transition={{ duration: 22, ease: 'linear', repeat: Infinity }}
          >
            <ContrailTrack tailColor={tailColor} />
            <AircraftIllustration
              defId="t4.a321xlr"
              tailColor={tailColor}
              width={80}
              style={{ filter: `drop-shadow(0 4px 18px ${tailColor}66)`, opacity: 0.85 }}
            />
          </motion.div>

          {/* Foreground content */}
          <div style={content}>
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.5, ease: 'easeOut' }}
              style={statusPill(tailColor) as Record<string, unknown>}

            >
              <span style={{
                ...breathingDot,
                background: tailColor,
                boxShadow: `0 0 10px ${tailColor}`,
              }} />
              READY FOR DEPARTURE
            </motion.div>

            <Wordmark text={WORDMARK} tailColor={tailColor} />

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.4 }}
              style={subMark as Record<string, unknown>}
            >
              <span style={subMarkText}>TYCOON</span>
              <span style={{ ...subMarkUnderline, background: COLOR.gold.base }} />
            </motion.div>

            <div style={taglineWrap}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={taglineIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.45 }}
                  style={tagline as Record<string, unknown>}
                >
                  {TAGLINES[taglineIdx]}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Design Review v6 — point 2. Three-icon promise row so
                the player understands the whole game in five seconds.
                Open Routes · Buy Aircraft · Expand Airport — the three
                loops everything else feeds into. */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              style={promiseRow as Record<string, unknown>}
            >
              <PromiseIcon tail={tailColor} symbol="✈" label="OPEN ROUTES" />
              <span style={promiseDivider(tailColor)} aria-hidden />
              <PromiseIcon tail={tailColor} symbol="🛬" label="BUY AIRCRAFT" />
              <span style={promiseDivider(tailColor)} aria-hidden />
              <PromiseIcon tail={tailColor} symbol="🏗" label="EXPAND AIRPORT" />
            </motion.div>

            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.95, type: 'spring', stiffness: 360, damping: 22 }}
              style={ctaWrap as Record<string, unknown>}
            >
              <div style={ctaGlow(tailColor)} aria-hidden />
              <Button
                variant={primaryVariant}
                size="lg"
                onClick={onPrimary}
                hapticOnPress={stage === 'ready' ? 'heavy' : 'medium'}
                disabled={stage === 'boarding' || stage === 'departing'}
                style={ctaButton}
              >
                {primaryLabel}
              </Button>
              <div style={ctaHint}>
                {stage === 'idle' && 'Tap to start your airline'}
                {stage === 'boarding' && 'Doors closing · 0:02'}
                {stage === 'ready' && 'Push back when ready'}
                {stage === 'departing' && 'Have a safe flight ✈'}
              </div>
            </motion.div>
          </div>

          {/* Live airport idle scene — Design Review v4, point 2. */}
          <LiveAirportScene tailColor={tailColor} stage={stage} />

          {/* Skyline silhouette at the bottom */}
          <div style={skylineWrap} aria-hidden>
            <svg width="100%" height="120" viewBox="0 0 1000 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="splash-skyline-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#1A2244" />
                  <stop offset="1" stopColor="#070A18" />
                </linearGradient>
              </defs>
              <path d={skyline.path} fill="url(#splash-skyline-fill)" />
              {skyline.windows.map((w, i) => (
                <rect
                  key={i}
                  x={w.x}
                  y={w.y}
                  width={w.w}
                  height={w.h}
                  fill={w.lit ? tailColor : COLOR.gold.base}
                  opacity={w.lit ? 0.85 : 0.55}
                >
                  <animate
                    attributeName="opacity"
                    values={`${w.opaA};${w.opaB};${w.opaA}`}
                    dur={`${w.dur}s`}
                    repeatCount="indefinite"
                  />
                </rect>
              ))}
            </svg>
          </div>

          <div style={versionChip}>v0.1.0 · Pre-launch build</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function PromiseIcon({ tail, symbol, label }: { tail: string; symbol: string; label: string }) {
  return (
    <div style={promiseCell}>
      <div style={{ ...promiseSymbol, color: tail, filter: `drop-shadow(0 0 8px ${tail}88)` }}>
        {symbol}
      </div>
      <div style={promiseLabel}>{label}</div>
    </div>
  );
}

function Wordmark({ text, tailColor }: { text: string; tailColor: string }) {
  return (
    <div style={wordmarkRow}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          initial={{ y: 32, opacity: 0, filter: 'blur(8px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.20 + i * 0.06, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{
            ...wordmarkChar,
            textShadow: `0 0 24px ${tailColor}66, 0 0 60px ${tailColor}33`,
          } as Record<string, unknown>}
        >
          {ch}
        </motion.span>
      ))}
    </div>
  );
}

function RadarSweep({ tailColor }: { tailColor: string }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: '50%', top: '50%',
        width: 480, height: 480,
        marginLeft: -240, marginTop: -240,
        borderRadius: '50%',
        background: `conic-gradient(from 0deg, ${tailColor}33 0deg, ${tailColor}55 18deg, transparent 60deg, transparent 360deg)`,
        opacity: 0.55,
        pointerEvents: 'none',
      } as Record<string, unknown>}
      animate={{ rotate: 360 }}
      transition={{ duration: 5, ease: 'linear', repeat: Infinity }}
    />
  );
}

function OrbitRing({
  color, radius, dur, reverse,
}: {
  color: string;
  radius: number;
  dur: number;
  reverse: boolean;
}) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        width: radius * 2,
        height: radius * 2,
        marginLeft: -radius,
        marginTop: -radius,
        left: '50%',
        top: '50%',
        borderRadius: '50%',
        border: `1px solid ${color}40`,
        borderTopColor: `${color}AA`,
        borderRightColor: `${color}33`,
      }}
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ duration: dur, ease: 'linear', repeat: Infinity }}
    />
  );
}

function ContrailTrack({ tailColor }: { tailColor: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '-140%',
        top: '50%',
        marginTop: -1,
        width: '140%',
        height: 2,
        background: `linear-gradient(90deg, ${tailColor}00 0%, ${tailColor}55 60%, ${tailColor}AA 100%)`,
        borderRadius: 2,
        filter: 'blur(0.5px)',
      }}
      aria-hidden
    />
  );
}

/* ─── Skyline generator ──────────────────────────────────────────── */

interface Window {
  x: number; y: number; w: number; h: number;
  lit: boolean; opaA: number; opaB: number; dur: number;
}
interface Skyline { path: string; windows: Window[] }

function buildSkyline(buildings: number): Skyline {
  let seed = 0xCAFE;
  const rand = (): number => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  };
  // Build a stepped skyline across viewBox width 1000, descending into 120.
  const w = 1000;
  const minY = 30;
  const maxY = 110;
  const widthBase = w / buildings;
  let x = 0;
  let path = `M 0 120`;
  const windows: Window[] = [];
  for (let i = 0; i < buildings; i++) {
    const bw = widthBase * (0.7 + rand() * 0.7);
    const top = minY + rand() * (maxY - minY) * 0.85;
    path += ` L ${x} ${top} L ${x + bw} ${top}`;
    // Windows on this building
    const winCols = Math.max(1, Math.round(bw / 14));
    const winRows = Math.max(1, Math.round((120 - top) / 14));
    for (let row = 0; row < winRows; row++) {
      for (let col = 0; col < winCols; col++) {
        if (rand() < 0.45) continue;
        const wx = x + 3 + col * 14;
        const wy = top + 6 + row * 14;
        if (wy > 116 || wx + 6 > x + bw) continue;
        const lit = rand() < 0.6;
        const opaA = 0.25 + rand() * 0.25;
        const opaB = opaA + 0.35 + rand() * 0.2;
        const dur = 2 + rand() * 5;
        windows.push({ x: wx, y: wy, w: 6, h: 6, lit, opaA, opaB, dur });
      }
    }
    x += bw;
  }
  path += ` L ${w} 120 Z`;
  return { path, windows };
}

/* ─── Live airport idle scene (Design Review v4 — point 2) ──────── */

function LiveAirportScene({
  tailColor, stage,
}: {
  tailColor: string;
  stage: BoardStage;
}) {
  const boarding = stage === 'boarding';
  const ready = stage === 'ready';
  const departing = stage === 'departing';

  // Plane positioning per stage. Idle/boarding/ready it sits at the
  // gate; on `departing` it taxis right and rotates up off the runway.
  const planeX = departing ? 280 : 60;
  const planeRotate = departing ? -16 : 0;
  const planeY = departing ? -54 : 0;

  return (
    <div style={airportSceneWrap} aria-hidden>
      <svg width="100%" height="200" viewBox="0 0 400 200" preserveAspectRatio="xMidYEnd slice">
        <defs>
          <linearGradient id="splash-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0F1734" stopOpacity="0" />
            <stop offset="0.6" stopColor="#0B1426" stopOpacity="0.85" />
            <stop offset="1" stopColor="#050912" stopOpacity="1" />
          </linearGradient>
          <style>{`
            @keyframes splashRunwayStrobe { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }
            @keyframes splashBeacon { 0%,100% { opacity: 0.18 } 50% { opacity: 1 } }
            @keyframes splashPaxWalk {
              0% { transform: translateX(0); opacity: 0 }
              8% { opacity: 1 }
              92% { opacity: 1 }
              100% { transform: translateX(60px); opacity: 0 }
            }
            @keyframes splashPaxWalkFast {
              0% { transform: translateX(0); opacity: 0 }
              10% { opacity: 1 }
              90% { opacity: 1 }
              100% { transform: translateX(64px); opacity: 0 }
            }
            @keyframes splashCartDrift {
              0% { transform: translateX(0) }
              50% { transform: translateX(70px) }
              100% { transform: translateX(0) }
            }
            @keyframes splashContrailFade {
              0% { stroke-dashoffset: 0; opacity: 1 }
              100% { stroke-dashoffset: -160; opacity: 0 }
            }
            @keyframes splashTowerLight { 0%,100% { opacity: 0.45 } 50% { opacity: 1 } }
            @media (prefers-reduced-motion: reduce) {
              * { animation: none !important; }
            }
          `}</style>
        </defs>

        {/* Ground gradient mask blends scene into skyline */}
        <rect x="0" y="0" width="400" height="200" fill="url(#splash-ground)" />

        {/* Runway with edge strobes */}
        <rect x="0" y="170" width="400" height="6" rx="2" fill="#1A2244" />
        {[20, 60, 100, 140, 180, 220, 260, 300, 340, 380].map((cx, i) => (
          <circle
            key={cx}
            cx={cx}
            cy={173}
            r={1.6}
            fill={ready || departing ? '#F4C75B' : `${tailColor}cc`}
            style={{
              animation: `splashRunwayStrobe ${0.9 + (i % 3) * 0.15}s ease-in-out ${i * 0.08}s infinite`,
              filter: ready || departing ? `drop-shadow(0 0 6px ${COLOR.gold.base})` : `drop-shadow(0 0 4px ${tailColor})`,
            }}
          />
        ))}
        {/* Centerline dashes */}
        {[20, 60, 100, 140, 180, 220, 260, 300, 340, 380].map((cx) => (
          <rect key={`d-${cx}`} x={cx} y={172.5} width="14" height="1" fill="#94A3B8" opacity="0.6" />
        ))}

        {/* Taxiway */}
        <rect x="40" y="156" width="320" height="2" fill="#1E293B" opacity="0.7" />

        {/* Terminal block */}
        <g>
          <path d="M30 162 L30 134 L60 124 L160 124 L185 134 L185 162 Z" fill="#1F2A4D" />
          <path d="M30 134 L60 124 L160 124 L185 134" stroke={tailColor} strokeOpacity="0.45" strokeWidth="0.9" fill="none" />
          {/* Terminal windows */}
          {[36, 46, 56, 66, 76, 86, 96, 106, 116, 126, 136, 146, 156, 166, 176].map((x, i) => (
            <rect key={x} x={x} y={144} width="4" height="6" fill={tailColor} opacity="0.6">
              <animate attributeName="opacity" values={`${0.5 + (i % 3) * 0.1};${0.9 - (i % 3) * 0.05};${0.5 + (i % 3) * 0.1}`} dur={`${2.4 + (i % 4) * 0.6}s`} repeatCount="indefinite" />
            </rect>
          ))}
        </g>

        {/* Control tower with strobing beacon */}
        <g>
          <rect x="206" y="118" width="6" height="40" fill="#2A3556" />
          <rect x="201" y="110" width="16" height="9" rx="1.5" fill="#3A4A75" />
          <rect x="203" y="112" width="12" height="3" fill="#0F1734" />
          <circle cx="209" cy="110" r="1.6" fill="#F87171"
            style={{ animation: 'splashBeacon 1.3s ease-in-out infinite' }} />
          <circle cx="209" cy="121" r="1" fill={tailColor}
            style={{ animation: 'splashTowerLight 2.6s ease-in-out infinite' }} />
        </g>

        {/* Gate jet bridge stub */}
        <rect x="70" y="159" width="2" height="6" fill="#2A3556" />
        <rect x="66" y="156" width="10" height="3" fill={tailColor} opacity={boarding ? '0.95' : '0.7'} />

        {/* Passengers walking from terminal entrance toward the gate */}
        {/* Two slow walkers in idle, three fast walkers during boarding. */}
        {(stage === 'idle' || stage === 'boarding') && [0, 1, 2].map((i) => (
          <g
            key={i}
            style={{
              animation: `${boarding ? 'splashPaxWalkFast' : 'splashPaxWalk'} ${boarding ? 1.6 : 4 + i}s linear ${i * (boarding ? 0.35 : 1.1)}s infinite`,
              transformOrigin: '20px 154px',
            }}
          >
            <circle cx={20 + i * 6} cy={153} r="1.4" fill={i === 2 && boarding ? COLOR.gold.base : '#94A3B8'} />
            <rect x={19 + i * 6} y={154.4} width="2" height="3.2" rx="0.5" fill={i === 2 && boarding ? COLOR.gold.base : '#94A3B8'} />
          </g>
        ))}

        {/* Baggage cart drifting across apron */}
        <g style={{ animation: 'splashCartDrift 7s ease-in-out infinite alternate' }}>
          <rect x="120" y="159" width="9" height="3" fill={COLOR.gold.base} opacity="0.85" />
          <rect x="131" y="159.5" width="6" height="2.5" fill="#475569" />
          <circle cx="122" cy={162.5} r="0.9" fill="#0B1120" />
          <circle cx="128" cy={162.5} r="0.9" fill="#0B1120" />
          <circle cx="133" cy={162.5} r="0.7" fill="#0B1120" />
        </g>

        {/* Parked / departing aircraft at the gate */}
        <g
          style={{
            transform: `translateX(${planeX - 60}px) translateY(${planeY}px) rotate(${planeRotate}deg)`,
            transformOrigin: '90px 156px',
            transition: 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {/* Fuselage */}
          <ellipse cx="90" cy="156" rx="14" ry="2.5" fill="#F8FAFC" />
          {/* Wings */}
          <path d="M86 154 L78 149 L82 148 L92 154 Z" fill={tailColor} opacity="0.85" />
          <path d="M86 158 L78 163 L82 164 L92 158 Z" fill={tailColor} opacity="0.85" />
          {/* Tail fin */}
          <path d="M77 154 L74 150 L75 156 L74 162 L77 158 Z" fill={tailColor} opacity="0.95" />
          {/* Cockpit dot */}
          <circle cx="102" cy="156" r="0.8" fill={tailColor} />
          {/* Departing contrail */}
          {departing && (
            <path
              d="M 75 156 L -15 156"
              stroke={tailColor}
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinecap="round"
              opacity="0.7"
              style={{ animation: 'splashContrailFade 1.4s ease-out forwards' }}
            />
          )}
        </g>

        {/* Distant approach lights — gold during ready/departing */}
        {(ready || departing) && [0, 1, 2, 3].map((i) => (
          <circle
            key={`approach-${i}`}
            cx={350 + i * 12}
            cy={173}
            r="1.6"
            fill={COLOR.gold.base}
            opacity="0.9"
            style={{
              animation: `splashRunwayStrobe 0.7s ease-in-out ${i * 0.12}s infinite`,
              filter: `drop-shadow(0 0 6px ${COLOR.gold.base})`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 90,
  background: `radial-gradient(ellipse at top right, #1B2348 0%, ${COLOR.bg.canvas} 40%, ${COLOR.bg.deep} 80%)`,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  paddingTop: 'env(safe-area-inset-top, 0)',
  paddingBottom: 'env(safe-area-inset-bottom, 0)',
};

const hexGrid: React.CSSProperties = {
  position: 'absolute', inset: 0,
  // SVG hex pattern via background-image
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='46' viewBox='0 0 40 46'><path d='M20 0 L40 11 L40 34 L20 45 L0 34 L0 11 Z' fill='none' stroke='%2394A3B833' stroke-width='1'/></svg>\")",
  backgroundSize: '40px 46px',
  opacity: 0.15,
};

const sunriseGlow = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  top: '-30%', right: '-20%',
  width: '85%', height: '85%',
  background: `radial-gradient(ellipse at center, ${tail}44 0%, ${tail}11 30%, transparent 60%)`,
  filter: 'blur(40px)',
  pointerEvents: 'none',
});

const orbitWrap: React.CSSProperties = {
  position: 'absolute',
  left: '50%', top: '38%',
  width: 1, height: 1,
  pointerEvents: 'none',
};

const skyAircraftWrap: React.CSSProperties = {
  position: 'absolute',
  left: '35%', top: '28%',
  width: 80,
  pointerEvents: 'none',
  zIndex: 1,
};

const content: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: SPACE.s,
  padding: SPACE.l,
};

const statusPill = (tail: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: SPACE.s,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.32em',
  color: tail,
  background: `${tail}14`,
  border: `1px solid ${tail}55`,
  padding: '6px 14px',
  borderRadius: RADIUS.pill,
});

const breathingDot: React.CSSProperties = {
  width: 7, height: 7, borderRadius: RADIUS.pill,
  animation: 'breathe 1.6s ease-in-out infinite',
};

const wordmarkRow: React.CSSProperties = {
  display: 'flex',
  marginTop: SPACE.m,
};

const wordmarkChar: React.CSSProperties = {
  fontSize: 64,
  fontWeight: 900,
  letterSpacing: '0.06em',
  color: COLOR.ink.primary,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  display: 'inline-block',
};

const subMark: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginTop: -4,
};
const subMarkText: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: '0.42em',
  color: COLOR.gold.base,
};
const subMarkUnderline: React.CSSProperties = {
  width: 64, height: 2, marginTop: 6,
  borderRadius: 1,
  boxShadow: `0 0 12px ${COLOR.gold.base}`,
};

// Three-icon promise row (Design Review v6 — point 2)
const promiseRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  marginTop: SPACE.m,
};
const promiseCell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  minWidth: 86,
};
const promiseSymbol: React.CSSProperties = {
  fontSize: 24,
  lineHeight: 1,
};
const promiseLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.16em',
  color: COLOR.ink.muted,
  textTransform: 'uppercase',
};
const promiseDivider = (tail: string): React.CSSProperties => ({
  width: 1,
  height: 22,
  background: `linear-gradient(180deg, transparent, ${tail}66, transparent)`,
});

const taglineWrap: React.CSSProperties = {
  height: 24,
  display: 'grid', placeItems: 'center',
  marginTop: SPACE.l,
};

const tagline: React.CSSProperties = {
  fontSize: TYPE.body.size,
  color: COLOR.ink.secondary,
  letterSpacing: '0.05em',
  fontWeight: 500,
  textAlign: 'center',
};

const ctaWrap: React.CSSProperties = {
  position: 'relative',
  marginTop: SPACE.xl,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: SPACE.s,
};

const ctaGlow = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  top: -8, left: -16, right: -16, bottom: 28,
  borderRadius: RADIUS.pill,
  background: `radial-gradient(ellipse at center, ${COLOR.gold.base}33 0%, ${tail}11 50%, transparent 75%)`,
  filter: 'blur(12px)',
  animation: 'breathe 2.4s ease-in-out infinite',
  zIndex: -1,
  pointerEvents: 'none',
});

const ctaButton: React.CSSProperties = {
  paddingLeft: 28,
  paddingRight: 28,
  fontSize: 14,
  height: 52,
  letterSpacing: '0.14em',
};

const ctaHint: React.CSSProperties = {
  fontSize: 10,
  color: COLOR.ink.faint,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};

const skylineWrap: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0, bottom: 0,
  pointerEvents: 'none',
};

// Live airport scene sits just above the skyline (which is bottom 120px).
const airportSceneWrap: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0, bottom: 80,
  height: 200,
  pointerEvents: 'none',
  zIndex: 1,
};

const versionChip: React.CSSProperties = {
  position: 'absolute',
  left: 14, bottom: 14,
  fontSize: 9,
  color: COLOR.ink.faint,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  background: COLOR.bg.glass,
  padding: '4px 8px',
  borderRadius: RADIUS.xs,
  border: `1px solid ${COLOR.border.soft}`,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};
