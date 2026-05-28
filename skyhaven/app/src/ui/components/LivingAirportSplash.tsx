/**
 * LivingAirportSplash — opening screen rebuilt clean.
 *
 * Stripped down to exactly what the player asked for:
 *   - SKYHAVEN TYCOON wordmark (logo from the reference)
 *   - The airport diorama (terminal, control tower, gates, aircraft,
 *     cargo apron) from the reference
 *   - The runway with golden approach lights and the "27" designation
 *     from the reference, with an aircraft taking off from it
 *   - Distant mountains + a city skyline behind
 *   - Sky constellation with named destinations connected by route
 *     arcs and aircraft sprites traveling along them in real time
 *   - 90 twinkling stars across the sky
 *
 * What was removed (per the player's note):
 *   - Top stat pills (Founder Capital / Income / Next Goal)
 *   - Three action cards (Open Route / Buy Aircraft / Upgrade Airport)
 *   - Current Objective row
 *   - Live Airport Activity ticker
 *
 * What's still moving:
 *   - Seven aircraft along seven route arcs in the sky
 *   - One hot gold route with a brighter aircraft
 *   - Runway edge lights strobe in sequence
 *   - Control tower beacon strobes
 *   - Aircraft physically takes off down the runway every cycle
 *   - Two aircraft taxi back and forth on the apron taxiway
 *   - Six cars drive across the foreground road
 *   - Cargo baggage belt scrolls
 *   - Tiny passenger silhouettes walk from terminal to gates
 *   - Terminal windows + city skyline windows twinkle on their own phases
 *   - Stars twinkle
 *   - SKYHAVEN wordmark glows softly
 *
 * The player taps a small "Begin Boarding" CTA at the bottom to start.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { selectTailColor, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../design/Button';
import { COLOR, MOTION, RADIUS } from '../design/tokens';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

const DESTINATIONS: ReadonlyArray<{ iata: string; name: string; xPct: number; yPct: number }> = [
  { iata: 'NSH', name: 'Northshore',  xPct: 0.14, yPct: 0.18 },
  { iata: 'LKD', name: 'Lakeside',    xPct: 0.50, yPct: 0.10 },
  { iata: 'CBD', name: 'Cloudbridge', xPct: 0.88, yPct: 0.22 },
  { iata: 'PCT', name: 'Pinecrest',   xPct: 0.08, yPct: 0.52 },
  { iata: 'AUR', name: 'Aurora',      xPct: 0.76, yPct: 0.50 },
  { iata: 'RVM', name: 'Rivermouth',  xPct: 0.32, yPct: 0.76 },
  { iata: 'SVW', name: 'Seaview',     xPct: 0.90, yPct: 0.72 },
];

type BoardStage = 'idle' | 'boarding' | 'ready' | 'departing';

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
      haptics.medium(); sfx.tick(); setStage('boarding'); return;
    }
    if (stage === 'boarding') {
      haptics.medium(); sfx.tick(); setStage('ready'); return;
    }
    if (stage === 'ready') {
      haptics.success(); sfx.confirm(); setStage('departing');
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
          {/* Backdrop: gradient + stars + distant mountains + city skyline */}
          <SkyBackdrop tailColor={tailColor} />
          <Mountains />
          <CitySkyline tailColor={tailColor} />

          {/* SKYHAVEN TYCOON logo */}
          <div style={brandWrap}>
            <Wordmark text="SKYHAVEN" tailColor={tailColor} />
            <div style={brandSepRow}>
              <span style={brandSepLine} />
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden style={{ margin: '0 10px' }}>
                <path d="M 21 14 L 13 14 L 11 22 L 8 22 L 9 14 L 5 14 L 3 16 L 1 16 L 3 12 L 1 8 L 3 8 L 5 10 L 9 10 L 8 2 L 11 2 L 13 10 L 21 10 Z"
                  fill={COLOR.gold.base} />
              </svg>
              <span style={brandSepLine} />
            </div>
            <div style={subMarkText}>TYCOON</div>
          </div>

          {/* Sky constellation with moving aircraft */}
          <ConstellationStrip tailColor={tailColor} />

          {/* Big airport diorama with runway 27 + moving plane */}
          <AirportDiorama tailColor={tailColor} stage={stage} />

          {/* Begin Boarding CTA */}
          <div style={ctaArea}>
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
              {stage === 'idle' && 'Tap to enter the empire'}
              {stage === 'boarding' && 'Doors closing · 0:02'}
              {stage === 'ready' && 'Push back when ready'}
              {stage === 'departing' && 'Have a safe flight ✈'}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Backdrop ────────────────────────────────────────────────────── */

