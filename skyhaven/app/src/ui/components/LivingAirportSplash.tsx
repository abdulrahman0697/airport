/**
 * LivingAirportSplash — Design Review v7 / starting-page rebuild.
 *
 * The new opening surface. Replaces the previous static-poster
 * IntroSplash with a deeply animated airport that is alive from the
 * second the player launches the app — no money, no stats, no
 * dashboard. Just the airport breathing while the constellation of
 * routes glows overhead.
 *
 * Composition (top to bottom):
 *   1. Night sky with stars and a distant mountain silhouette.
 *   2. Constellation strip — 7 destination pins linked by dashed
 *      tail-colour arcs; aircraft sprites travel along each arc with
 *      different phases so the network always reads as in motion.
 *   3. SKYHAVEN TYCOON wordmark with gold underline, sitting over the
 *      sky strip.
 *   4. Big illustrated airport diorama: terminal with "SKYHAVEN
 *      AIRPORT" sign, control tower with strobing beacon, three lit
 *      gates with parked aircraft, jet bridges, runway with golden
 *      approach lights + a "27" designation, taxiing aircraft, ground
 *      vehicles + baggage carts looping across the apron, cars
 *      crossing the foreground road, a glowing "Expand Here" arrow.
 *   5. Three-icon promise row + a tail-colour primary CTA. The CTA
 *      steps through Start Boarding → Boarding in progress → Clear
 *      for Takeoff before the splash dismisses — the click promises
 *      a takeoff and the player sees one.
 *
 * No founder capital, income/min or next-goal chip is visible on the
 * starting page. The player gets to look at the toy before being
 * asked about any numbers.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { selectTailColor, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../design/Button';
import { COLOR, MOTION, RADIUS, SPACE } from '../design/tokens';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

const WORDMARK = 'SKYHAVEN';
const SUBMARK = 'TYCOON';

type BoardStage = 'idle' | 'boarding' | 'ready' | 'departing';

const DESTINATIONS: ReadonlyArray<{ iata: string; name: string; xPct: number; yPct: number }> = [
  { iata: 'NSH', name: 'Northshore',  xPct: 0.16, yPct: 0.18 },
  { iata: 'PCT', name: 'Pinecrest',   xPct: 0.10, yPct: 0.46 },
  { iata: 'LKD', name: 'Lakeside',    xPct: 0.42, yPct: 0.16 },
  { iata: 'AUR', name: 'Aurora',      xPct: 0.70, yPct: 0.42 },
  { iata: 'CBD', name: 'Cloudbridge', xPct: 0.92, yPct: 0.20 },
  { iata: 'RVM', name: 'Rivermouth',  xPct: 0.44, yPct: 0.62 },
  { iata: 'SVW', name: 'Seaview',     xPct: 0.84, yPct: 0.64 },
];

export function LivingAirportSplash() {
  const introDismissed = useUiStore((s) => s.introDismissed);
  const dismissIntro = useUiStore((s) => s.dismissIntro);
  const tailColor = useGameStore(selectTailColor);
  const [stage, setStage] = useState<BoardStage>('idle');

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
      haptics.medium();
      sfx.tick();
      setStage('ready');
      return;
    }
    if (stage === 'ready') {
      haptics.success();
      sfx.confirm();
      setStage('departing');
      window.setTimeout(() => dismissIntro(), 1700);
    }
  };

  const primaryLabel = stage === 'idle' ? '▶  Start Boarding'
    : stage === 'boarding' ? 'Boarding in progress…'
      : stage === 'ready' ? '▶  Clear for Takeoff'
        : 'Cleared ✓';
  const primaryVariant = stage === 'ready' || stage === 'departing' ? 'gold' as const : 'primary' as const;

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
          <SkyBackdrop tailColor={tailColor} />

          {/* The constellation of routes + animated aircraft above the airport. */}
          <ConstellationStrip tailColor={tailColor} />

          {/* Brand wordmark — sits over the sky strip, anchored to the
              upper-middle. */}
          <div style={brandWrap}>
            <Wordmark text={WORDMARK} tailColor={tailColor} />
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.45 }}
              style={subMark as Record<string, unknown>}
            >
              <span style={subMarkText}>{SUBMARK}</span>
              <span style={subMarkUnderline} />
            </motion.div>
          </div>

          {/* Big living airport diorama. */}
          <AirportDiorama tailColor={tailColor} stage={stage} />

          {/* Promise row + CTA stick to the bottom. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            style={ctaArea as Record<string, unknown>}
          >
            <div style={promiseRow}>
              <PromiseIcon tail={tailColor} symbol="✈" label="OPEN ROUTES" />
              <span style={promiseDivider(tailColor)} aria-hidden />
              <PromiseIcon tail={tailColor} symbol="🛬" label="BUY AIRCRAFT" />
              <span style={promiseDivider(tailColor)} aria-hidden />
              <PromiseIcon tail={tailColor} symbol="🏗" label="EXPAND AIRPORT" />
            </div>

            <div style={ctaWrap}>
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Background ──────────────────────────────────────────────────── */

function SkyBackdrop({ tailColor }: { tailColor: string }) {
  // Deterministic stars + soft radial glow + distant mountains.
  const stars = useMemo(() => {
    const out: Array<{ x: number; y: number; r: number; o: number; dur: number; delay: number }> = [];
    let seed = 0xCAFE;
    const rnd = (): number => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 100000) / 100000; };
    for (let i = 0; i < 70; i++) {
      out.push({
        x: rnd() * 100,
        y: rnd() * 65,
        r: 0.4 + rnd() * 1.0,
        o: 0.3 + rnd() * 0.55,
        dur: 2 + rnd() * 4,
        delay: rnd() * 4,
      });
    }
    return out;
  }, []);

  return (
    <>
      <div style={skyGradient(tailColor)} aria-hidden />
      <div style={hexGrid} aria-hidden />
      {/* Stars */}
      <svg style={starsLayer} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.3} fill="#F8FAFC"
            opacity={s.o}>
            <animate attributeName="opacity" values={`${s.o};${s.o + 0.3};${s.o}`}
              dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
      {/* Distant mountain silhouette */}
      <svg style={mountainsLayer} viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="mountains-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1B2347" />
            <stop offset="1" stopColor="#0A0F1F" />
          </linearGradient>
        </defs>
        <path
          d="M 0 200 L 0 130 L 90 80 L 160 110 L 220 70 L 310 100 L 400 60 L 500 95 L 590 70 L 690 110 L 790 75 L 880 105 L 950 85 L 1000 110 L 1000 200 Z"
          fill="url(#mountains-fill)"
          opacity="0.92"
        />
      </svg>
      {/* City skyline silhouette below mountains, behind airport */}
      <svg style={citySkylineLayer} viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden>
        <path
          d="M 0 120 L 0 70 L 40 70 L 40 40 L 80 40 L 80 60 L 120 60 L 120 30 L 160 30 L 160 55 L 200 55 L 200 45 L 240 45 L 240 65 L 280 65 L 280 35 L 320 35 L 320 60 L 360 60 L 360 25 L 400 25 L 400 50 L 440 50 L 440 70 L 480 70 L 480 40 L 520 40 L 520 55 L 560 55 L 560 30 L 600 30 L 600 60 L 640 60 L 640 45 L 680 45 L 680 70 L 720 70 L 720 50 L 760 50 L 760 30 L 800 30 L 800 60 L 840 60 L 840 35 L 880 35 L 880 55 L 920 55 L 920 65 L 960 65 L 960 45 L 1000 45 L 1000 120 Z"
          fill="#0E1832"
          opacity="0.9"
        />
        {/* Lit windows */}
        {[
          { x: 50, y: 50 }, { x: 90, y: 70 }, { x: 130, y: 40 }, { x: 170, y: 65 },
          { x: 210, y: 55 }, { x: 250, y: 75 }, { x: 290, y: 45 }, { x: 330, y: 70 },
          { x: 370, y: 35 }, { x: 410, y: 60 }, { x: 450, y: 80 }, { x: 490, y: 50 },
          { x: 530, y: 65 }, { x: 570, y: 40 }, { x: 610, y: 70 }, { x: 650, y: 55 },
          { x: 690, y: 80 }, { x: 730, y: 60 }, { x: 770, y: 40 }, { x: 810, y: 70 },
          { x: 850, y: 45 }, { x: 890, y: 65 }, { x: 930, y: 75 }, { x: 970, y: 55 },
        ].map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width="2" height="2.6" fill={tailColor} opacity={0.7}>
            <animate attributeName="opacity" values={`${0.4 + (i % 3) * 0.1};${0.85 - (i % 3) * 0.05};${0.4 + (i % 3) * 0.1}`}
              dur={`${2.5 + (i % 4)}s`} repeatCount="indefinite" begin={`${i * 0.13}s`} />
          </rect>
        ))}
      </svg>
    </>
  );
}

