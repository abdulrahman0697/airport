/**
 * LivingAirportSplash — Design Review v8.
 *
 * Rebuilt to match the reference design 1:1. The opening screen
 * mirrors the in-game home shell layout (stat pills, wordmark,
 * sky network strip with destination pins, big illustrated airport
 * diorama, three action cards, current objective row, live activity
 * ticker) — but with monetary values hidden until the player starts.
 *
 * Everything moves: aircraft traverse the constellation arcs in real
 * time, the gold "hot" route has a brighter sprite, runway lights
 * strobe, the control tower beacon pulses, terminal windows twinkle,
 * three lit aircraft sit at the gates with subtle motion, two
 * aircraft physically taxi back and forth on the apron, five cars
 * drive across the foreground road, baggage carts loop on the apron,
 * an aircraft lands on the runway, the "EXPAND HERE" tag pulses, the
 * city skyline twinkles, and the activity ticker rotates through
 * synthetic flight events.
 *
 * Tapping any of the three action cards (or the BEGIN BOARDING CTA)
 * dismisses the splash into the founder flow.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { selectTailColor, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { COLOR, MOTION } from '../design/tokens';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

const DESTINATIONS: ReadonlyArray<{ iata: string; name: string; xPct: number; yPct: number }> = [
  { iata: 'NSH', name: 'Northshore',  xPct: 0.14, yPct: 0.16 },
  { iata: 'LKD', name: 'Lakeside',    xPct: 0.50, yPct: 0.10 },
  { iata: 'CBD', name: 'Cloudbridge', xPct: 0.88, yPct: 0.22 },
  { iata: 'PCT', name: 'Pinecrest',   xPct: 0.08, yPct: 0.50 },
  { iata: 'AUR', name: 'Aurora',      xPct: 0.78, yPct: 0.48 },
  { iata: 'RVM', name: 'Rivermouth',  xPct: 0.30, yPct: 0.72 },
  { iata: 'SVW', name: 'Seaview',     xPct: 0.90, yPct: 0.70 },
];

const TICKER_LINES: ReadonlyArray<{ flight: string; status: string; route: string; tone: 'boarding' | 'flying' | 'arrived' | 'cargo' }> = [
  { flight: 'SkyWings 204', status: 'boarding', route: 'Lakeside', tone: 'boarding' },
  { flight: 'SkyWings 118', status: 'landed',   route: 'Cloudbridge', tone: 'arrived' },
  { flight: 'SkyWings 071', status: 'departed', route: 'Aurora', tone: 'flying' },
  { flight: 'Cargo Run 32',  status: 'loading',  route: 'Northshore', tone: 'cargo' },
  { flight: 'SkyWings 246', status: 'cleared',  route: 'Rivermouth', tone: 'flying' },
  { flight: 'SkyWings 309', status: 'on final', route: 'Seaview', tone: 'arrived' },
];

export function LivingAirportSplash() {
  const introDismissed = useUiStore((s) => s.introDismissed);
  const dismissIntro = useUiStore((s) => s.dismissIntro);
  const tailColor = useGameStore(selectTailColor);

  const onBegin = (): void => {
    haptics.success();
    sfx.confirm();
    dismissIntro();
  };

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
          {/* Background */}
          <SkyBackdrop tailColor={tailColor} />

          {/* Scrollable content surface */}
          <div style={scroller}>
            {/* TOP STAT PILLS — labels only, dollar values hidden. */}
            <StatPillsRow tailColor={tailColor} />

            {/* SKYHAVEN TYCOON wordmark with small airplane icon between. */}
            <BrandHeader tailColor={tailColor} />

            {/* CONSTELLATION SKY VIEW with destination labels + moving aircraft. */}
            <ConstellationStrip tailColor={tailColor} />

            {/* AIRPORT DIORAMA — big detailed illustration with moving elements. */}
            <AirportDiorama tailColor={tailColor} />

            {/* THREE ACTION CARDS — Open Route / Buy Aircraft / Upgrade Airport. */}
            <ActionCardsRow tailColor={tailColor} onBegin={onBegin} />

            {/* CURRENT OBJECTIVE card. */}
            <ObjectiveRow tailColor={tailColor} />

            {/* LIVE AIRPORT ACTIVITY ticker. */}
            <LiveTicker tailColor={tailColor} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Top stat pills ─────────────────────────────────────────────── */

function StatPillsRow({ tailColor }: { tailColor: string }) {
  return (
    <div style={pillsRow}>
      <StatPill icon={<CoinIcon />} label="FOUNDER CAPITAL" value="—" />
      <StatPill icon={<TrendIcon />} label="INCOME / MIN" value="—" tone="cyan" />
      <StatPill icon={<GoalIcon tail={tailColor} />} label="NEXT GOAL" value="Unlock International Routes" tone="goal" />
    </div>
  );
}

function StatPill({ icon, label, value, tone = 'gold' }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'gold' | 'cyan' | 'goal';
}) {
  const colour = tone === 'gold' ? COLOR.gold.base : tone === 'cyan' ? '#34D399' : '#5AC8FA';
  return (
    <div style={pillShell(colour)}>
      <div style={pillIconWrap(colour)}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={pillLabel}>{label}</div>
        <div style={{ ...pillValue, color: tone === 'goal' ? '#F8FAFC' : colour }}>{value}</div>
      </div>
    </div>
  );
}

function CoinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="7" fill={COLOR.gold.base} stroke="#7A5C20" strokeWidth="0.8" />
      <text x="8" y="11" textAnchor="middle" fontSize="9" fontWeight="900" fill="#0B1120">$</text>
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path d="M 2 12 L 6 8 L 9 10 L 14 4" fill="none" stroke="#34D399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="4" r="1.4" fill="#34D399" />
    </svg>
  );
}
function GoalIcon({ tail }: { tail: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6.4" fill="none" stroke={tail} strokeWidth="1.4" />
      <circle cx="8" cy="8" r="3" fill="none" stroke={tail} strokeWidth="1.4" />
      <circle cx="8" cy="8" r="0.9" fill={tail} />
    </svg>
  );
}

/* ─── Brand header ────────────────────────────────────────────────── */

function BrandHeader({ tailColor }: { tailColor: string }) {
  return (
    <div style={brandWrap}>
      <Wordmark text="SKYHAVEN" tailColor={tailColor} />
      <div style={brandSepRow}>
        <span style={brandSepLine} />
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden style={{ margin: '0 8px' }}>
          <path d="M 21 14 L 13 14 L 11 22 L 8 22 L 9 14 L 5 14 L 3 16 L 1 16 L 3 12 L 1 8 L 3 8 L 5 10 L 9 10 L 8 2 L 11 2 L 13 10 L 21 10 Z"
            fill={COLOR.gold.base} />
        </svg>
        <span style={brandSepLine} />
      </div>
      <div style={subMarkText}>TYCOON</div>
    </div>
  );
}