function SkyBackdrop({ tailColor }: { tailColor: string }) {
  const stars = useMemo(() => {
    const out: Array<{ x: number; y: number; r: number; o: number; dur: number; delay: number }> = [];
    let seed = 0xCAFE;
    const rnd = (): number => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 100000) / 100000; };
    for (let i = 0; i < 100; i++) {
      out.push({ x: rnd() * 100, y: rnd() * 55, r: 0.4 + rnd() * 1.1,
        o: 0.3 + rnd() * 0.55, dur: 2 + rnd() * 4, delay: rnd() * 4 });
    }
    return out;
  }, []);
  return (
    <>
      <div style={skyGradient(tailColor)} aria-hidden />
      <svg style={starsLayer} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.32} fill="#F8FAFC" opacity={s.o}>
            <animate attributeName="opacity" values={`${s.o};${s.o + 0.35};${s.o}`}
              dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
    </>
  );
}

function Mountains() {
  return (
    <svg style={mountainsLayer} viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="mountains-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B2347" />
          <stop offset="1" stopColor="#0A0F1F" />
        </linearGradient>
      </defs>
      <path
        d="M 0 200 L 0 130 L 90 80 L 160 110 L 220 70 L 310 100 L 400 60 L 500 95 L 590 70 L 690 110 L 790 75 L 880 105 L 950 85 L 1000 110 L 1000 200 Z"
        fill="url(#mountains-fill)" opacity="0.55" />
    </svg>
  );
}

function CitySkyline({ tailColor }: { tailColor: string }) {
  return (
    <svg style={cityLayer} viewBox="0 0 1000 140" preserveAspectRatio="none" aria-hidden>
      <path
        d="M 0 140 L 0 90 L 30 90 L 30 70 L 60 70 L 60 80 L 100 80 L 100 50 L 140 50 L 140 75 L 180 75 L 180 60 L 220 60 L 220 85 L 260 85 L 260 55 L 300 55 L 300 80 L 340 80 L 340 45 L 380 45 L 380 70 L 420 70 L 420 90 L 460 90 L 460 65 L 500 65 L 500 80 L 540 80 L 540 50 L 580 50 L 580 85 L 620 85 L 620 70 L 660 70 L 660 95 L 700 95 L 700 75 L 740 75 L 740 50 L 780 50 L 780 85 L 820 85 L 820 60 L 860 60 L 860 80 L 900 80 L 900 90 L 940 90 L 940 70 L 980 70 L 980 95 L 1000 95 L 1000 140 Z"
        fill="#0E1832" opacity="0.85"
      />
      {Array.from({ length: 80 }).map((_, i) => {
        const x = 20 + ((i * 12) % 980);
        const y = 60 + ((i * 17) % 70);
        return (
          <rect key={i} x={x} y={y} width="2" height="2.4" fill={tailColor} opacity="0.65">
            <animate attributeName="opacity" values={`${0.35 + (i % 3) * 0.1};${0.85 - (i % 3) * 0.05};${0.35 + (i % 3) * 0.1}`}
              dur={`${2.5 + (i % 4)}s`} begin={`${i * 0.11}s`} repeatCount="indefinite" />
          </rect>
        );
      })}
    </svg>
  );
}

/* ─── Wordmark ────────────────────────────────────────────────────── */

function Wordmark({ text, tailColor }: { text: string; tailColor: string }) {
  return (
    <div style={wordmarkRow}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          initial={{ y: 22, opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.08 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            ...wordmarkChar,
            textShadow: `0 0 22px ${tailColor}66, 0 0 60px ${tailColor}33`,
          } as Record<string, unknown>}
        >
          {ch}
        </motion.span>
      ))}
    </div>
  );
}

/* ─── Constellation strip ─────────────────────────────────────────── */