/* ─── Constellation strip ─────────────────────────────────────────── */

function ConstellationStrip({ tailColor }: { tailColor: string }) {
  // Drive a single rAF for all aircraft so they move smoothly across
  // the constellation. Each arc has its own phase + period so the
  // network reads as in motion.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = (): void => { setTick(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Anchor "home" pin in the lower middle so arcs fan up and out.
  const W = 1000;
  const H = 360;
  const HOME = { x: 500, y: H - 40 };

  // Compute arcs.
  const arcs = useMemo(() => {
    return DESTINATIONS.map((d, i) => {
      const destX = d.xPct * W;
      const destY = d.yPct * H;
      const midX = (HOME.x + destX) / 2;
      const midY = Math.min(HOME.y, destY) - Math.abs(destX - HOME.x) * 0.18 - 30;
      const pathD = `M ${HOME.x} ${HOME.y} Q ${midX} ${midY} ${destX} ${destY}`;
      const period = 7000 + i * 850 + d.iata.length * 110;
      const phase = ((i * 0.31) + 0.1) % 1;
      return { ...d, destX, destY, midX, midY, pathD, period, phase };
    });
  }, [HOME.x, HOME.y]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={constellationLayer} aria-hidden>
      <defs>
        <radialGradient id="splash-pin-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={tailColor} stopOpacity="0.5" />
          <stop offset="1" stopColor={tailColor} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hot-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tailColor} stopOpacity="0" />
          <stop offset="0.5" stopColor={COLOR.gold.base} stopOpacity="0.95" />
          <stop offset="1" stopColor={tailColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Arcs */}
      {arcs.map((arc, i) => (
        <g key={arc.iata}>
          <path
            d={arc.pathD}
            stroke={i === 2 ? 'url(#hot-arc)' : tailColor}
            strokeOpacity={i === 2 ? 1 : 0.35}
            strokeWidth={i === 2 ? 2.4 : 1}
            strokeDasharray={i === 2 ? '0' : '4 4'}
            fill="none"
          />
          {/* Destination pin halo + dot */}
          <circle cx={arc.destX} cy={arc.destY} r="22" fill="url(#splash-pin-glow)" />
          <circle cx={arc.destX} cy={arc.destY} r="3.2" fill={tailColor}
            style={{ filter: `drop-shadow(0 0 5px ${tailColor})` }} />
          <text x={arc.destX} y={arc.destY - 10} textAnchor="middle"
            fill="#CBD5E1" fontSize="10" fontWeight="700" letterSpacing="0.06em">
            {arc.name}
          </text>
        </g>
      ))}

      {/* Aircraft sprites travel along each arc with their own phase. */}
      {arcs.map((arc) => {
        const t = ((tick / arc.period) + arc.phase) % 1;
        const u = 1 - t;
        const x = u * u * HOME.x + 2 * u * t * arc.midX + t * t * arc.destX;
        const y = u * u * HOME.y + 2 * u * t * arc.midY + t * t * arc.destY;
        const tx = 2 * u * (arc.midX - HOME.x) + 2 * t * (arc.destX - arc.midX);
        const ty = 2 * u * (arc.midY - HOME.y) + 2 * t * (arc.destY - arc.midY);
        const angle = (Math.atan2(ty, tx) * 180) / Math.PI;
        return (
          <g key={`ac-${arc.iata}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
            {/* Tiny contrail */}
            <path d="M -22 0 L -6 0" stroke={tailColor} strokeWidth="1.2" opacity="0.45" strokeLinecap="round" />
            {/* Body */}
            <path d="M -6 0 L 5 -1.6 L 5 1.6 Z" fill="#F8FAFC" />
            <path d="M -2 -2.6 L 1 -2.6 L 0 0 Z" fill={tailColor} />
            <path d="M -2 2.6 L 1 2.6 L 0 0 Z" fill={tailColor} />
            <circle cx="5" cy="0" r="1" fill={tailColor} />
          </g>
        );
      })}

      {/* Subtle home halo */}
      <circle cx={HOME.x} cy={HOME.y} r="28" fill="url(#splash-pin-glow)" />
    </svg>
  );
}

/* ─── Airport diorama ─────────────────────────────────────────────── */

function AirportDiorama({ tailColor, stage }: { tailColor: string; stage: BoardStage }) {
  const departing = stage === 'departing';
  const ready = stage === 'ready';
  const boarding = stage === 'boarding';

  // Drive a JS clock so we can move taxiing aircraft + ground vehicles
  // along loops without depending on CSS keyframes.
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = (): void => { setT(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Cars on the foreground road: 4 cars at staggered phases.
  const cars = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    period: 9000 + i * 2200,
    phase: (i * 0.21) % 1,
    color: i === 0 ? COLOR.gold.base : i === 1 ? tailColor : '#94A3B8',
    yOffset: i % 2 === 0 ? 0 : 5,
  })), [tailColor]);

  // Taxiing aircraft: two planes loop across the apron taxiway.
  const taxis = useMemo(() => [
    { period: 14000, phase: 0,    fromX: 60,  toX: 320 },
    { period: 17000, phase: 0.5,  fromX: 320, toX: 60 },
  ], []);

  // Departing plane uses stage-driven translation; idle/boarding/ready
  // it sits at gate, on departing it rolls fast down the runway.
  const departingX = departing ? 360 : 90;
  const departingRotate = departing ? -16 : 0;
  const departingY = departing ? -64 : 0;

  return (
    <div style={dioramaWrap}>
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYEnd slice" style={dioramaSvg} aria-hidden>
        <defs>
          <linearGradient id="ground-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0F1734" stopOpacity="0" />
            <stop offset="0.4" stopColor="#0B1426" stopOpacity="0.85" />
            <stop offset="1" stopColor="#050912" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="terminal-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3A4A75" />
            <stop offset="1" stopColor="#1F2A4D" />
          </linearGradient>
          <radialGradient id="runway-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={COLOR.gold.base} stopOpacity="0.4" />
            <stop offset="1" stopColor={COLOR.gold.base} stopOpacity="0" />
          </radialGradient>
          <style>{`
            @keyframes splashBeacon { 0%,100% { opacity: 0.15 } 50% { opacity: 1 } }
            @keyframes splashWindow { 0%,100% { opacity: 0.55 } 50% { opacity: 0.95 } }
            @keyframes splashRunwayStrobe { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }
            @keyframes splashTaxiLight { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }
            @keyframes splashExpandPulse {
              0%,100% { transform: translateY(0); opacity: 0.65 }
              50% { transform: translateY(-3px); opacity: 1 }
            }
            @keyframes splashBelt { 0% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: -16 } }
            @media (prefers-reduced-motion: reduce) {
              * { animation: none !important; }
            }
          `}</style>
        </defs>

        {/* Ground fade so the diorama blends into the sky above */}
        <rect x="0" y="0" width="400" height="240" fill="url(#ground-fade)" />

        {/* Runway with golden approach lights + designation 27 */}
        <g>
          <rect x="0" y="195" width="400" height="14" fill="#10172E" />
          <rect x="0" y="200" width="400" height="4" fill="#1A2244" />
          {/* Centerline dashes */}
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} x={10 + i * 28} y={201} width="16" height="2" fill="#94A3B8" opacity="0.65" />
          ))}
          {/* Edge strobes */}
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={`edge-${i}`} cx={10 + i * 28} cy={196}
              r="1.2" fill={COLOR.gold.base}
              style={{
                animation: `splashRunwayStrobe ${0.9 + (i % 3) * 0.15}s ease-in-out ${i * 0.08}s infinite`,
                filter: `drop-shadow(0 0 4px ${COLOR.gold.base})`,
              }} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={`edge2-${i}`} cx={10 + i * 28} cy={208}
              r="1.2" fill={COLOR.gold.base}
              style={{
                animation: `splashRunwayStrobe ${1.1 + (i % 3) * 0.15}s ease-in-out ${i * 0.08 + 0.4}s infinite`,
                filter: `drop-shadow(0 0 4px ${COLOR.gold.base})`,
              }} />
          ))}
          {/* Approach lights — extra bright trailing into right edge */}
          {[362, 370, 378, 386, 394].map((cx, i) => (
            <circle key={`appr-${cx}`} cx={cx} cy={202} r="1.4" fill={COLOR.gold.light}
              style={{
                animation: `splashRunwayStrobe 0.6s ease-in-out ${i * 0.08}s infinite`,
                filter: `drop-shadow(0 0 6px ${COLOR.gold.base})`,
              }} />
          ))}
          {/* Runway designation 27 */}
          <text x="372" y="223" textAnchor="middle" fontSize="14" fontWeight="900"
            fill="#475569" letterSpacing="0.08em" fontFamily="ui-monospace, Menlo, monospace">27</text>
          {/* Big golden glow over arrival end */}
          <circle cx="380" cy="202" r="36" fill="url(#runway-glow)" />
        </g>

        {/* Taxiway parallel to runway, slightly above */}
        <rect x="0" y="178" width="400" height="2" fill="#1E293B" opacity="0.85" />

        {/* Apron — service area */}
        <rect x="0" y="160" width="400" height="20" fill="#1A2244" opacity="0.55" />

        {/* Terminal building */}
        <g>
          {/* Main terminal */}
          <path d="M 30 162 L 30 124 L 60 110 L 240 110 L 270 124 L 270 162 Z" fill="url(#terminal-gradient)" />
          {/* Roofline accent */}
          <path d="M 30 124 L 60 110 L 240 110 L 270 124" stroke={tailColor} strokeOpacity="0.45" strokeWidth="0.8" fill="none" />
          {/* SKYHAVEN AIRPORT sign */}
          <rect x="76" y="135" width="148" height="11" fill="rgba(11,17,32,0.65)" />
          <text x="150" y="143" textAnchor="middle" fontSize="6.5" fontWeight="900" letterSpacing="0.18em"
            fill={tailColor}>SKYHAVEN AIRPORT</text>
          {/* Top deck windows */}
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={`tw-${i}`} x={36 + i * 11} y={117} width="6" height="5" fill={tailColor}
              opacity="0.55"
              style={{ animation: `splashWindow ${3 + (i % 3)}s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
          {/* Lower windows */}
          {Array.from({ length: 24 }, (_, i) => (
            <rect key={`bw-${i}`} x={36 + i * 10} y={150} width="5" height="6" fill={COLOR.gold.base}
              opacity="0.7"
              style={{ animation: `splashWindow ${4 + (i % 3)}s ease-in-out ${i * 0.14}s infinite` }} />
          ))}
        </g>

        {/* Control tower */}
        <g>
          <rect x="282" y="98" width="8" height="64" fill="#2A3556" />
          <rect x="276" y="86" width="20" height="13" rx="2" fill="#3A4A75" />
          <rect x="279" y="89" width="14" height="5" fill="#0F1734" />
          {/* Tower windows lit */}
          {[279, 283, 287].map((x) => (
            <rect key={x} x={x} y={90} width="2" height="3" fill={COLOR.gold.base} opacity="0.85"
              style={{ animation: `splashWindow 3.4s ease-in-out infinite` }} />
          ))}
          {/* Beacon */}
          <circle cx="286" cy="84" r="2" fill="#F87171"
            style={{ animation: 'splashBeacon 1.3s ease-in-out infinite' }} />
        </g>

        {/* Jet bridges + gates with parked aircraft */}
        {[
          { x: 84,  iata: 'A1' },
          { x: 130, iata: 'A2' },
          { x: 180, iata: 'A3' },
        ].map((g) => (
          <g key={g.iata}>
            {/* Jetbridge stub */}
            <rect x={g.x - 1} y={162} width="2" height="8" fill="#2A3556" />
            <rect x={g.x - 6} y={170} width="14" height="3" fill={tailColor} opacity="0.85" />
            {/* Parked plane */}
            <g transform={`translate(${g.x} 175)`}>
              <ellipse cx="0" cy="0" rx="14" ry="3.2" fill="#F8FAFC" />
              <path d="M -2 -1 L -8 -6 L -4 -7 L 2 -1 Z" fill={tailColor} opacity="0.9" />
              <path d="M -2 1 L -8 6 L -4 7 L 2 1 Z" fill={tailColor} opacity="0.9" />
              <path d="M -11 -2 L -14 -4 L -12 0 L -14 4 L -11 2 Z" fill={tailColor} />
              <circle cx="10" cy="0" r="1.2" fill={tailColor} />
              {/* Gate ID label */}
              <text x="0" y="14" textAnchor="middle" fontSize="3.5" fontWeight="800" fill={tailColor} opacity="0.7" letterSpacing="0.18em">{g.iata}</text>
              {/* Taxi light */}
              <circle cx="10.5" cy="0" r="0.7" fill={COLOR.gold.base}
                style={{ animation: 'splashTaxiLight 1.4s ease-in-out infinite' }} />
            </g>
          </g>
        ))}

        {/* Cargo apron + baggage belt + crates (right of terminal) */}
        <g transform="translate(286 165)">
          <rect x="0" y="0" width="58" height="10" fill="#243254" opacity="0.85" />
          <path d="M 4 5 L 54 5" stroke={COLOR.ink.muted} strokeWidth="0.8" strokeDasharray="4 4"
            style={{ animation: 'splashBelt 1.6s linear infinite' }} />
          <rect x="6"  y="2" width="3.5" height="2" fill={COLOR.gold.base} opacity="0.9" />
          <rect x="14" y="2" width="3.5" height="2" fill={COLOR.gold.base} opacity="0.8" />
          <rect x="24" y="2" width="3.5" height="2" fill={COLOR.gold.light} opacity="0.9" />
          <rect x="36" y="2" width="3.5" height="2" fill={COLOR.gold.base} opacity="0.85" />
          <rect x="44" y="2" width="3.5" height="2" fill={COLOR.gold.light} opacity="0.95" />
          <text x="4" y="-2" fontSize="3" fill={COLOR.ink.faint} letterSpacing="0.12em">CARGO</text>
        </g>

        {/* Taxiing aircraft on the apron taxiway */}
        {taxis.map((tx, i) => {
          const u = ((t / tx.period) + tx.phase) % 1;
          const x = tx.fromX + (tx.toX - tx.fromX) * u;
          const flipped = tx.toX < tx.fromX;
          return (
            <g key={`taxi-${i}`} transform={`translate(${x} 184) scale(${flipped ? -1 : 1} 1)`}>
              <ellipse cx="0" cy="0" rx="9" ry="2" fill="#F8FAFC" />
              <path d="M -1 -0.8 L -5 -4 L -3 -4.5 L 1 -0.8 Z" fill={tailColor} opacity="0.9" />
              <path d="M -1 0.8 L -5 4 L -3 4.5 L 1 0.8 Z" fill={tailColor} opacity="0.9" />
              <path d="M -7 -1 L -10 -2 L -8 0 L -10 2 L -7 1 Z" fill={tailColor} />
              <circle cx="7" cy="0" r="0.8" fill={COLOR.gold.base}
                style={{ animation: 'splashTaxiLight 1.0s ease-in-out infinite' }} />
            </g>
          );
        })}

        {/* Departing plane — sits at gate A4 (right of A3), rolls down
            the runway when stage=departing. */}
        <g style={{
          transform: `translateX(${departingX - 90}px) translateY(${departingY}px) rotate(${departingRotate}deg)`,
          transformOrigin: '90px 200px',
          transition: 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
        }}>
          <g transform="translate(220 175)">
            <ellipse cx="0" cy="0" rx="14" ry="3.2" fill="#F8FAFC" />
            <path d="M -2 -1 L -8 -6 L -4 -7 L 2 -1 Z" fill={tailColor} opacity="0.9" />
            <path d="M -2 1 L -8 6 L -4 7 L 2 1 Z" fill={tailColor} opacity="0.9" />
            <path d="M -11 -2 L -14 -4 L -12 0 L -14 4 L -11 2 Z" fill={tailColor} />
            <circle cx="10" cy="0" r="1.2" fill={tailColor} />
          </g>
          {/* Contrail when departing */}
          {departing && (
            <path
              d="M 195 175 L 90 175"
              stroke={tailColor}
              strokeWidth="2.4"
              strokeDasharray="8 5"
              strokeLinecap="round"
              opacity="0.65"
            />
          )}
        </g>

        {/* "EXPAND HERE" indicator — beside the apron */}
        <g transform="translate(34 188)" style={{ animation: 'splashExpandPulse 1.8s ease-in-out infinite' }}>
          <rect x="-22" y="-8" width="40" height="16" rx="3" fill="rgba(90,200,250,0.18)"
            stroke={tailColor} strokeWidth="0.6" strokeDasharray="3 2" />
          <text x="-2" y="-1" fontSize="4.5" fontWeight="800" textAnchor="middle"
            fill={tailColor} letterSpacing="0.16em">EXPAND</text>
          <text x="-2" y="4.5" fontSize="4.5" fontWeight="800" textAnchor="middle"
            fill={tailColor} letterSpacing="0.16em">HERE</text>
          {/* Down arrow */}
          <path d="M -2 7 L -2 11 M -4 9 L -2 11 L 0 9" stroke={tailColor} strokeWidth="1" fill="none" strokeLinecap="round" />
        </g>

        {/* Foreground road with cars driving */}
        <g>
          <rect x="0" y="222" width="400" height="6" fill="#0A0F1F" />
          <rect x="0" y="224" width="400" height="1" fill="#475569" opacity="0.6" />
          {/* Lane dashes */}
          {Array.from({ length: 28 }, (_, i) => (
            <rect key={`lane-${i}`} x={i * 16} y={224.7} width="6" height="0.6" fill="#94A3B8" opacity="0.45" />
          ))}
        </g>
        {cars.map((c, i) => {
          const u = ((t / c.period) + c.phase) % 1;
          const x = -20 + u * 440;
          return (
            <g key={`car-${i}`} transform={`translate(${x} ${222 + c.yOffset * 0.4})`}>
              <rect x="0" y="0" width="9" height="3" fill={c.color} opacity="0.92" />
              <rect x="2" y="-1.4" width="5" height="2" fill={c.color} opacity="0.65" />
              {/* Headlight glow forward */}
              <circle cx="9.5" cy="1.5" r="1.2" fill={COLOR.gold.base} opacity="0.6"
                style={{ filter: `drop-shadow(0 0 3px ${COLOR.gold.base})` }} />
              {/* Taillight backward */}
              <circle cx="-0.5" cy="1.5" r="0.6" fill="#F87171" opacity="0.55" />
            </g>
          );
        })}

        {/* Parking lot strip with parked cars */}
        <g>
          <rect x="284" y="148" width="80" height="11" fill="#1E2944" opacity="0.7" />
          {[286, 293, 300, 307, 314, 321, 328, 335, 342, 349, 356, 363].map((cx, i) => (
            <rect key={`pc-${cx}`} x={cx} y={151} width="5" height="3" fill={i % 3 === 0 ? COLOR.gold.base : '#3A4A75'} opacity="0.75" />
          ))}
        </g>

        {/* Passenger silhouettes walking from terminal to gates (boarding stage speeds them up) */}
        {Array.from({ length: 6 }, (_, i) => {
          const speed = boarding ? 2.4 : 5 + (i % 3);
          const period = speed * 1000;
          const u = ((t / period) + (i * 0.18) % 1) % 1;
          const x = 64 + u * 132;
          const colour = i === 1 ? COLOR.gold.base
            : i === 4 ? '#34D399'
            : i === 5 && ready ? '#F8FAFC'
            : '#94A3B8';
          return (
            <g key={`pax-${i}`} transform={`translate(${x} ${168 + (i % 2)})`} opacity="0.85">
              <circle cx="0" cy="0" r="1" fill={colour} />
              <rect x={-0.7} y={1} width="1.4" height="2.4" rx="0.4" fill={colour} />
            </g>
          );
        })}

        {/* Distant aircraft landing on runway 27 — only when stage=ready */}
        {ready && (
          <g style={{
            transform: 'translateX(-220px) translateY(-26px) rotate(6deg)',
            opacity: 0.9,
            animation: 'splashRunwayStrobe 0.001s linear forwards',
          }}>
            <g transform="translate(380 195)">
              <ellipse cx="0" cy="0" rx="10" ry="2.4" fill="#F8FAFC" />
              <path d="M -1 -0.8 L -5 -4 L -3 -4.5 L 1 -0.8 Z" fill={tailColor} />
              <path d="M -1 0.8 L -5 4 L -3 4.5 L 1 0.8 Z" fill={tailColor} />
              <path d="M -8 -1.6 L -12 -2.8 L -10 0 L -12 2.8 L -8 1.6 Z" fill={tailColor} />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function Wordmark({ text, tailColor }: { text: string; tailColor: string }) {
  return (
    <div style={wordmarkRow}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          initial={{ y: 24, opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.12 + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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

/* ─── Styles ──────────────────────────────────────────────────────── */

const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 90,
  background: COLOR.bg.deep,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'space-between',
  overflow: 'hidden',
  paddingTop: 'env(safe-area-inset-top, 0)',
  paddingBottom: 'env(safe-area-inset-bottom, 0)',
};

const skyGradient = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  inset: 0,
  background: `radial-gradient(ellipse at top, ${tail}22 0%, ${COLOR.bg.canvas} 35%, ${COLOR.bg.deep} 78%)`,
});

const hexGrid: React.CSSProperties = {
  position: 'absolute', inset: 0,
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='46' viewBox='0 0 40 46'><path d='M20 0 L40 11 L40 34 L20 45 L0 34 L0 11 Z' fill='none' stroke='%2394A3B822' stroke-width='1'/></svg>\")",
  backgroundSize: '40px 46px',
  opacity: 0.12,
};

const starsLayer: React.CSSProperties = {
  position: 'absolute', inset: 0,
  width: '100%', height: '100%',
  pointerEvents: 'none',
};

const mountainsLayer: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0,
  bottom: '48%',
  width: '100%',
  height: 80,
  opacity: 0.55,
  pointerEvents: 'none',
};

const citySkylineLayer: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0,
  bottom: '42%',
  width: '100%',
  height: 60,
  opacity: 0.65,
  pointerEvents: 'none',
};

const constellationLayer: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0,
  top: '6%',
  width: '100%',
  height: '46%',
  pointerEvents: 'none',
  zIndex: 2,
};

const brandWrap: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0,
  top: '22%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  pointerEvents: 'none',
  zIndex: 5,
};

const wordmarkRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
};
const wordmarkChar: React.CSSProperties = {
  fontSize: 44,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: COLOR.ink.primary,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  display: 'inline-block',
};
const subMark: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginTop: -2,
};
const subMarkText: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: '0.42em',
  color: COLOR.gold.base,
};
const subMarkUnderline: React.CSSProperties = {
  width: 48, height: 1.5, marginTop: 4,
  borderRadius: 1,
  background: COLOR.gold.base,
  boxShadow: `0 0 10px ${COLOR.gold.base}`,
};

const dioramaWrap: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0,
  bottom: '17%',
  height: '34%',
  width: '100%',
  pointerEvents: 'none',
  zIndex: 3,
};
const dioramaSvg: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
};

const ctaArea: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0,
  bottom: 12,
  padding: '0 16px',
  zIndex: 6,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: SPACE.s,
};

const promiseRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  marginBottom: SPACE.xs,
};
const promiseCell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  minWidth: 82,
};
const promiseSymbol: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
};
const promiseLabel: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.14em',
  color: COLOR.ink.muted,
  textTransform: 'uppercase',
};
const promiseDivider = (tail: string): React.CSSProperties => ({
  width: 1,
  height: 18,
  background: `linear-gradient(180deg, transparent, ${tail}66, transparent)`,
});

const ctaWrap: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
};
const ctaGlow = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  top: -10, left: -20, right: -20, bottom: 18,
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
  fontSize: 13,
  height: 48,
  letterSpacing: '0.12em',
};
const ctaHint: React.CSSProperties = {
  fontSize: 9,
  color: COLOR.ink.faint,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};
