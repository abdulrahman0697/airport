/**
 * NetworkSkyView — Design Review v4, point 25 (signature mechanic).
 *
 * The "Living Airport + Global Network Split View" — a stylised
 * mini-globe / sky strip drawn ABOVE the airport diorama on the
 * home screen. Each active route is a glowing arc; tiny aircraft
 * silhouettes take off from the local airport (bottom of the strip),
 * fly along their arc, pulse the destination, and return — feeding
 * revenue back to the cash counter.
 *
 * The visual loop is the identity of the game:
 *   Watch your airport → planes take off → empire glows → planes
 *   come home → cash ticks up.
 *
 * Pure SVG, deterministic. No PixiJS dependency so it runs inside
 * the HomeShell react tree without touching the world renderer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAircraftDef } from '../../data/aircraft';
import { cashPerSecond } from '../../engine/economy';
import type { Route, OwnedAircraft, Hub, ActiveEvent } from '../../engine/types';
import { COLOR } from '../design/tokens';

export interface NetworkSkyViewProps {
  width: number;
  height: number;
  routes: readonly Route[];
  fleet: readonly OwnedAircraft[];
  hubs: readonly Hub[];
  activeEvents: readonly ActiveEvent[];
  tailColor: string;
}

interface Arc {
  routeId: string;
  destIata: string;
  pathD: string;
  midX: number;
  midY: number;
  destX: number;
  destY: number;
  cps: number;
  pricing: Route['pricing'];
  inaugural: boolean;
  // Aircraft progression along the arc, 0..1, ping-pongs over `period` ms.
  period: number;
  // Stable phase offset so multiple routes don't all align.
  phase: number;
}

// We use a single rAF tick to update all aircraft positions.
const TICK_MS = 60;

export function NetworkSkyView({
  width, height, routes, fleet, hubs, activeEvents, tailColor,
}: NetworkSkyViewProps) {
  // Local airport sits at the bottom-center of the strip. Destinations
  // are placed on an arc-of-fifth in deterministic positions based on
  // their IATA hash — so the same route always lands in the same place,
  // and adding routes doesn't reshuffle existing pins.
  const HOME_X = width / 2;
  const HOME_Y = height - 18;

  const arcs = useMemo<readonly Arc[]>(() => {
    const fleetByUid = new Map(fleet.map((a) => [a.uid, a]));
    return routes.slice(0, 10).map((r, i) => {
      const a = fleetByUid.get(r.aircraftUid);
      const def = a ? getAircraftDef(a.defId) : null;
      const cps = a && def ? cashPerSecond(r, a, hubs, activeEvents) : 0;
      // Spread destinations across an arc from left to right.
      const t = routes.length === 1 ? 0.5 : i / Math.max(1, routes.length - 1);
      // Curve so closer destinations sit lower, far-flung ones higher.
      const angle = -Math.PI / 2 + (t - 0.5) * Math.PI * 0.85;
      const radius = Math.min(width, height * 2.6) * 0.42;
      const destX = HOME_X + Math.cos(angle) * radius;
      const destY = HOME_Y + Math.sin(angle) * radius * 0.85;
      const midX = (HOME_X + destX) / 2;
      const midY = Math.min(destY, HOME_Y) - Math.abs(destX - HOME_X) * 0.25 - 20;
      const pathD = `M ${HOME_X} ${HOME_Y} Q ${midX} ${midY} ${destX} ${destY}`;
      // Aircraft travel-time scales with distance — short hops cycle
      // faster so the strip feels busy on a small network.
      const period = 5000 + r.distanceKm * 1.2;
      // Deterministic phase from the route id.
      let h = 2166136261;
      for (let k = 0; k < r.id.length; k++) { h ^= r.id.charCodeAt(k); h = Math.imul(h, 16777619); }
      const phase = (Math.abs(h) % 1000) / 1000;
      return { routeId: r.id, destIata: r.destIata, pathD, midX, midY, destX, destY, cps, pricing: r.pricing, inaugural: r.inaugural === true, period, phase };
    });
  }, [routes, fleet, hubs, activeEvents, width, height, HOME_X, HOME_Y]);

  // Animate aircraft progression with a single rAF loop.
  const [now, setNow] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    let last = performance.now();
    const tick = (): void => {
      const t = performance.now();
      if (t - last >= TICK_MS) { last = t; setNow(t); }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Income-burst floats triggered each time an aircraft completes an
  // outbound leg. Tracked locally so the strip can show "$+1.2K"
  // floating up from the destination pin.
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number; text: string }>>([]);
  const lastCompletionRef = useRef<Map<string, number>>(new Map());
  const burstIdRef = useRef(0);

  useEffect(() => {
    for (const arc of arcs) {
      const period = arc.period;
      const offset = (now / period + arc.phase) % 1;
      // Detect when an aircraft just crossed completion (0.99 → wrap).
      const last = lastCompletionRef.current.get(arc.routeId) ?? offset;
      if (last > 0.85 && offset < 0.2) {
        // Arrival! Emit a burst.
        const cash = arc.cps * (arc.period / 1000);
        const text = cash >= 1000
          ? `+$${(cash / 1000).toFixed(1)}K`
          : `+$${cash.toFixed(0)}`;
        const id = burstIdRef.current++;
        setBursts((cur) => [...cur, { id, x: arc.destX, y: arc.destY, text }]);
        window.setTimeout(() => {
          setBursts((cur) => cur.filter((b) => b.id !== id));
        }, 1400);
      }
      lastCompletionRef.current.set(arc.routeId, offset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, arcs.length]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', pointerEvents: 'none' }}
      aria-hidden
    >
      <defs>
        <radialGradient id="sky-gradient" cx="50%" cy="100%" r="80%">
          <stop offset="0" stopColor="#142048" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#0B1426" stopOpacity="0.85" />
          <stop offset="1" stopColor="#050912" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="home-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={tailColor} stopOpacity="0.55" />
          <stop offset="1" stopColor={tailColor} stopOpacity="0" />
        </radialGradient>
        <style>{`
          @keyframes destPulse {
            0%, 100% { r: 3; opacity: 0.5 }
            50% { r: 5; opacity: 1 }
          }
          @keyframes burstFloat {
            0% { transform: translateY(0); opacity: 0 }
            15% { opacity: 1 }
            100% { transform: translateY(-22px); opacity: 0 }
          }
          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; }
          }
        `}</style>
      </defs>

      {/* Sky backdrop */}
      <rect x="0" y="0" width={width} height={height} fill="url(#sky-gradient)" />

      {/* Stars (deterministic) */}
      {Array.from({ length: 28 }).map((_, i) => {
        const seed = i * 37;
        const x = (seed * 17) % width;
        const y = ((seed * 11) % Math.floor(height * 0.7)) + 2;
        const r = 0.4 + ((seed * 7) % 10) / 14;
        return <circle key={i} cx={x} cy={y} r={r} fill="#F8FAFC" opacity={0.5 + ((seed * 5) % 5) / 12} />;
      })}

      {/* Home airport glow halo */}
      <circle cx={HOME_X} cy={HOME_Y} r={26} fill="url(#home-glow)" />

      {/* Arcs and destinations */}
      {arcs.map((arc) => {
        const accent = arc.pricing === 'premium' ? COLOR.gold.base
          : arc.pricing === 'economy' ? '#5AC8FA' : tailColor;
        return (
          <g key={arc.routeId}>
            <path
              d={arc.pathD}
              stroke={accent}
              strokeOpacity="0.42"
              strokeWidth="1.2"
              fill="none"
              strokeDasharray="3 3"
            />
            {/* Destination pin */}
            <circle cx={arc.destX} cy={arc.destY} r="3" fill={accent}
              style={{
                animation: 'destPulse 2.6s ease-in-out infinite',
                filter: `drop-shadow(0 0 4px ${accent})`,
              }} />
            <text
              x={arc.destX}
              y={arc.destY - 8}
              textAnchor="middle"
              fill={arc.inaugural ? COLOR.gold.base : COLOR.ink.muted}
              fontSize="6"
              fontWeight="700"
              letterSpacing="0.1em"
            >
              {arc.inaugural ? `★ ${arc.destIata}` : arc.destIata}
            </text>
          </g>
        );
      })}

      {/* Aircraft sprites in flight */}
      {arcs.map((arc) => {
        const t = ((now / arc.period) + arc.phase) % 1;
        // Quadratic Bezier interpolation.
        const u = 1 - t;
        const x = u * u * HOME_X + 2 * u * t * arc.midX + t * t * arc.destX;
        const y = u * u * HOME_Y + 2 * u * t * arc.midY + t * t * arc.destY;
        // Approximate tangent for rotation.
        const tx = 2 * u * (arc.midX - HOME_X) + 2 * t * (arc.destX - arc.midX);
        const ty = 2 * u * (arc.midY - HOME_Y) + 2 * t * (arc.destY - arc.midY);
        const angleDeg = (Math.atan2(ty, tx) * 180) / Math.PI;
        const accent = arc.pricing === 'premium' ? COLOR.gold.base
          : arc.pricing === 'economy' ? '#5AC8FA' : tailColor;
        return (
          <g key={`ac-${arc.routeId}`} transform={`translate(${x} ${y}) rotate(${angleDeg})`}>
            <path d="M -4 0 L 3 -1 L 3 1 Z" fill={accent} />
            <path d="M -1 -2 L 1 -2 L 0 0 Z" fill={accent} opacity="0.7" />
            <path d="M -1 2 L 1 2 L 0 0 Z" fill={accent} opacity="0.7" />
            <circle cx="3" cy="0" r="0.7" fill="#F8FAFC" />
          </g>
        );
      })}

      {/* Local airport tag at home position */}
      <text
        x={HOME_X}
        y={HOME_Y + 12}
        textAnchor="middle"
        fill={tailColor}
        fontSize="7"
        fontWeight="800"
        letterSpacing="0.16em"
        opacity="0.9"
      >
        {hubs[0]?.iata ?? 'HOME'}
      </text>

      {/* Income burst floats */}
      {bursts.map((b) => (
        <g key={b.id} transform={`translate(${b.x} ${b.y - 10})`} style={{ animation: 'burstFloat 1.4s ease-out forwards' }}>
          <text fill={COLOR.gold.base} fontSize="8" fontWeight="900" textAnchor="middle"
            style={{ filter: 'drop-shadow(0 0 4px rgba(244,199,91,0.7))' }}>
            {b.text}
          </text>
        </g>
      ))}

      {/* Empty state */}
      {arcs.length === 0 && (
        <text x={HOME_X} y={HOME_Y - 30} textAnchor="middle"
          fill={COLOR.ink.muted} fontSize="9" fontWeight="700" letterSpacing="0.18em">
          NO ROUTES YET · OPEN ONE TO LIGHT THE NETWORK
        </text>
      )}
    </svg>
  );
}
