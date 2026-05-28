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
  'Build the airline that owns the sky.',
  'Hubs, regions, vintage classics — all yours to chart.',
  'Tap. Earn. Expand. Repeat — forever.',
];

const WORDMARK = 'SKYHAVEN';

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
    if (exiting) return;
    const id = window.setInterval(() => {
      setTaglineIdx((i) => (i + 1) % TAGLINES.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [exiting]);

  const onBegin = (): void => {
    haptics.success();
    sfx.confirm();
    dismissIntro();
  };

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
          </div>

          {/* Hero aircraft + contrail crossing the lower-mid horizon */}
          <motion.div
            style={heroAircraftWrap as Record<string, unknown>}
            initial={{ x: '-40%' }}
            animate={{ x: '40%' }}
            transition={{ duration: 14, ease: 'linear', repeat: Infinity }}
          >
            <ContrailTrack tailColor={tailColor} />
            <AircraftIllustration
              defId="t4.a321xlr"
              tailColor={tailColor}
              width={140}
              style={{ filter: `drop-shadow(0 4px 18px ${tailColor}88)` }}
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

            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.95, type: 'spring', stiffness: 360, damping: 22 }}
              style={ctaWrap as Record<string, unknown>}
            >
              <div style={ctaGlow(tailColor)} aria-hidden />
              <Button
                variant="gold"
                size="lg"
                onClick={onBegin}
                hapticOnPress="heavy"
                style={ctaButton}
              >
                ▶  BEGIN BOARDING
              </Button>
              <div style={ctaHint}>Tap to launch your airline</div>
            </motion.div>
          </div>

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

const heroAircraftWrap: React.CSSProperties = {
  position: 'absolute',
  left: '30%', top: '64%',
  width: 140,
  pointerEvents: 'none',
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
