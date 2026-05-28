/**
 * ConfettiBurst (Design pass D6).
 *
 * Programmatic particle burst — 36 paper-confetti rectangles spawned
 * at the origin with randomised launch vectors. Each rectangle falls
 * under gravity, spins, and fades over `lifeMs`. Single render —
 * remount the component to trigger another burst.
 *
 * Reduced-motion-aware: skips render entirely.
 *
 * Particle positions are computed once on mount via a deterministic
 * xorshift PRNG seeded from `seed`, so the burst is reproducible
 * across sessions (helpful for recording / screenshots).
 */
import { useMemo } from 'react';

export interface ConfettiBurstProps {
  /** Origin in viewport coordinates (px from top-left). Defaults to centre. */
  origin?: { x: number; y: number };
  /** Burst spread radius in px. Default 220. */
  spread?: number;
  /** Per-particle life. Default 1500 ms. */
  lifeMs?: number;
  /** Deterministic seed. Default 1. */
  seed?: number;
  /** Colors picked round-robin per particle. */
  palette?: readonly string[];
  /** Total particles. Default 36. */
  count?: number;
}

const DEFAULT_PALETTE: readonly string[] = [
  '#5AC8FA', '#F4C75B', '#8B5CF6', '#34D399', '#F87171', '#FCE9A5',
];

export function ConfettiBurst({
  origin,
  spread = 220,
  lifeMs = 1500,
  seed = 1,
  palette = DEFAULT_PALETTE,
  count = 36,
}: ConfettiBurstProps) {
  const reduced = useMemo(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return false; }
  }, []);
  const center = useMemo(() => ({
    x: origin?.x ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0),
    y: origin?.y ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0),
  }), [origin?.x, origin?.y]);

  const particles = useMemo(() => {
    let s = seed | 0;
    const rand = (): number => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
    return Array.from({ length: count }).map((_, i) => {
      const angle = rand() * Math.PI * 2;
      const distance = spread * (0.35 + rand() * 0.65);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - spread * 0.25; // bias up
      const rot = rand() * 720 - 360;
      const w = 6 + rand() * 4;
      const h = 9 + rand() * 5;
      const color = palette[i % palette.length]!;
      return { dx, dy, rot, w, h, color };
    });
  }, [seed, spread, count, palette]);

  if (reduced) return null;

  return (
    <div style={shell} aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            ...particle,
            left: center.x,
            top: center.y,
            width: p.w,
            height: p.h,
            background: p.color,
            // CSS variables consumed by the keyframes below.
            ['--dx' as never]: `${p.dx}px`,
            ['--dy' as never]: `${p.dy}px`,
            ['--rot' as never]: `${p.rot}deg`,
            animationDuration: `${lifeMs}ms`,
          }}
        />
      ))}
      {/* Inject the keyframes (idempotent — re-defining same name is fine). */}
      <style>{`
        @keyframes confetti-fly {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) scale(1);
            opacity: 1;
          }
          60% { opacity: 1; }
          100% {
            transform:
              translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 360px))
              rotate(var(--rot)) scale(0.85);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 70,
  overflow: 'hidden',
};

const particle: React.CSSProperties = {
  position: 'absolute',
  borderRadius: 1.5,
  willChange: 'transform, opacity',
  animationName: 'confetti-fly',
  animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
  animationIterationCount: 1,
  animationFillMode: 'forwards',
  transform: 'translate(-50%, -50%)',
};