function ConstellationStrip({ tailColor }: { tailColor: string }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = (): void => { setNow(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const W = 1000, H = 540;
  const HOME = { x: 500, y: H - 20 };

  const arcs = useMemo(() => {
    return DESTINATIONS.map((d, i) => {
      const destX = d.xPct * W;
      const destY = d.yPct * H;
      const midX = (HOME.x + destX) / 2;
      const midY = Math.min(HOME.y, destY) - Math.abs(destX - HOME.x) * 0.14 - 36;
      const period = 9000 + i * 950 + d.iata.length * 200;
      const phase = ((i * 0.29) + 0.15) % 1;
      const hot = i === 2; // Cloudbridge — the gold "hot" line
      return { ...d, destX, destY, midX, midY, period, phase, hot };
    });
  }, [HOME.x, HOME.y]);

  return (
    <div style={constellationWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: '100%' }} aria-hidden>
        <defs>
          <radialGradient id="ls-pin-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={tailColor} stopOpacity="0.55" />
            <stop offset="1" stopColor={tailColor} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ls-hot-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={tailColor} stopOpacity="0" />
            <stop offset="0.45" stopColor={COLOR.gold.light} stopOpacity="1" />
            <stop offset="1" stopColor={COLOR.gold.base} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Subtle inter-city connections */}
        {([[0, 1], [1, 2], [3, 5], [4, 6], [1, 4]] as ReadonlyArray<readonly [number, number]>).map(([a, b], idx) => {
          const A = arcs[a]; const B = arcs[b];
          if (!A || !B) return null;
          return (
            <line key={`inter-${idx}`}
              x1={A.destX} y1={A.destY} x2={B.destX} y2={B.destY}
              stroke={tailColor} strokeOpacity="0.18" strokeWidth="0.8" strokeDasharray="3 3" />
          );
        })}

        {/* Arcs */}
        {arcs.map((arc) => (
          <path
            key={`arc-${arc.iata}`}
            d={`M ${HOME.x} ${HOME.y} Q ${arc.midX} ${arc.midY} ${arc.destX} ${arc.destY}`}
            stroke={arc.hot ? 'url(#ls-hot-arc)' : tailColor}
            strokeOpacity={arc.hot ? 1 : 0.35}
            strokeWidth={arc.hot ? 2.8 : 1}
            strokeDasharray={arc.hot ? '0' : '5 4'}
            fill="none"
            style={arc.hot ? { filter: `drop-shadow(0 0 6px ${COLOR.gold.base})` } : {}}
          />
        ))}

        {/* Pins */}
        {arcs.map((arc) => (
          <g key={`pin-${arc.iata}`}>
            <circle cx={arc.destX} cy={arc.destY} r="26" fill="url(#ls-pin-glow)" />
            <circle cx={arc.destX} cy={arc.destY} r="3.6" fill={arc.hot ? COLOR.gold.base : tailColor}
              style={{ filter: `drop-shadow(0 0 5px ${arc.hot ? COLOR.gold.base : tailColor})` }} />
            <text x={arc.destX} y={arc.destY - 12} textAnchor="middle"
              fill="#CBD5E1" fontSize="14" fontWeight="700" letterSpacing="0.06em">
              {arc.name}
            </text>
          </g>
        ))}

        {/* Aircraft sprites traveling along arcs */}
        {arcs.map((arc) => {
          const t = ((now / arc.period) + arc.phase) % 1;
          const u = 1 - t;
          const x = u * u * HOME.x + 2 * u * t * arc.midX + t * t * arc.destX;
          const y = u * u * HOME.y + 2 * u * t * arc.midY + t * t * arc.destY;
          const tx = 2 * u * (arc.midX - HOME.x) + 2 * t * (arc.destX - arc.midX);
          const ty = 2 * u * (arc.midY - HOME.y) + 2 * t * (arc.destY - arc.midY);
          const angle = (Math.atan2(ty, tx) * 180) / Math.PI;
          const accent = arc.hot ? COLOR.gold.base : tailColor;
          const scale = arc.hot ? 1.7 : 1;
          return (
            <g key={`ac-${arc.iata}`} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
              {arc.hot
                ? <path d="M -30 0 L -7 0" stroke={accent} strokeWidth="1.5" opacity="0.75" strokeLinecap="round" />
                : <path d="M -20 0 L -6 0" stroke={accent} strokeWidth="1.1" opacity="0.5" strokeLinecap="round" />
              }
              <path d="M -6 0 L 6 -1.9 L 6 1.9 Z" fill="#F8FAFC" />
              <path d="M -2 -3 L 1 -3 L 0 0 Z" fill={accent} />
              <path d="M -2 3 L 1 3 L 0 0 Z" fill={accent} />
              <circle cx="6" cy="0" r="1.1" fill={accent} />
            </g>
          );
        })}

        {/* Home halo */}
        <circle cx={HOME.x} cy={HOME.y} r="32" fill="url(#ls-pin-glow)" />
      </svg>
    </div>
  );
}

