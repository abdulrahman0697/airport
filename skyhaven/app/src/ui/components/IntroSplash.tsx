import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { selectTailColor, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { haptics } from '../juice/haptics';

/**
 * Introduction splash (BRD §2.6 / §5.1 — branded motion beat).
 *
 * Premium-feeling pre-game screen with layered motion:
 *  - deep multi-stop gradient background with drifting aurora
 *  - parallax star/light particles (twinkling on different cycles)
 *  - large title with a continuous gold→cyan→violet shimmer sweep
 *  - foreground scene: 4 aircraft cruising on staggered trails,
 *    runway with strobing approach lights, terminal silhouettes
 *    with blinking gates, moon with halo
 *  - tagline carousel cycling 3 lines
 *  - bottom-corner "v0.1.0 · Phase 10" build tag
 *
 * Dismissal flips `introDismissed` in the UI store; Tutorial waits
 * for it.
 */
const TAGLINES = [
  'Build the airline that owns the sky.',
  'Routes earn around the clock.',
  'Choose your hub. Plot the world. Lift off.',
];

export function IntroSplash() {
  const introDismissed = useUiStore((s) => s.introDismissed);
  const dismissIntro = useUiStore((s) => s.dismissIntro);
  const tailColor = useGameStore(selectTailColor);
  const [exiting, setExiting] = useState(false);
  const [taglineIdx, setTaglineIdx] = useState(0);

  useEffect(() => {
    if (introDismissed) setExiting(true);
  }, [introDismissed]);

  useEffect(() => {
    const id = setInterval(() => setTaglineIdx((n) => (n + 1) % TAGLINES.length), 3200);
    return () => clearInterval(id);
  }, []);

  // Deterministic particle layer — different sizes, twinkle cycles.
  const particles = useMemo(() => {
    const out: { cx: number; cy: number; r: number; delay: number; dur: number; }[] = [];
    let s = 1234;
    const rand = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xFFFFFFFF; };
    for (let i = 0; i < 80; i++) {
      out.push({
        cx: rand() * 100,
        cy: rand() * 60,
        r: 0.4 + rand() * 1.4,
        delay: rand() * 3,
        dur: 2 + rand() * 3,
      });
    }
    return out;
  }, []);

  const start = (): void => {
    haptics.medium();
    setExiting(true);
    setTimeout(() => dismissIntro(), 280);
  };

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="intro-splash"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.4 }}
          style={shell as Record<string, unknown>}
        >
          {/* Animated sky backdrop — a slowly drifting aurora. */}
          <div style={skyAurora as React.CSSProperties} aria-hidden />

          {/* Twinkling particle field (CSS-driven). */}
          <svg
            viewBox="0 0 100 60"
            preserveAspectRatio="none"
            style={particleLayer as React.CSSProperties}
            aria-hidden
          >
            {particles.map((p, i) => (
              <circle
                key={i}
                cx={p.cx}
                cy={p.cy}
                r={p.r / 4}
                fill="#C4ECFF"
              >
                <animate
                  attributeName="opacity"
                  values="0.15;0.95;0.15"
                  dur={`${p.dur}s`}
                  begin={`-${p.delay}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
          </svg>

          {/* Glow flares behind the wordmark. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.0 }}
            style={glow(tailColor) as Record<string, unknown>}
            aria-hidden
          />

          {/* Premium decorative top-bar with the studio mark. */}
          <div style={studioBar as React.CSSProperties}>
            <span style={studioMark as React.CSSProperties} />
            <span style={studioName as React.CSSProperties}>SKYHAVEN STUDIOS</span>
          </div>

          {/* Build tag bottom-right. */}
          <div style={buildTag as React.CSSProperties}>v0.1.0 · Phase 10</div>

          <div style={inner}>
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.4 }}
              style={kicker as Record<string, unknown>}
            >
              ✦ A SkyHaven Studios Original ✦
            </motion.div>

            <motion.h1
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.18, type: 'spring', stiffness: 280, damping: 22 }}
              className="title-shimmer"
              style={{ ...title, textShadow: `0 0 50px ${tailColor}88, 0 4px 16px rgba(0,0,0,0.6)` } as Record<string, unknown>}
            >
              SKYHAVEN
              <br />
              <span style={{ ...titleSub, color: tailColor }}>TYCOON</span>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              style={tagline as Record<string, unknown>}
            >
              · WINGS OF THE WORLD ·
            </motion.div>

            {/* Decorative scene with multiple animated aircraft + runway. */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.6 }}
              style={sceneWrap as Record<string, unknown>}
            >
              <svg viewBox="0 0 320 220" width="100%" height="220" aria-hidden>
                <defs>
                  <linearGradient id="trail1" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={tailColor} stopOpacity="0" />
                    <stop offset="100%" stopColor={tailColor} stopOpacity="1" />
                  </linearGradient>
                  <linearGradient id="trail2" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#F4C75B" stopOpacity="0" />
                    <stop offset="100%" stopColor="#F4C75B" stopOpacity="0.95" />
                  </linearGradient>
                  <linearGradient id="trail3" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.95" />
                  </linearGradient>
                  <radialGradient id="moon" cx="0.3" cy="0.3" r="0.8">
                    <stop offset="0%" stopColor="#FCE9A5" />
                    <stop offset="100%" stopColor="#F4C75B" stopOpacity="0.7" />
                  </radialGradient>
                  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1A2C5E" />
                    <stop offset="55%" stopColor="#2F5193" />
                    <stop offset="100%" stopColor="#0B1120" />
                  </linearGradient>
                  <linearGradient id="runway" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1B254A" />
                    <stop offset="50%" stopColor="#2A3A7A" />
                    <stop offset="100%" stopColor="#1B254A" />
                  </linearGradient>
                </defs>

                {/* Sky band */}
                <rect x="0" y="0" width="320" height="160" fill="url(#sky)" />

                {/* Stars */}
                {[...Array(60)].map((_, i) => {
                  const cx = (i * 17 + 11) % 320;
                  const cy = (i * 23 + 4) % 130;
                  const r = (i % 4) * 0.4 + 0.4;
                  return <circle key={i} cx={cx} cy={cy} r={r} fill="#C4ECFF" opacity={0.6 - (i % 5) * 0.08} />;
                })}

                {/* Moon */}
                <circle cx="262" cy="44" r="22" fill="url(#moon)" />
                <circle cx="262" cy="44" r="32" fill="#FCE9A5" opacity="0.08" />

                {/* Aircraft 1 — cyan, high altitude, moves left → right */}
                <motion.g
                  animate={{ x: [-90, 380] }}
                  transition={{ duration: 9, ease: 'linear', repeat: Infinity }}
                  style={{ y: 38 } as Record<string, unknown>}
                >
                  <line x1="-90" y1="0" x2="0" y2="0" stroke="url(#trail1)" strokeWidth="2" strokeLinecap="round" />
                  <polygon points="-4,-3 28,-3 38,0 28,3 -4,3" fill={tailColor} />
                  <polygon points="6,-3 16,-13 19,-13 13,-3" fill={tailColor} />
                  <polygon points="6,3 16,13 19,13 13,3" fill={tailColor} />
                </motion.g>

                {/* Aircraft 2 — gold, mid altitude, moves right → left */}
                <motion.g
                  animate={{ x: [380, -90] }}
                  transition={{ duration: 11, ease: 'linear', repeat: Infinity, delay: 1.5 }}
                  style={{ y: 84 } as Record<string, unknown>}
                >
                  <line x1="0" y1="0" x2="90" y2="0" stroke="url(#trail2)" strokeWidth="2" strokeLinecap="round" />
                  <polygon points="4,-3 -28,-3 -38,0 -28,3 4,3" fill="#F4C75B" />
                  <polygon points="-6,-3 -16,-13 -19,-13 -13,-3" fill="#F4C75B" />
                  <polygon points="-6,3 -16,13 -19,13 -13,3" fill="#F4C75B" />
                </motion.g>

                {/* Aircraft 3 — violet, low altitude, slower */}
                <motion.g
                  animate={{ x: [-60, 380] }}
                  transition={{ duration: 14, ease: 'linear', repeat: Infinity, delay: 3 }}
                  style={{ y: 122 } as Record<string, unknown>}
                >
                  <line x1="-60" y1="0" x2="0" y2="0" stroke="url(#trail3)" strokeWidth="2" strokeLinecap="round" />
                  <polygon points="-3,-2 20,-2 26,0 20,2 -3,2" fill="#8B5CF6" />
                </motion.g>

                {/* Horizon line */}
                <line x1="0" y1="160" x2="320" y2="160" stroke={tailColor} strokeOpacity="0.45" strokeWidth="0.8" />

                {/* Ground / runway band */}
                <rect x="0" y="160" width="320" height="60" fill="#0B1120" />

                {/* Runway */}
                <rect x="40" y="172" width="240" height="14" rx="2" fill="url(#runway)" />
                {[...Array(7)].map((_, i) => (
                  <rect key={i} x={56 + i * 36} y="178" width="20" height="2" fill="#5AC8FA" opacity="0.85" />
                ))}

                {/* Terminal buildings */}
                <polygon points="22,196 38,180 88,180 120,196" fill="#1A2244" />
                <polygon points="200,196 232,178 282,178 304,196" fill="#1A2244" />
                <rect x="148" y="166" width="8" height="30" fill="#1A2244" />
                {/* Terminal lights */}
                <motion.circle
                  cx="152" cy="165" r="2.5" fill={tailColor}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
                <rect x="50" y="188" width="2" height="2" fill={tailColor} opacity="0.7" />
                <rect x="64" y="186" width="2" height="2" fill="#F4C75B" opacity="0.85" />
                <rect x="76" y="188" width="2" height="2" fill={tailColor} opacity="0.7" />
                <rect x="92" y="186" width="2" height="2" fill="#F4C75B" opacity="0.85" />
                <rect x="218" y="186" width="2" height="2" fill={tailColor} opacity="0.7" />
                <rect x="240" y="184" width="2" height="2" fill="#F4C75B" opacity="0.85" />
                <rect x="258" y="186" width="2" height="2" fill={tailColor} opacity="0.7" />
                <rect x="274" y="184" width="2" height="2" fill="#F4C75B" opacity="0.85" />

                {/* Runway approach lights pulse */}
                <motion.circle
                  cx="36" cy="179" r="2.4" fill="#F4C75B"
                  animate={{ opacity: [0.3, 1, 0.3], r: [2, 3, 2] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.circle
                  cx="284" cy="179" r="2.4" fill="#F4C75B"
                  animate={{ opacity: [0.3, 1, 0.3], r: [2, 3, 2] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
                />
              </svg>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95, duration: 0.4 }}
              onClick={start}
              style={{ ...btn, background: tailColor, boxShadow: `0 12px 30px ${tailColor}45, 0 0 0 1px rgba(255,255,255,0.1) inset` } as Record<string, unknown>}
            >
              Start
            </motion.button>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.75 }}
              transition={{ delay: 1.3, duration: 0.6 }}
              style={footer as Record<string, unknown>}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={taglineIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4 }}
                >
                  {TAGLINES[taglineIdx]}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'radial-gradient(ellipse at center top, #2A4087 0%, #182143 45%, #0B1120 100%)',
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
  zIndex: 90,
};
const skyAurora: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: `
    radial-gradient(ellipse at 25% 25%, rgba(90,200,250,0.20), transparent 55%),
    radial-gradient(ellipse at 75% 60%, rgba(139,92,246,0.18), transparent 50%),
    radial-gradient(ellipse at 50% 90%, rgba(244,199,91,0.10), transparent 50%)
  `,
  animation: 'aurora-drift 14s ease-in-out infinite alternate',
  pointerEvents: 'none',
};
const glow = (color: string): React.CSSProperties => ({
  position: 'absolute',
  top: '18%',
  left: '50%',
  width: 480,
  height: 280,
  transform: 'translate(-50%, -50%)',
  background: `radial-gradient(ellipse at center, ${color}33, transparent 65%)`,
  filter: 'blur(40px)',
  pointerEvents: 'none',
});
const inner: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: 440,
  padding: '0 24px',
  textAlign: 'center',
};
const kicker: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.32em',
  textTransform: 'uppercase',
  color: '#C4ECFF',
  opacity: 0.85,
};
const title: React.CSSProperties = {
  margin: '14px 0 8px',
  fontSize: 64,
  fontWeight: 900,
  letterSpacing: '0.04em',
  color: '#F8FAFC',
  lineHeight: 0.92,
};
const titleSub: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 800,
  letterSpacing: '0.36em',
};
const particleLayer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};
const studioBar: React.CSSProperties = {
  position: 'absolute',
  top: 18,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 8,
  pointerEvents: 'none',
};
const studioMark: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 5,
  background: 'linear-gradient(135deg, #5AC8FA, #8B5CF6)',
  boxShadow: '0 0 12px rgba(90,200,250,0.6)',
};
const studioName: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.42em',
  color: '#C4ECFF',
  fontWeight: 700,
};
const buildTag: React.CSSProperties = {
  position: 'absolute',
  bottom: 14,
  right: 18,
  fontSize: 9,
  letterSpacing: '0.16em',
  color: '#94A3B8',
  opacity: 0.65,
  pointerEvents: 'none',
};
const tagline: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.26em',
  textTransform: 'uppercase',
  color: '#C4ECFF',
  marginBottom: 18,
  opacity: 0.8,
};
const sceneWrap: React.CSSProperties = {
  margin: '8px 0 22px',
  borderRadius: 16,
  overflow: 'hidden',
  border: '1px solid rgba(196,236,255,0.15)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 0 80px rgba(196,236,255,0.05)',
};
const btn: React.CSSProperties = {
  width: '100%',
  maxWidth: 260,
  padding: '14px 18px',
  borderRadius: 14,
  border: 0,
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#0B1120',
  cursor: 'pointer',
  minHeight: 52,
};
const footer: React.CSSProperties = {
  marginTop: 14,
  fontSize: 11,
  color: '#94A3B8',
  letterSpacing: '0.08em',
};