function Wordmark({ text, tailColor }: { text: string; tailColor: string }) {
  return (
    <div style={wordmarkRow}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          initial={{ y: 20, opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.06 + i * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{
            ...wordmarkChar,
            textShadow: `0 0 18px ${tailColor}55, 0 0 50px ${tailColor}33`,
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
  const HOME = { x: 500, y: H - 24 };

  // Connect each destination to one or two others to form a network
  // graph, plus arcs to the home airport.
  const arcs = useMemo(() => {
    return DESTINATIONS.map((d, i) => {
      const destX = d.xPct * W;
      const destY = d.yPct * H;
      const midX = (HOME.x + destX) / 2;
      const midY = Math.min(HOME.y, destY) - Math.abs(destX - HOME.x) * 0.14 - 30;
      const period = 9000 + i * 950 + d.iata.length * 200;
      const phase = ((i * 0.29) + 0.15) % 1;
      // The hot arc is highlighted gold and animated brighter.
      const hot = i === 2; // Cloudbridge
      return { ...d, destX, destY, midX, midY, period, phase, hot };
    });
  }, [HOME.x, HOME.y]);

  return (
    <div style={constellationWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: '100%' }} aria-hidden>
        <defs>
          <radialGradient id="pin-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={tailColor} stopOpacity="0.55" />
            <stop offset="1" stopColor={tailColor} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hot-arc-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={tailColor} stopOpacity="0" />
            <stop offset="0.45" stopColor={COLOR.gold.light} stopOpacity="1" />
            <stop offset="1" stopColor={COLOR.gold.base} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* City inter-arcs (subtle) */}
        {([
          [0, 1], [1, 2], [3, 5], [4, 6], [1, 4],
        ] as ReadonlyArray<readonly [number, number]>).map(([a, b], idx) => {
          const A = arcs[a]; const B = arcs[b];
          if (!A || !B) return null;
          return (
            <line
              key={`inter-${idx}`}
              x1={A.destX} y1={A.destY} x2={B.destX} y2={B.destY}
              stroke={tailColor} strokeOpacity="0.18" strokeWidth="0.8" strokeDasharray="3 3"
            />
          );
        })}

        {/* Arcs from home to each destination */}
        {arcs.map((arc) => (
          <g key={`arc-${arc.iata}`}>
            <path
              d={`M ${HOME.x} ${HOME.y} Q ${arc.midX} ${arc.midY} ${arc.destX} ${arc.destY}`}
              stroke={arc.hot ? 'url(#hot-arc-grad)' : tailColor}
              strokeOpacity={arc.hot ? 1 : 0.35}
              strokeWidth={arc.hot ? 2.6 : 1}
              strokeDasharray={arc.hot ? '0' : '5 4'}
              fill="none"
              style={arc.hot ? { filter: `drop-shadow(0 0 6px ${COLOR.gold.base})` } : {}}
            />
          </g>
        ))}

        {/* Destination pin halos + dots + labels */}
        {arcs.map((arc) => (
          <g key={`pin-${arc.iata}`}>
            <circle cx={arc.destX} cy={arc.destY} r="24" fill="url(#pin-glow)" />
            <circle cx={arc.destX} cy={arc.destY} r="3.5" fill={arc.hot ? COLOR.gold.base : tailColor}
              style={{ filter: `drop-shadow(0 0 5px ${arc.hot ? COLOR.gold.base : tailColor})` }} />
            <text x={arc.destX} y={arc.destY - 12} textAnchor="middle"
              fill="#CBD5E1" fontSize="13" fontWeight="700" letterSpacing="0.06em">
              {arc.name}
            </text>
          </g>
        ))}

        {/* Aircraft sprites travel along each arc */}
        {arcs.map((arc) => {
          const t = ((now / arc.period) + arc.phase) % 1;
          const u = 1 - t;
          const x = u * u * HOME.x + 2 * u * t * arc.midX + t * t * arc.destX;
          const y = u * u * HOME.y + 2 * u * t * arc.midY + t * t * arc.destY;
          const tx = 2 * u * (arc.midX - HOME.x) + 2 * t * (arc.destX - arc.midX);
          const ty = 2 * u * (arc.midY - HOME.y) + 2 * t * (arc.destY - arc.midY);
          const angle = (Math.atan2(ty, tx) * 180) / Math.PI;
          const accent = arc.hot ? COLOR.gold.base : tailColor;
          const scale = arc.hot ? 1.6 : 1;
          return (
            <g key={`ac-${arc.iata}`} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
              {arc.hot && (
                <path d="M -28 0 L -7 0" stroke={accent} strokeWidth="1.4" opacity="0.7" strokeLinecap="round" />
              )}
              {!arc.hot && (
                <path d="M -18 0 L -6 0" stroke={accent} strokeWidth="1.0" opacity="0.45" strokeLinecap="round" />
              )}
              <path d="M -6 0 L 6 -1.8 L 6 1.8 Z" fill="#F8FAFC" />
              <path d="M -2 -3 L 1 -3 L 0 0 Z" fill={accent} />
              <path d="M -2 3 L 1 3 L 0 0 Z" fill={accent} />
              <circle cx="6" cy="0" r="1.1" fill={accent} />
            </g>
          );
        })}

        {/* Home pin halo */}
        <circle cx={HOME.x} cy={HOME.y} r="30" fill="url(#pin-glow)" />
      </svg>
    </div>
  );
}

/* ─── Airport diorama ─────────────────────────────────────────────── */

function AirportDiorama({ tailColor }: { tailColor: string }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = (): void => { setT(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cars = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    period: 9000 + i * 1800,
    phase: (i * 0.19) % 1,
    color: i === 0 ? COLOR.gold.base : i === 2 ? tailColor : i === 4 ? '#34D399' : '#94A3B8',
    yOffset: i % 2 === 0 ? 0 : 3,
  })), [tailColor]);

  const taxis = useMemo(() => [
    { period: 13000, phase: 0,    fromX: 70,  toX: 320 },
    { period: 16000, phase: 0.5,  fromX: 320, toX: 70 },
  ], []);

  // Landing aircraft cycle
  const landing = useMemo(() => ({ period: 22000, phase: 0.2 }), []);

  return (
    <div style={dioramaWrap}>
      <svg viewBox="0 0 400 270" preserveAspectRatio="xMidYEnd slice" style={{ display: 'block', width: '100%', height: '100%' }} aria-hidden>
        <defs>
          <linearGradient id="ground-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0F1734" stopOpacity="0" />
            <stop offset="0.35" stopColor="#0B1426" stopOpacity="0.85" />
            <stop offset="1" stopColor="#050912" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="terminal-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3A4A75" />
            <stop offset="1" stopColor="#1F2A4D" />
          </linearGradient>
          <linearGradient id="airport-roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4A5C8A" />
            <stop offset="1" stopColor="#28335A" />
          </linearGradient>
          <radialGradient id="runway-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={COLOR.gold.base} stopOpacity="0.35" />
            <stop offset="1" stopColor={COLOR.gold.base} stopOpacity="0" />
          </radialGradient>
          <style>{`
            @keyframes splashBeacon { 0%,100% { opacity: 0.18 } 50% { opacity: 1 } }
            @keyframes splashWindow { 0%,100% { opacity: 0.55 } 50% { opacity: 0.95 } }
            @keyframes splashRunwayStrobe { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }
            @keyframes splashTaxiLight { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }
            @keyframes splashExpandPulse {
              0%,100% { transform: translateY(0); opacity: 0.7 }
              50% { transform: translateY(-3px); opacity: 1 }
            }
            @keyframes splashBelt { 0% { stroke-dashoffset: 0 } 100% { stroke-dashoffset: -16 } }
            @media (prefers-reduced-motion: reduce) {
              * { animation: none !important; }
            }
          `}</style>
        </defs>

        {/* Ground fade so the diorama blends into the sky above */}
        <rect x="0" y="0" width="400" height="270" fill="url(#ground-fade)" />

        {/* Distant city skyline behind the airport */}
        <g opacity="0.55">
          <path
            d="M 0 130 L 0 110 L 30 110 L 30 90 L 60 90 L 60 100 L 90 100 L 90 80 L 120 80 L 120 95 L 150 95 L 150 105 L 180 105 L 180 75 L 210 75 L 210 100 L 240 100 L 240 85 L 270 85 L 270 100 L 300 100 L 300 80 L 330 80 L 330 95 L 360 95 L 360 110 L 400 110 L 400 130 Z"
            fill="#0E1832"
          />
          {[10, 35, 65, 95, 125, 155, 185, 215, 245, 275, 305, 335, 365].map((x, i) => (
            <rect key={i} x={x} y={90 + (i % 4) * 4} width="1.4" height="1.4" fill={tailColor} opacity="0.6">
              <animate attributeName="opacity" values={`${0.3};${0.8};${0.3}`} dur={`${2.5 + (i % 3)}s`}
                repeatCount="indefinite" begin={`${i * 0.18}s`} />
            </rect>
          ))}
        </g>

        {/* Runway with golden lights + "27" designation */}
        <g>
          <rect x="0" y="220" width="400" height="14" fill="#10172E" />
          <rect x="0" y="226" width="400" height="3" fill="#1A2244" />
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={`cl-${i}`} x={10 + i * 28} y={226.5} width="16" height="2" fill="#94A3B8" opacity="0.65" />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={`edge-top-${i}`} cx={10 + i * 28} cy={221}
              r="1.3" fill={COLOR.gold.base}
              style={{
                animation: `splashRunwayStrobe ${0.9 + (i % 3) * 0.15}s ease-in-out ${i * 0.08}s infinite`,
                filter: `drop-shadow(0 0 4px ${COLOR.gold.base})`,
              }} />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={`edge-bot-${i}`} cx={10 + i * 28} cy={233}
              r="1.3" fill={COLOR.gold.base}
              style={{
                animation: `splashRunwayStrobe ${1.1 + (i % 3) * 0.15}s ease-in-out ${i * 0.08 + 0.4}s infinite`,
                filter: `drop-shadow(0 0 4px ${COLOR.gold.base})`,
              }} />
          ))}
          {/* Bright approach lights at far right */}
          {[362, 370, 378, 386, 394].map((cx, i) => (
            <circle key={`appr-${cx}`} cx={cx} cy={227} r="1.5" fill={COLOR.gold.light}
              style={{
                animation: `splashRunwayStrobe 0.55s ease-in-out ${i * 0.08}s infinite`,
                filter: `drop-shadow(0 0 6px ${COLOR.gold.base})`,
              }} />
          ))}
          <circle cx="380" cy="227" r="36" fill="url(#runway-glow)" />
          {/* Runway designation 27 */}
          <text x="372" y="252" textAnchor="middle" fontSize="22" fontWeight="900"
            fill="#475569" letterSpacing="0.08em" fontFamily="ui-monospace, Menlo, monospace" opacity="0.9">27</text>
        </g>

        {/* Apron/taxiway */}
        <rect x="0" y="200" width="400" height="2" fill="#1E293B" opacity="0.85" />
        <rect x="0" y="180" width="400" height="20" fill="#1A2244" opacity="0.55" />

        {/* Control tower on the left */}
        <g>
          <rect x="38" y="105" width="9" height="80" fill="#2A3556" />
          {/* Tower vertical stripes */}
          <rect x="40" y="108" width="1" height="74" fill="#475569" opacity="0.5" />
          <rect x="44" y="108" width="1" height="74" fill="#475569" opacity="0.5" />
          {/* Cab */}
          <rect x="30" y="92" width="25" height="14" rx="2" fill="#3A4A75" />
          <rect x="33" y="95" width="19" height="6" fill="#0F1734" />
          {/* Tower windows lit */}
          {[34, 38, 42, 46].map((x, i) => (
            <rect key={x} x={x} y={96} width="2.4" height="4" fill={COLOR.gold.base} opacity="0.85"
              style={{ animation: `splashWindow ${3 + i * 0.4}s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
          {/* Antenna + beacon */}
          <rect x="41.5" y="86" width="1.6" height="6" fill="#475569" />
          <circle cx="42.3" cy="86" r="1.8" fill="#F87171"
            style={{ animation: 'splashBeacon 1.3s ease-in-out infinite' }} />
        </g>

        {/* Terminal building (large) */}
        <g>
          {/* Roof + curve */}
          <path d="M 60 200 L 60 132 L 84 116 L 240 116 L 264 132 L 264 200 Z" fill="url(#terminal-gradient)" />
          <path d="M 60 132 L 84 116 L 240 116 L 264 132" fill="url(#airport-roof)" opacity="0.85" />
          {/* Roofline accent */}
          <path d="M 60 132 L 84 116 L 240 116 L 264 132" stroke={tailColor} strokeOpacity="0.45" strokeWidth="0.9" fill="none" />
          {/* SKYHAVEN AIRPORT sign */}
          <rect x="92" y="143" width="140" height="13" fill="rgba(11,17,32,0.75)" rx="1" />
          <text x="162" y="152" textAnchor="middle" fontSize="7.5" fontWeight="900" letterSpacing="0.2em"
            fill={tailColor}>SKYHAVEN AIRPORT</text>
          {/* Top deck windows */}
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={`tw-${i}`} x={68 + i * 9} y={122} width="5" height="6" fill={tailColor}
              opacity="0.55"
              style={{ animation: `splashWindow ${3 + (i % 3)}s ease-in-out ${i * 0.18}s infinite` }} />
          ))}
          {/* Lower deck windows */}
          {Array.from({ length: 26 }, (_, i) => (
            <rect key={`bw-${i}`} x={66 + i * 7.8} y={172} width="4" height="6" fill={COLOR.gold.base}
              opacity="0.7"
              style={{ animation: `splashWindow ${4 + (i % 3)}s ease-in-out ${i * 0.14}s infinite` }} />
          ))}
          {/* Entry doors */}
          {[140, 156, 172, 188].map((x) => (
            <rect key={`door-${x}`} x={x} y={185} width="3" height="11" fill="#0F1734" />
          ))}
        </g>

        {/* Jet bridges + gates with parked aircraft */}
        {[
          { x: 96,  iata: 'A1', kind: 'turbo' as const },
          { x: 152, iata: 'A2', kind: 'jet' as const },
          { x: 210, iata: 'A3', kind: 'turbo' as const },
        ].map((g) => (
          <g key={g.iata}>
            {/* Jetbridge */}
            <rect x={g.x - 1} y={199} width="2" height="11" fill="#2A3556" />
            <rect x={g.x - 7} y={210} width="16" height="3" fill={tailColor} opacity="0.85" />
            {/* Parked plane */}
            <ParkedPlane x={g.x} y={216} tail={tailColor} variant={g.kind} />
            {/* Gate label */}
            <text x={g.x} y={196} textAnchor="middle" fontSize="5" fontWeight="800"
              fill={tailColor} letterSpacing="0.18em" opacity="0.8">{g.iata}</text>
            {/* Taxi light */}
            <circle cx={g.x + 11} cy={216} r="0.8" fill={COLOR.gold.base}
              style={{ animation: 'splashTaxiLight 1.4s ease-in-out infinite' }} />
          </g>
        ))}

        {/* Cargo apron + baggage belt */}
        <g transform="translate(278 185)">
          <rect x="0" y="0" width="62" height="11" fill="#243254" opacity="0.85" rx="1" />
          <path d="M 4 5.5 L 58 5.5" stroke={COLOR.ink.muted} strokeWidth="0.8" strokeDasharray="4 4"
            style={{ animation: 'splashBelt 1.6s linear infinite' }} />
          {[6, 14, 24, 34, 44, 52].map((x, i) => (
            <rect key={x} x={x} y={2.5} width="3.5" height="2" fill={i % 2 === 0 ? COLOR.gold.base : COLOR.gold.light} opacity={0.8 + (i % 2) * 0.1} />
          ))}
          <text x="4" y="-2" fontSize="3.6" fontWeight="800" fill={COLOR.ink.muted} letterSpacing="0.16em">CARGO</text>
        </g>

        {/* Taxiing aircraft on the apron taxiway */}
        {taxis.map((tx, i) => {
          const u = ((t / tx.period) + tx.phase) % 1;
          const x = tx.fromX + (tx.toX - tx.fromX) * u;
          const flipped = tx.toX < tx.fromX;
          return (
            <g key={`taxi-${i}`} transform={`translate(${x} 203) scale(${flipped ? -1 : 1} 1)`}>
              <ellipse cx="0" cy="0" rx="9" ry="2" fill="#F8FAFC" />
              <path d="M -1 -0.8 L -5 -4 L -3 -4.5 L 1 -0.8 Z" fill={tailColor} opacity="0.9" />
              <path d="M -1 0.8 L -5 4 L -3 4.5 L 1 0.8 Z" fill={tailColor} opacity="0.9" />
              <path d="M -7 -1 L -10 -2 L -8 0 L -10 2 L -7 1 Z" fill={tailColor} />
              <circle cx="7" cy="0" r="0.8" fill={COLOR.gold.base}
                style={{ animation: 'splashTaxiLight 1.0s ease-in-out infinite' }} />
            </g>
          );
        })}

        {/* "EXPAND HERE" indicator on the left */}
        <g transform="translate(54 215)" style={{ animation: 'splashExpandPulse 1.8s ease-in-out infinite' }}>
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
          <rect x="0" y="248" width="400" height="7" fill="#0A0F1F" />
          <rect x="0" y="250.5" width="400" height="1" fill="#475569" opacity="0.6" />
          {Array.from({ length: 28 }, (_, i) => (
            <rect key={`lane-${i}`} x={i * 16} y={251.4} width="6" height="0.6" fill="#94A3B8" opacity="0.45" />
          ))}
        </g>
        {cars.map((c, i) => {
          const u = ((t / c.period) + c.phase) % 1;
          const x = -20 + u * 440;
          return (
            <g key={`car-${i}`} transform={`translate(${x} ${248 + c.yOffset * 0.4})`}>
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
          <rect x="290" y="166" width="84" height="12" fill="#1E2944" opacity="0.7" rx="1" />
          {[292, 300, 308, 316, 324, 332, 340, 348, 356, 364].map((cx, i) => (
            <rect key={`pc-${cx}`} x={cx} y={169} width="5" height="3.5" fill={i % 3 === 0 ? COLOR.gold.base : '#3A4A75'} opacity="0.8" rx="0.4" />
          ))}
        </g>

        {/* Passenger silhouettes walking from terminal to gates */}
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
            <g key={`pax-${i}`} transform={`translate(${x} ${193 + (i % 2)})`} opacity="0.85">
              <circle cx="0" cy="0" r="1" fill={colour} />
              <rect x={-0.7} y={1} width="1.4" height="2.4" rx="0.4" fill={colour} />
            </g>
          );
        })}

        {/* Aircraft landing across the runway every ~22s */}
        {(() => {
          const u = ((t / landing.period) + landing.phase) % 1;
          if (u < 0.35 || u > 0.85) return null;
          const phase = (u - 0.35) / 0.5;
          const x = 380 - phase * 320;
          const y = 220 + Math.max(-20, -20 * (1 - phase * 1.5));
          const rot = Math.max(-6, -10 * (1 - phase * 1.3));
          return (
            <g transform={`translate(${x} ${y}) rotate(${rot})`}>
              <ellipse cx="0" cy="0" rx="11" ry="2.6" fill="#F8FAFC" />
              <path d="M -1.5 -1 L -6 -5 L -4 -5.5 L 1 -1 Z" fill={tailColor} />
              <path d="M -1.5 1 L -6 5 L -4 5.5 L 1 1 Z" fill={tailColor} />
              <path d="M -9 -2 L -12 -3 L -10 0 L -12 3 L -9 2 Z" fill={tailColor} />
              <path d="M 8 0 L 28 0" stroke={tailColor} strokeWidth="1.4" opacity="0.45" strokeLinecap="round" />
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

function ParkedPlane({ x, y, tail, variant }: { x: number; y: number; tail: string; variant: 'turbo' | 'jet' }) {
  // Two parked-plane styles so the gate row reads visually varied.
  if (variant === 'jet') {
    return (
      <g transform={`translate(${x} ${y})`}>
        {/* Wide-body jet */}
        <ellipse cx="0" cy="0" rx="18" ry="3.5" fill="#F8FAFC" />
        <path d="M -3 -1 L -11 -8 L -6 -9 L 3 -1 Z" fill={tail} opacity="0.92" />
        <path d="M -3 1 L -11 8 L -6 9 L 3 1 Z" fill={tail} opacity="0.92" />
        <path d="M -14 -2 L -18 -5 L -16 0 L -18 5 L -14 2 Z" fill={tail} />
        {/* Window strip */}
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={-6 + i * 1.8} y={-0.7} width="1.2" height="1.4" fill="#0F1734" />
        ))}
        <circle cx="14" cy="0" r="1.4" fill={tail} />
        {/* Engines on wings */}
        <ellipse cx="-2" cy="-5" rx="2" ry="1" fill="#2A3556" />
        <ellipse cx="-2" cy="5" rx="2" ry="1" fill="#2A3556" />
      </g>
    );
  }
  // Turboprop
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx="13" ry="3" fill="#F8FAFC" />
      <path d="M -2 -1 L -8 -6 L -4 -7 L 2 -1 Z" fill={tail} opacity="0.92" />
      <path d="M -2 1 L -8 6 L -4 7 L 2 1 Z" fill={tail} opacity="0.92" />
      <path d="M -10 -2 L -13 -4 L -11 0 L -13 4 L -10 2 Z" fill={tail} />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={-4 + i * 1.6} y={-0.6} width="1.0" height="1.2" fill="#0F1734" />
      ))}
      {/* Propeller blur on engine */}
      <ellipse cx="-7" cy="-5" rx="0.8" ry="3" fill="#94A3B8" opacity="0.5" />
      <circle cx="10" cy="0" r="1.2" fill={tail} />
    </g>
  );
}

/* ─── Action cards ────────────────────────────────────────────────── */

function ActionCardsRow({ tailColor, onBegin }: { tailColor: string; onBegin: () => void }) {
  return (
    <div style={actionRow}>
      <ActionCard
        title="OPEN ROUTE"
        subtitle="Grow your network"
        accent={tailColor}
        icon={<OpenRouteIcon tail={tailColor} />}
        onClick={onBegin}
      />
      <ActionCard
        title="BUY AIRCRAFT"
        subtitle="Expand your fleet"
        accent="#F8FAFC"
        icon={<BuyAircraftIcon tail={tailColor} />}
        onClick={onBegin}
      />
      <ActionCard
        title="UPGRADE AIRPORT"
        subtitle="Increase capacity & profits"
        accent={COLOR.gold.base}
        icon={<UpgradeAirportIcon />}
        onClick={onBegin}
      />
    </div>
  );
}

function ActionCard({ title, subtitle, accent, icon, onClick }: {
  title: string; subtitle: string; accent: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={actionCard(accent)}>
      <div style={actionCardIconBox}>{icon}</div>
      <div style={{ ...actionCardTitle, color: accent }}>{title}</div>
      <div style={actionCardSub}>{subtitle}</div>
    </button>
  );
}

function OpenRouteIcon({ tail }: { tail: string }) {
  return (
    <svg width="42" height="42" viewBox="0 0 64 64" aria-hidden>
      {/* Globe */}
      <circle cx="32" cy="34" r="22" fill="none" stroke={tail} strokeWidth="2" opacity="0.85" />
      <ellipse cx="32" cy="34" rx="22" ry="9" fill="none" stroke={tail} strokeWidth="1.4" opacity="0.55" />
      <line x1="32" y1="12" x2="32" y2="56" stroke={tail} strokeWidth="1.2" opacity="0.55" />
      <path d="M 32 12 Q 50 34 32 56" stroke={tail} strokeWidth="1.2" fill="none" opacity="0.55" />
      <path d="M 32 12 Q 14 34 32 56" stroke={tail} strokeWidth="1.2" fill="none" opacity="0.55" />
      {/* Pin marker on top of globe */}
      <path d="M 36 14 C 36 9, 28 9, 28 14 C 28 18, 32 24, 32 24 C 32 24, 36 18, 36 14 Z" fill={tail} />
      <circle cx="32" cy="14.5" r="2" fill="#0B1120" />
    </svg>
  );
}

function BuyAircraftIcon({ tail }: { tail: string }) {
  return (
    <svg width="56" height="42" viewBox="0 0 96 56" aria-hidden>
      {/* Aircraft body */}
      <path d="M 4 28 Q 4 22 14 20 L 76 20 Q 90 22 92 28 Q 90 34 76 36 L 14 36 Q 4 34 4 28 Z" fill="#F8FAFC" />
      {/* Nose */}
      <path d="M 4 28 Q 0 28 4 30 Z" fill="#F8FAFC" />
      {/* Cockpit window */}
      <path d="M 5 25 L 12 22 L 14 25 Z" fill="#0F1734" opacity="0.85" />
      {/* Window strip */}
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={20 + i * 4} y="26" width="2.5" height="3" fill="#0F1734" />
      ))}
      {/* Door */}
      <rect x="14" y="27" width="2.5" height="5" fill="#0F1734" opacity="0.5" />
      {/* Wing (large) */}
      <path d="M 30 30 L 60 30 L 50 50 L 26 50 Z" fill={tail} opacity="0.92" />
      {/* Engine pod */}
      <ellipse cx="44" cy="38" rx="4" ry="2.6" fill="#1F2A4D" />
      {/* Tail */}
      <path d="M 76 20 L 92 8 L 92 22 Z" fill={tail} />
      {/* Wheel */}
      <circle cx="34" cy="50" r="2.5" fill="#1F2A4D" />
      <circle cx="58" cy="50" r="2.5" fill="#1F2A4D" />
      <circle cx="12" cy="40" r="2" fill="#1F2A4D" />
    </svg>
  );
}

function UpgradeAirportIcon() {
  return (
    <svg width="44" height="42" viewBox="0 0 64 64" aria-hidden>
      {/* Building under construction */}
      <rect x="12" y="38" width="40" height="24" fill="#4A5C8A" />
      <rect x="14" y="40" width="4" height="6" fill="#F4C75B" opacity="0.9" />
      <rect x="20" y="40" width="4" height="6" fill="#F4C75B" opacity="0.7" />
      <rect x="26" y="40" width="4" height="6" fill="#F4C75B" opacity="0.85" />
      <rect x="32" y="40" width="4" height="6" fill="#F4C75B" opacity="0.6" />
      <rect x="38" y="40" width="4" height="6" fill="#F4C75B" opacity="0.9" />
      <rect x="44" y="40" width="4" height="6" fill="#F4C75B" opacity="0.7" />
      <rect x="14" y="50" width="4" height="6" fill="#F4C75B" opacity="0.65" />
      <rect x="20" y="50" width="4" height="6" fill="#F4C75B" opacity="0.9" />
      <rect x="26" y="50" width="4" height="6" fill="#F4C75B" opacity="0.75" />
      <rect x="32" y="50" width="4" height="6" fill="#F4C75B" opacity="0.55" />
      <rect x="38" y="50" width="4" height="6" fill="#F4C75B" opacity="0.85" />
      <rect x="44" y="50" width="4" height="6" fill="#F4C75B" opacity="0.7" />
      {/* Crane base */}
      <rect x="50" y="20" width="3" height="42" fill="#F4C75B" />
      <rect x="38" y="18" width="20" height="2" fill="#F4C75B" />
      <line x1="42" y1="20" x2="42" y2="32" stroke="#F4C75B" strokeWidth="0.8" />
      <rect x="40.5" y="32" width="3" height="3" fill="#F4C75B" />
      {/* Counterweight */}
      <rect x="55" y="16" width="6" height="6" fill="#F4C75B" />
      {/* Ground */}
      <rect x="0" y="60" width="64" height="2" fill="#0F1734" />
    </svg>
  );
}

/* ─── Objective row ───────────────────────────────────────────────── */

function ObjectiveRow({ tailColor }: { tailColor: string }) {
  return (
    <div style={objectiveCard(tailColor)}>
      <div style={objectiveIcon(tailColor)}>
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
          <rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke={tailColor} strokeWidth="1.6" />
          <rect x="9" y="2" width="6" height="3" rx="1" fill={tailColor} />
          <line x1="8" y1="11" x2="16" y2="11" stroke={tailColor} strokeWidth="1.3" strokeLinecap="round" />
          <line x1="8" y1="15" x2="14" y2="15" stroke={tailColor} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...objectiveKicker, color: tailColor }}>CURRENT OBJECTIVE</div>
        <div style={objectiveTitle}>Open your first commercial route</div>
        <div style={objectiveProgress}>0 / 1</div>
      </div>
      <div style={objectiveReward}>
        <div style={objectiveRewardKicker}>REWARD</div>
        <div style={objectiveRewardValueRow}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
            <rect x="2" y="4" width="12" height="8" rx="1" fill="#34D399" stroke="#0B1120" strokeWidth="0.6" />
            <circle cx="8" cy="8" r="2.5" fill="#0B1120" />
            <text x="8" y="10" textAnchor="middle" fontSize="3.4" fontWeight="900" fill="#34D399">$</text>
          </svg>
          <span style={objectiveRewardValue}>—</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Live activity ticker ───────────────────────────────────────── */

function LiveTicker({ tailColor }: { tailColor: string }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setIdx((i) => (i + 1) % TICKER_LINES.length), 3400);
    return () => window.clearInterval(id);
  }, []);
  const line = TICKER_LINES[idx]!;
  const accent = line.tone === 'arrived' ? '#34D399'
    : line.tone === 'boarding' ? tailColor
    : line.tone === 'cargo' ? COLOR.gold.base
    : '#5AC8FA';

  return (
    <div style={tickerCard}>
      <div style={tickerHead}>
        <span style={tickerLive(tailColor)}>
          <span style={tickerLiveDot} />
          LIVE AIRPORT ACTIVITY
        </span>
        <span style={tickerTime}>JUST NOW</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32 }}
          style={tickerBody as Record<string, unknown>}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path d="M 21 14 L 13 14 L 11 22 L 8 22 L 9 14 L 5 14 L 3 16 L 1 16 L 3 12 L 1 8 L 3 8 L 5 10 L 9 10 L 8 2 L 11 2 L 13 10 L 21 10 Z"
              fill={accent} />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={tickerLine1}>
              <span style={{ fontWeight: 800 }}>{line.flight}</span>
              <span style={{ color: accent, fontWeight: 800 }}> is {line.status}</span>
              <span style={{ color: '#94A3B8' }}> at Gate A1</span>
            </div>
            <div style={tickerLine2}>Next stop: <span style={{ color: accent }}>{line.route}</span></div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─── Background ──────────────────────────────────────────────────── */

function SkyBackdrop({ tailColor }: { tailColor: string }) {
  const stars = useMemo(() => {
    const out: Array<{ x: number; y: number; r: number; o: number; dur: number; delay: number }> = [];
    let seed = 0xCAFE;
    const rnd = (): number => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 100000) / 100000; };
    for (let i = 0; i < 90; i++) {
      out.push({ x: rnd() * 100, y: rnd() * 50, r: 0.4 + rnd() * 1.0,
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
            <animate attributeName="opacity" values={`${s.o};${s.o + 0.3};${s.o}`} dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
      <svg style={mountainsLayer} viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="mountains-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1B2347" />
            <stop offset="1" stopColor="#0A0F1F" />
          </linearGradient>
        </defs>
        <path
          d="M 0 200 L 0 130 L 90 80 L 160 110 L 220 70 L 310 100 L 400 60 L 500 95 L 590 70 L 690 110 L 790 75 L 880 105 L 950 85 L 1000 110 L 1000 200 Z"
          fill="url(#mountains-fill)" opacity="0.85" />
      </svg>
    </>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 90,
  background: COLOR.bg.deep,
  overflow: 'hidden',
};

const scroller: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  height: '100%',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  paddingTop: 'max(8px, env(safe-area-inset-top, 0))',
  paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0))',
  paddingLeft: 10,
  paddingRight: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
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
  width: '100%', height: 80, opacity: 0.5, pointerEvents: 'none',
};

// Top pills
const pillsRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 6,
  flexShrink: 0,
};
const pillShell = (accent: string): React.CSSProperties => ({
  background: 'linear-gradient(135deg, rgba(11,17,32,0.9), rgba(15,23,42,0.85))',
  border: `1px solid ${accent}44`,
  borderRadius: 12,
  padding: '6px 8px',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
  boxShadow: `0 4px 10px rgba(0,0,0,0.4)`,
});
const pillIconWrap = (accent: string): React.CSSProperties => ({
  width: 22, height: 22,
  borderRadius: 999,
  background: `${accent}22`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
});
const pillLabel: React.CSSProperties = {
  fontSize: 7.5,
  fontWeight: 800,
  letterSpacing: '0.14em',
  color: '#94A3B8',
  textTransform: 'uppercase',
};
const pillValue: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  marginTop: 1,
  letterSpacing: '0.01em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFeatureSettings: '"tnum" 1',
};

// Brand
const brandWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginTop: 4,
};
const wordmarkRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
};
const wordmarkChar: React.CSSProperties = {
  fontSize: 30,
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
  width: 50,
  height: 1,
  background: 'linear-gradient(90deg, transparent, rgba(244,199,91,0.7), transparent)',
};
const subMarkText: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.5em',
  color: COLOR.gold.base,
  marginTop: 0,
};

// Constellation
const constellationWrap: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  flexShrink: 0,
  aspectRatio: '1000 / 540',
  marginTop: 4,
};

// Diorama
const dioramaWrap: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  flexShrink: 0,
  aspectRatio: '400 / 270',
  marginTop: -8,
  borderRadius: 8,
  overflow: 'hidden',
};

// Action cards
const actionRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 6,
  marginTop: 2,
  flexShrink: 0,
};
const actionCard = (accent: string): React.CSSProperties => ({
  background: 'linear-gradient(165deg, rgba(11,17,32,0.95), rgba(7,11,24,0.95))',
  border: `1px solid ${accent}44`,
  borderRadius: 14,
  padding: '10px 8px 9px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  color: '#F8FAFC',
  textAlign: 'center',
  boxShadow: `0 6px 14px rgba(0,0,0,0.4), 0 0 16px ${accent}22`,
  minHeight: 92,
});
const actionCardIconBox: React.CSSProperties = {
  height: 38,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const actionCardTitle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.1em',
  marginTop: 2,
};
const actionCardSub: React.CSSProperties = {
  fontSize: 9,
  color: '#94A3B8',
  letterSpacing: '0.02em',
};

// Objective
const objectiveCard = (tail: string): React.CSSProperties => ({
  background: 'linear-gradient(135deg, rgba(11,17,32,0.95), rgba(15,23,42,0.9))',
  border: `1px solid ${tail}55`,
  borderLeft: `4px solid ${tail}`,
  borderRadius: 12,
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  boxShadow: `0 6px 14px rgba(0,0,0,0.4)`,
});
const objectiveIcon = (tail: string): React.CSSProperties => ({
  width: 30, height: 30,
  borderRadius: 6,
  background: `${tail}22`,
  border: `1px solid ${tail}55`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
});
const objectiveKicker: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.18em',
};
const objectiveTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#F8FAFC',
  marginTop: 1,
};
const objectiveProgress: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#94A3B8',
  marginTop: 2,
  fontFeatureSettings: '"tnum" 1',
};
const objectiveReward: React.CSSProperties = {
  textAlign: 'right',
  flexShrink: 0,
};
const objectiveRewardKicker: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.18em',
  color: '#94A3B8',
};
const objectiveRewardValueRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  justifyContent: 'flex-end',
};
const objectiveRewardValue: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: COLOR.gold.base,
  fontFeatureSettings: '"tnum" 1',
};

// Live ticker
const tickerCard: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(11,17,32,0.92), rgba(15,23,42,0.9))',
  border: '1px solid rgba(52,211,153,0.3)',
  borderRadius: 10,
  padding: '6px 10px 8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
};
const tickerHead: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};
const tickerLive = (_tail: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.16em',
  color: '#34D399',
});
const tickerLiveDot: React.CSSProperties = {
  width: 6, height: 6,
  borderRadius: 999,
  background: '#34D399',
  boxShadow: '0 0 6px #34D399',
  animation: 'breathe 1.4s ease-in-out infinite',
};
const tickerTime: React.CSSProperties = {
  fontSize: 8,
  letterSpacing: '0.16em',
  color: '#64748B',
  fontWeight: 700,
};
const tickerBody: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 4,
};
const tickerLine1: React.CSSProperties = {
  fontSize: 11,
  color: '#F8FAFC',
  letterSpacing: '0.01em',
};
const tickerLine2: React.CSSProperties = {
  fontSize: 9,
  color: '#94A3B8',
  marginTop: 1,
};