/* ─── Airport diorama with runway 27 ──────────────────────────────── */

function AirportDiorama({ tailColor, stage }: { tailColor: string; stage: BoardStage }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = (): void => { setT(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cars = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    period: 8500 + i * 1800,
    phase: (i * 0.19) % 1,
    color: i === 0 ? COLOR.gold.base : i === 2 ? tailColor : i === 4 ? '#34D399' : '#94A3B8',
    yOffset: i % 2 === 0 ? 0 : 3,
  })), [tailColor]);

  const taxis = useMemo(() => [
    { period: 13000, phase: 0,    fromX: 70,  toX: 320 },
    { period: 16000, phase: 0.5,  fromX: 320, toX: 70 },
  ], []);

  // The runway aircraft. In idle/boarding it parks at the runway
  // threshold; when the player taps Clear for Takeoff it rolls right
  // and lifts off. Otherwise on its own ~14s loop it taxis + takes
  // off from the runway repeatedly (so the runway always feels live).
  const departing = stage === 'departing';

  return (
    <div style={dioramaWrap}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYEnd slice" style={{ display: 'block', width: '100%', height: '100%' }} aria-hidden>
        <defs>
          <linearGradient id="lsd-ground-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0F1734" stopOpacity="0" />
            <stop offset="0.3" stopColor="#0B1426" stopOpacity="0.85" />
            <stop offset="1" stopColor="#050912" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="lsd-terminal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3A4A75" />
            <stop offset="1" stopColor="#1F2A4D" />
          </linearGradient>
          <linearGradient id="lsd-roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4A5C8A" />
            <stop offset="1" stopColor="#28335A" />
          </linearGradient>
          <radialGradient id="lsd-runway-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={COLOR.gold.base} stopOpacity="0.45" />
            <stop offset="1" stopColor={COLOR.gold.base} stopOpacity="0" />
          </radialGradient>
          <style>{`
            @keyframes lsdBeacon { 0%,100% { opacity: 0.18 } 50% { opacity: 1 } }
            @keyframes lsdWindow { 0%,100% { opacity: 0.55 } 50% { opacity: 0.95 } }
            @keyframes lsdStrobe { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }
            @keyframes lsdTaxiLight { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }
            @keyframes lsdExpand {
              0%,100% { transform: translateY(0); opacity: 0.75 }
              50% { transform: translateY(-3px); opacity: 1 }
            }
            @keyframes lsdBelt { 0% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: -16 } }
            /* Runway takeoff: aircraft accelerates from threshold, lifts
               at ~70% across, climbs up + rotates as it leaves the
               runway. Hidden the rest of the cycle so it feels periodic. */
            @keyframes lsdRunwayTakeoff {
              0% { transform: translateX(0) translateY(0) rotate(0); opacity: 0; }
              4% { opacity: 1; }
              65% { transform: translateX(280px) translateY(0) rotate(0); opacity: 1; }
              80% { transform: translateX(320px) translateY(-18px) rotate(-14deg); opacity: 1; }
              95% { transform: translateX(360px) translateY(-50px) rotate(-22deg); opacity: 0.6; }
              100% { transform: translateX(380px) translateY(-70px) rotate(-22deg); opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              * { animation: none !important; }
            }
          `}</style>
        </defs>

        {/* Ground fade — blends sky into airport */}
        <rect x="0" y="0" width="400" height="300" fill="url(#lsd-ground-fade)" />

        {/* Runway with "27" designation + golden lights — sits at the
            very bottom, anchored to the right end. */}
        <g>
          <rect x="0" y="248" width="400" height="14" fill="#10172E" />
          <rect x="0" y="254" width="400" height="3" fill="#1A2244" />
          {/* Centerline dashes */}
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={`cl-${i}`} x={10 + i * 28} y={254.6} width="16" height="2" fill="#94A3B8" opacity="0.7" />
          ))}
          {/* Edge strobes */}
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={`et-${i}`} cx={10 + i * 28} cy={249}
              r="1.4" fill={COLOR.gold.base}
              style={{
                animation: `lsdStrobe ${0.9 + (i % 3) * 0.15}s ease-in-out ${i * 0.08}s infinite`,
                filter: `drop-shadow(0 0 4px ${COLOR.gold.base})`,
              }} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={`eb-${i}`} cx={10 + i * 28} cy={261}
              r="1.4" fill={COLOR.gold.base}
              style={{
                animation: `lsdStrobe ${1.1 + (i % 3) * 0.15}s ease-in-out ${i * 0.08 + 0.4}s infinite`,
                filter: `drop-shadow(0 0 4px ${COLOR.gold.base})`,
              }} />
          ))}
          {/* Bright approach lights at the right end */}
          {[362, 370, 378, 386, 394].map((cx, i) => (
            <circle key={`appr-${cx}`} cx={cx} cy={255} r="1.6" fill={COLOR.gold.light}
              style={{
                animation: `lsdStrobe 0.55s ease-in-out ${i * 0.08}s infinite`,
                filter: `drop-shadow(0 0 6px ${COLOR.gold.base})`,
              }} />
          ))}
          {/* Glow halo over arrival end */}
          <circle cx="380" cy="255" r="38" fill="url(#lsd-runway-glow)" />
          {/* "27" designation — large, in the runway center */}
          <text x="372" y="282" textAnchor="middle" fontSize="26" fontWeight="900"
            fill="#475569" letterSpacing="0.08em"
            fontFamily="ui-monospace, Menlo, monospace" opacity="0.92">27</text>
        </g>

        {/* Apron/taxiway above the runway */}
        <rect x="0" y="228" width="400" height="2" fill="#1E293B" opacity="0.85" />
        <rect x="0" y="208" width="400" height="20" fill="#1A2244" opacity="0.55" />

        {/* Control tower (left side) */}
        <g>
          <rect x="38" y="128" width="9" height="84" fill="#2A3556" />
          <rect x="40" y="132" width="1" height="78" fill="#475569" opacity="0.5" />
          <rect x="44" y="132" width="1" height="78" fill="#475569" opacity="0.5" />
          <rect x="30" y="116" width="25" height="14" rx="2" fill="#3A4A75" />
          <rect x="33" y="119" width="19" height="6" fill="#0F1734" />
          {[34, 38, 42, 46].map((x, i) => (
            <rect key={x} x={x} y={120} width="2.4" height="4" fill={COLOR.gold.base} opacity="0.85"
              style={{ animation: `lsdWindow ${3 + i * 0.4}s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
          {/* Antenna + beacon */}
          <rect x="41.5" y="110" width="1.6" height="6" fill="#475569" />
          <circle cx="42.3" cy="110" r="2" fill="#F87171"
            style={{ animation: 'lsdBeacon 1.3s ease-in-out infinite' }} />
        </g>

        {/* Terminal building */}
        <g>
          <path d="M 60 228 L 60 152 L 84 136 L 240 136 L 264 152 L 264 228 Z" fill="url(#lsd-terminal)" />
          <path d="M 60 152 L 84 136 L 240 136 L 264 152" fill="url(#lsd-roof)" opacity="0.85" />
          <path d="M 60 152 L 84 136 L 240 136 L 264 152" stroke={tailColor} strokeOpacity="0.45" strokeWidth="0.9" fill="none" />
          {/* SKYHAVEN AIRPORT sign */}
          <rect x="92" y="163" width="140" height="13" fill="rgba(11,17,32,0.78)" rx="1" />
          <text x="162" y="172" textAnchor="middle" fontSize="7.5" fontWeight="900" letterSpacing="0.2em"
            fill={tailColor}>SKYHAVEN AIRPORT</text>
          {/* Top deck windows */}
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={`tw-${i}`} x={68 + i * 9} y={142} width="5" height="6" fill={tailColor}
              opacity="0.55"
              style={{ animation: `lsdWindow ${3 + (i % 3)}s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
          {/* Lower deck windows */}
          {Array.from({ length: 26 }, (_, i) => (
            <rect key={`bw-${i}`} x={66 + i * 7.8} y={196} width="4" height="6" fill={COLOR.gold.base}
              opacity="0.7"
              style={{ animation: `lsdWindow ${4 + (i % 3)}s ease-in-out ${i * 0.14}s infinite` }} />
          ))}
          {/* Entry doors */}
          {[140, 156, 172, 188].map((x) => (
            <rect key={`door-${x}`} x={x} y={213} width="3" height="11" fill="#0F1734" />
          ))}
        </g>

        {/* Three gates with parked aircraft */}
        {[
          { x: 96,  iata: 'A1', kind: 'turbo' as const },
          { x: 152, iata: 'A2', kind: 'jet' as const },
          { x: 210, iata: 'A3', kind: 'turbo' as const },
        ].map((g) => (
          <g key={g.iata}>
            <rect x={g.x - 1} y={227} width="2" height="11" fill="#2A3556" />
            <rect x={g.x - 7} y={238} width="16" height="3" fill={tailColor} opacity="0.85" />
            <ParkedPlane x={g.x} y={244} tail={tailColor} variant={g.kind} />
            <text x={g.x} y={224} textAnchor="middle" fontSize="5" fontWeight="800"
              fill={tailColor} letterSpacing="0.18em" opacity="0.8">{g.iata}</text>
            <circle cx={g.x + 11} cy={244} r="0.8" fill={COLOR.gold.base}
              style={{ animation: 'lsdTaxiLight 1.4s ease-in-out infinite' }} />
          </g>
        ))}

        {/* Cargo apron */}
        <g transform="translate(278 213)">
          <rect x="0" y="0" width="62" height="11" fill="#243254" opacity="0.85" rx="1" />
          <path d="M 4 5.5 L 58 5.5" stroke={COLOR.ink.muted} strokeWidth="0.8" strokeDasharray="4 4"
            style={{ animation: 'lsdBelt 1.6s linear infinite' }} />
          {[6, 14, 24, 34, 44, 52].map((x, i) => (
            <rect key={x} x={x} y={2.5} width="3.5" height="2" fill={i % 2 === 0 ? COLOR.gold.base : COLOR.gold.light}
              opacity={0.8 + (i % 2) * 0.1} />
          ))}
          <text x="4" y="-2" fontSize="3.6" fontWeight="800" fill={COLOR.ink.muted} letterSpacing="0.16em">CARGO</text>
        </g>

        {/* Apron taxiing aircraft */}
        {taxis.map((tx, i) => {
          const u = ((t / tx.period) + tx.phase) % 1;
          const x = tx.fromX + (tx.toX - tx.fromX) * u;
          const flipped = tx.toX < tx.fromX;
          return (
            <g key={`taxi-${i}`} transform={`translate(${x} 231) scale(${flipped ? -1 : 1} 1)`}>
              <ellipse cx="0" cy="0" rx="9" ry="2" fill="#F8FAFC" />
              <path d="M -1 -0.8 L -5 -4 L -3 -4.5 L 1 -0.8 Z" fill={tailColor} opacity="0.9" />
              <path d="M -1 0.8 L -5 4 L -3 4.5 L 1 0.8 Z" fill={tailColor} opacity="0.9" />
              <path d="M -7 -1 L -10 -2 L -8 0 L -10 2 L -7 1 Z" fill={tailColor} />
              <circle cx="7" cy="0" r="0.8" fill={COLOR.gold.base}
                style={{ animation: 'lsdTaxiLight 1.0s ease-in-out infinite' }} />
            </g>
          );
        })}

        {/* The RUNWAY AIRCRAFT — takes off down runway 27.
            - On its own when idle/boarding/ready: cycles every 14s.
            - On `departing`: the cycle is overridden by an explicit
              transform sliding the plane down the runway + tilting up. */}
        {!departing && (
          <g style={{
            transform: 'translate(0px, 0px)',
            animation: 'lsdRunwayTakeoff 14s linear infinite',
            transformOrigin: '20px 255px',
          }}>
            <g transform="translate(20 255)">
              <ellipse cx="0" cy="0" rx="13" ry="3" fill="#F8FAFC" />
              <path d="M -2 -1 L -8 -6 L -4 -7 L 2 -1 Z" fill={tailColor} opacity="0.92" />
              <path d="M -2 1 L -8 6 L -4 7 L 2 1 Z" fill={tailColor} opacity="0.92" />
              <path d="M -10 -2 L -13 -4 L -11 0 L -13 4 L -10 2 Z" fill={tailColor} />
              <circle cx="10" cy="0" r="1.2" fill={tailColor} />
              <path d="M -16 0 L -24 0" stroke={tailColor} strokeWidth="1.4" opacity="0.45" strokeLinecap="round" />
            </g>
          </g>
        )}
        {departing && (
          <g style={{
            transform: 'translateX(330px) translateY(-50px) rotate(-22deg)',
            transformOrigin: '20px 255px',
            transition: 'transform 1.5s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            <g transform="translate(20 255)">
              <ellipse cx="0" cy="0" rx="13" ry="3" fill="#F8FAFC" />
              <path d="M -2 -1 L -8 -6 L -4 -7 L 2 -1 Z" fill={tailColor} opacity="0.92" />
              <path d="M -2 1 L -8 6 L -4 7 L 2 1 Z" fill={tailColor} opacity="0.92" />
              <path d="M -10 -2 L -13 -4 L -11 0 L -13 4 L -10 2 Z" fill={tailColor} />
              <circle cx="10" cy="0" r="1.2" fill={tailColor} />
              <path d="M -16 0 L -36 0" stroke={tailColor} strokeWidth="2" opacity="0.65"
                strokeDasharray="8 5" strokeLinecap="round" />
            </g>
          </g>
        )}

        {/* "EXPAND HERE" tag on the left */}
        <g transform="translate(54 244)" style={{ animation: 'lsdExpand 1.8s ease-in-out infinite' }}>
          <rect x="-22" y="-9" width="44" height="18" rx="3" fill="rgba(90,200,250,0.18)"
            stroke={tailColor} strokeWidth="0.7" strokeDasharray="3 2" />
          <text x="0" y="-2" fontSize="5" fontWeight="800" textAnchor="middle"
            fill={tailColor} letterSpacing="0.16em">EXPAND</text>
          <text x="0" y="4" fontSize="5" fontWeight="800" textAnchor="middle"
            fill={tailColor} letterSpacing="0.16em">HERE</text>
          <path d="M 0 8 L 0 13 M -2 11 L 0 13 L 2 11" stroke={tailColor} strokeWidth="1" fill="none" strokeLinecap="round" />
        </g>

        {/* Foreground road with cars */}
        <g>
          <rect x="0" y="278" width="400" height="7" fill="#0A0F1F" />
          <rect x="0" y="280.5" width="400" height="1" fill="#475569" opacity="0.6" />
          {Array.from({ length: 28 }, (_, i) => (
            <rect key={`lane-${i}`} x={i * 16} y={281.4} width="6" height="0.6" fill="#94A3B8" opacity="0.45" />
          ))}
        </g>
        {cars.map((c, i) => {
          const u = ((t / c.period) + c.phase) % 1;
          const x = -20 + u * 440;
          return (
            <g key={`car-${i}`} transform={`translate(${x} ${278 + c.yOffset * 0.4})`}>
              <rect x="0" y="0" width="11" height="3.5" fill={c.color} opacity="0.92" rx="0.5" />
              <rect x="2" y="-1.6" width="6" height="2.2" fill={c.color} opacity="0.65" rx="0.4" />
              <circle cx="11.5" cy="1.8" r="1.2" fill={COLOR.gold.base} opacity="0.7"
                style={{ filter: `drop-shadow(0 0 3px ${COLOR.gold.base})` }} />
              <circle cx="-0.5" cy="1.8" r="0.6" fill="#F87171" opacity="0.55" />
            </g>
          );
        })}

        {/* Parking lot strip */}
        <g>
          <rect x="290" y="194" width="84" height="12" fill="#1E2944" opacity="0.7" rx="1" />
          {[292, 300, 308, 316, 324, 332, 340, 348, 356, 364].map((cx, i) => (
            <rect key={`pc-${cx}`} x={cx} y={197} width="5" height="3.5" fill={i % 3 === 0 ? COLOR.gold.base : '#3A4A75'}
              opacity="0.8" rx="0.4" />
          ))}
        </g>

        {/* Passenger silhouettes walking toward gates */}
        {Array.from({ length: 7 }, (_, i) => {
          const speed = 5 + (i % 3);
          const period = speed * 1000;
          const u = ((t / period) + (i * 0.15)) % 1;
          const x = 70 + u * 150;
          const colour = i === 1 ? COLOR.gold.base
            : i === 4 ? '#34D399'
            : i === 6 ? '#F8FAFC'
            : '#94A3B8';
          return (
            <g key={`pax-${i}`} transform={`translate(${x} ${221 + (i % 2)})`} opacity="0.85">
              <circle cx="0" cy="0" r="1" fill={colour} />
              <rect x={-0.7} y={1} width="1.4" height="2.4" rx="0.4" fill={colour} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ParkedPlane({ x, y, tail, variant }: { x: number; y: number; tail: string; variant: 'turbo' | 'jet' }) {
  if (variant === 'jet') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <ellipse cx="0" cy="0" rx="18" ry="3.5" fill="#F8FAFC" />
        <path d="M -3 -1 L -11 -8 L -6 -9 L 3 -1 Z" fill={tail} opacity="0.92" />
        <path d="M -3 1 L -11 8 L -6 9 L 3 1 Z" fill={tail} opacity="0.92" />
        <path d="M -14 -2 L -18 -5 L -16 0 L -18 5 L -14 2 Z" fill={tail} />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={-6 + i * 1.8} y={-0.7} width="1.2" height="1.4" fill="#0F1734" />
        ))}
        <circle cx="14" cy="0" r="1.4" fill={tail} />
        <ellipse cx="-2" cy="-5" rx="2" ry="1" fill="#2A3556" />
        <ellipse cx="-2" cy="5" rx="2" ry="1" fill="#2A3556" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx="13" ry="3" fill="#F8FAFC" />
      <path d="M -2 -1 L -8 -6 L -4 -7 L 2 -1 Z" fill={tail} opacity="0.92" />
      <path d="M -2 1 L -8 6 L -4 7 L 2 1 Z" fill={tail} opacity="0.92" />
      <path d="M -10 -2 L -13 -4 L -11 0 L -13 4 L -10 2 Z" fill={tail} />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={-4 + i * 1.6} y={-0.6} width="1.0" height="1.2" fill="#0F1734" />
      ))}
      <ellipse cx="-7" cy="-5" rx="0.8" ry="3" fill="#94A3B8" opacity="0.5" />
      <circle cx="10" cy="0" r="1.2" fill={tail} />
    </g>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 95,
  background: COLOR.bg.deep,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  paddingTop: 'env(safe-area-inset-top, 0)',
  paddingBottom: 'env(safe-area-inset-bottom, 0)',
};

const skyGradient = (tail: string): React.CSSProperties => ({
  position: 'absolute', inset: 0,
  background: `radial-gradient(ellipse at top, ${tail}1A 0%, ${COLOR.bg.canvas} 40%, ${COLOR.bg.deep} 80%)`,
});
const starsLayer: React.CSSProperties = {
  position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none',
};
const mountainsLayer: React.CSSProperties = {
  position: 'absolute', left: 0, right: 0, top: '32%',
  width: '100%', height: 90, opacity: 0.55, pointerEvents: 'none',
};
const cityLayer: React.CSSProperties = {
  position: 'absolute', left: 0, right: 0, top: '38%',
  width: '100%', height: 70, opacity: 0.7, pointerEvents: 'none',
};

const brandWrap: React.CSSProperties = {
  position: 'relative',
  zIndex: 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 16,
  paddingBottom: 4,
};
const wordmarkRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
};
const wordmarkChar: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 900,
  letterSpacing: '0.18em',
  color: COLOR.ink.primary,
  display: 'inline-block',
};
const brandSepRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: -2,
};
const brandSepLine: React.CSSProperties = {
  width: 56,
  height: 1,
  background: 'linear-gradient(90deg, transparent, rgba(244,199,91,0.7), transparent)',
};
const subMarkText: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: '0.55em',
  color: COLOR.gold.base,
};

const constellationWrap: React.CSSProperties = {
  position: 'relative',
  zIndex: 3,
  width: '100%',
  aspectRatio: '1000 / 540',
  flex: '0 0 auto',
  marginTop: 0,
};

const dioramaWrap: React.CSSProperties = {
  position: 'relative',
  zIndex: 3,
  width: '100%',
  aspectRatio: '400 / 300',
  flex: '1 1 auto',
  minHeight: 0,
  marginTop: -16,
};

const ctaArea: React.CSSProperties = {
  position: 'relative',
  zIndex: 5,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px 12px',
};
const ctaGlow = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  top: 0, left: '20%', right: '20%', bottom: 28,
  borderRadius: RADIUS.pill,
  background: `radial-gradient(ellipse at center, ${COLOR.gold.base}33 0%, ${tail}11 50%, transparent 75%)`,
  filter: 'blur(12px)',
  animation: 'breathe 2.4s ease-in-out infinite',
  pointerEvents: 'none',
});
const ctaButton: React.CSSProperties = {
  paddingLeft: 32,
  paddingRight: 32,
  fontSize: 13,
  height: 48,
  letterSpacing: '0.12em',
  zIndex: 1,
};
const ctaHint: React.CSSProperties = {
  fontSize: 9,
  color: COLOR.ink.faint,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  zIndex: 1,
};
