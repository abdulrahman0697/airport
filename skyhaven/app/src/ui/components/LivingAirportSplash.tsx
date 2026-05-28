/**
 * LivingAirportSplash — photographic airport sunset background with a
 * live motion layer overlaid on top.
 *
 * Stack (back → front):
 *   1. /start-bg.png — the man-looking-out-over-a-runway photo,
 *      cover-fit and centered on every aspect ratio.
 *   2. MotionLayer — twinkling stars, drifting clouds, four small
 *      aircraft crossing the sky at different speeds and heights,
 *      a periodic hero takeoff plane rising from the bottom-right of
 *      the photo with a contrail + wingtip strobes, a runway-light
 *      sequence pulsing toward the vanishing point on the runway,
 *      gold streaks travelling up the runway perspective line, a
 *      slow tail-colour radar sweep over the terminal area on the
 *      left.
 *   3. Top + bottom darkening gradients so the wordmark and CTA read
 *      cleanly without hiding the photograph.
 *   4. SKYHAVEN TYCOON wordmark at the top with the gold airplane
 *      glyph between two gradient lines + a short slogan beneath.
 *   5. A single "Begin Boarding" CTA on a glass plate centered at the
 *      bottom, with a breathing tail-colour glow.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { selectTailColor, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../design/Button';
import { COLOR, MOTION, RADIUS } from '../design/tokens';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

type BoardStage = 'idle' | 'boarding' | 'ready' | 'departing';

export function LivingAirportSplash() {
  const introDismissed = useUiStore((s) => s.introDismissed);
  const dismissIntro = useUiStore((s) => s.dismissIntro);
  const tailColor = useGameStore(selectTailColor);
  const [stage, setStage] = useState<BoardStage>('idle');

  useEffect(() => {
    if (stage !== 'boarding') return;
    const id = window.setTimeout(() => setStage('ready'), 1700);
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
      window.setTimeout(() => dismissIntro(), 900);
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
          {/* Background photo */}
          <div style={bgImage} aria-hidden />

          {/* Live motion layer painted on top of the photo */}
          <MotionLayer tailColor={tailColor} />

          {/* Legibility gradients */}
          <div style={topShade} aria-hidden />
          <div style={bottomShade} aria-hidden />
          <div style={vignette(tailColor)} aria-hidden />

          {/* TOP: logo + slogan */}
          <div style={topArea}>
            <Wordmark text="SKYHAVEN" tailColor={tailColor} />
            <div style={brandSepRow}>
              <span style={brandSepLine} />
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ margin: '0 12px' }}>
                <path d="M 21 14 L 13 14 L 11 22 L 8 22 L 9 14 L 5 14 L 3 16 L 1 16 L 3 12 L 1 8 L 3 8 L 5 10 L 9 10 L 8 2 L 11 2 L 13 10 L 21 10 Z"
                  fill={COLOR.gold.base} />
              </svg>
              <span style={brandSepLine} />
            </div>
            <div style={subMarkText}>TYCOON</div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.6 }}
              style={slogan as Record<string, unknown>}
            >
              Start with one gate. Build a global aviation empire.
            </motion.div>
          </div>

          {/* BOTTOM: CTA */}
          <div style={ctaArea}>
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 320, damping: 26 }}
              style={ctaPlate(tailColor) as Record<string, unknown>}
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
                {stage === 'idle' && 'Tap to enter the empire'}
                {stage === 'boarding' && 'Doors closing · 0:02'}
                {stage === 'ready' && 'Push back when ready'}
                {stage === 'departing' && 'Have a safe flight ✈'}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Motion layer overlay ────────────────────────────────────────── */

function MotionLayer({ tailColor }: { tailColor: string }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = (): void => { setNow(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Deterministic stars across the upper sky.
  const stars = useMemo(() => {
    const out: Array<{ x: number; y: number; r: number; o: number; dur: number; delay: number }> = [];
    let seed = 0xCAFE;
    const rnd = (): number => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 100000) / 100000; };
    for (let i = 0; i < 90; i++) {
      out.push({
        x: rnd() * 100,
        y: rnd() * 50,
        r: 0.18 + rnd() * 0.35,
        o: 0.35 + rnd() * 0.55,
        dur: 2.2 + rnd() * 3.6,
        delay: rnd() * 4,
      });
    }
    return out;
  }, []);

  // Drifting aircraft across the upper sky. Eight in total — two on
  // each of four lanes — staggered with different periods + phases so
  // the sky never looks empty.
  const drifters = useMemo(() => [
    { y:  7, scale: 0.7, period: 32000, phase: 0.00, dir:  1 },
    { y:  7, scale: 0.5, period: 38000, phase: 0.55, dir: -1 },
    { y: 14, scale: 0.5, period: 41000, phase: 0.20, dir:  1 },
    { y: 14, scale: 0.6, period: 35000, phase: 0.75, dir: -1 },
    { y: 22, scale: 0.6, period: 36000, phase: 0.40, dir: -1 },
    { y: 22, scale: 0.4, period: 44000, phase: 0.10, dir:  1 },
    { y: 30, scale: 0.4, period: 48000, phase: 0.10, dir:  1 },
    { y: 30, scale: 0.55, period: 40000, phase: 0.65, dir: -1 },
  ], []);

  // Runway approach lights — perspective line from near end (52, 78)
  // toward vanishing point (58, 40). Each light strobes on its own
  // phase so the sequence reads as a wave racing to the horizon.
  const lights = useMemo(() => {
    const out: Array<{ x: number; y: number; r: number; phase: number }> = [];
    const N = 8;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const x = 52 + t * 6;
      const y = 78 - t * 38;
      const r = 0.9 - t * 0.55;
      out.push({ x, y, r, phase: t * 0.7 });
    }
    return out;
  }, []);

  return (
    <>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={svgLayer} aria-hidden>
        <defs>
          {/* Two-stage filter that keys out the airplane JPG's white
              background AND boosts the plane's colours so they read
              brightly against the dusk sky.

              Stage 1: alpha-from-luminance, but the alpha row now
              also multiplies by the SOURCE alpha (4th column = 3).
              That way pixels outside the image bounding box (which
              are transparent black) stay transparent, instead of
              being computed as opaque black — which was causing the
              dark square halo around each plane.

              Stage 2: a linear RGB transfer that lifts mid-tones
              ~20% with a small +5% intercept, so the originally
              washed-out plane body brightens and the red/blue
              accents pop. Alpha is untouched. */}
          <filter id="splash-plane-key">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -0.897 -1.761 -0.342 3 0"
              result="keyed"
            />
            <feComponentTransfer in="keyed">
              <feFuncR type="linear" slope="1.25" intercept="0.08" />
              <feFuncG type="linear" slope="1.25" intercept="0.08" />
              <feFuncB type="linear" slope="1.25" intercept="0.08" />
            </feComponentTransfer>
          </filter>
        </defs>

        {/* Stars */}
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F8FAFC" opacity={s.o}>
            <animate attributeName="opacity"
              values={`${s.o};${s.o + 0.35};${s.o}`}
              dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* Subtle cloud wisps drifting slowly across the upper sky */}
        {[
          { y: 6,  period: 90000, phase: 0.0,  o: 0.10 },
          { y: 14, period: 110000, phase: 0.4, o: 0.08 },
          { y: 22, period: 130000, phase: 0.7, o: 0.06 },
        ].map((c, i) => {
          const t = ((now / c.period) + c.phase) % 1;
          const x = -20 + t * 140;
          return (
            <ellipse key={`cloud-${i}`} cx={x} cy={c.y} rx="18" ry="2.4"
              fill="#F8FAFC" opacity={c.o} />
          );
        })}

        {/* Drifting aircraft — colour silhouettes painted from the
            plane.jpg asset. The splash-plane-key filter strips the
            white background (preserving the source alpha so there's
            no dark halo) and brightens the plane's mid-tones so its
            blues and salmon-red accents read against the dusk sky.
            Right-going planes use the natural orientation (the image
            already points up-right); left-going planes flip
            horizontally via scaleX(-1). */}
        {drifters.map((d, i) => {
          const t = ((now / d.period) + d.phase) % 1;
          const x = d.dir > 0 ? -8 + t * 116 : 108 - t * 116;
          const sz = 5 * d.scale;
          const sx = d.dir > 0 ? 1 : -1;
          return (
            <g key={`drift-${i}`} transform={`translate(${x} ${d.y}) scale(${sx} 1)`}>
              <image
                href="/plane.jpg"
                x={-sz / 2}
                y={-sz / 2}
                width={sz}
                height={sz}
                preserveAspectRatio="xMidYMid meet"
                filter="url(#splash-plane-key)"
                opacity="0.95"
              />
            </g>
          );
        })}

        {/* Hero takeoff aircraft removed per design feedback — only
            the small drifting silhouettes in the upper sky remain. */}

        {/* Runway approach-light sequence racing to vanishing point */}
        {lights.map((p, i) => (
          <circle key={`rl-${i}`} cx={p.x} cy={p.y} r={p.r * 0.6}
            fill={COLOR.gold.base} opacity="0.85"
            style={{
              filter: `drop-shadow(0 0 ${p.r * 2}px ${COLOR.gold.base})`,
            }}>
            <animate attributeName="opacity"
              values="0.25;1;0.25"
              dur="2.4s" begin={`${p.phase}s`} repeatCount="indefinite" />
            <animate attributeName="r"
              values={`${p.r * 0.5};${p.r * 0.95};${p.r * 0.5}`}
              dur="2.4s" begin={`${p.phase}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* Distant city-light blinks below the horizon */}
        {[
          { x: 18, y: 42, dur: 3.2 },
          { x: 84, y: 44, dur: 2.6 },
          { x: 24, y: 46, dur: 3.8 },
          { x: 72, y: 41, dur: 3.0 },
          { x: 30, y: 43, dur: 4.2 },
        ].map((c, i) => (
          <circle key={`city-${i}`} cx={c.x} cy={c.y} r="0.35"
            fill={tailColor} opacity="0.7"
            style={{ filter: `drop-shadow(0 0 1px ${tailColor})` }}>
            <animate attributeName="opacity" values="0.3;1;0.3" dur={`${c.dur}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>

      {/* Radar sweep — slow conic-gradient wedge over the terminal /
          tower area on the left of the photo. */}
      <motion.div
        style={radarSweep(tailColor) as Record<string, unknown>}
        animate={{ rotate: 360 }}
        transition={{ duration: 7, ease: 'linear', repeat: Infinity }}
        aria-hidden
      />

      {/* Gold streaks travelling up the runway perspective line */}
      <RunwayStreaks />

      {/* Warm rim light catching the right edge of the CEO silhouette
          in the photo. Subtle, screen-blended, additive only. */}
      <CeoRimLight />
    </>
  );
}

function RunwayStreaks() {
  return (
    <div style={streakWrap} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          ...streakDot,
          animation: `runwayStreak 4.2s ease-in ${i * 1.4}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes runwayStreak {
          0%   { transform: translate(-50%, 0)                  scale(1.0); opacity: 0; }
          15%  { opacity: 0.7; }
          70%  { transform: translate(calc(-50% + 4px), -32vh)  scale(0.35); opacity: 0.7; }
          100% { transform: translate(calc(-50% + 8px), -40vh)  scale(0.18); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/**
 * Subtle rim light around the CEO silhouette on the lower-left of the
 * photo. We don't relight him directly — we just paint warm radial
 * gradients on the right edge of his head and right edge of his
 * shoulder/back, with screen blend mode so the bright spots add into
 * the photo. The light reads as coming from the runway / terminal on
 * the right and just catches the outline.
 */
function CeoRimLight() {
  return (
    <div style={rimLightLayer} aria-hidden>
      {/* Right edge of the head — warm-gold catchlight from the
          sunset, very small + soft */}
      <div style={{
        ...rimSpot,
        left: '32%',
        top: '54%',
        width: 56,
        height: 70,
        background: 'radial-gradient(ellipse at 22% 50%, rgba(255,196,120,0.55) 0%, rgba(255,170,90,0.18) 28%, transparent 55%)',
        filter: 'blur(4px)',
      }} />
      {/* Right shoulder / upper back — broader, slightly cooler */}
      <div style={{
        ...rimSpot,
        left: '34%',
        top: '64%',
        width: 86,
        height: 64,
        background: 'radial-gradient(ellipse at 18% 30%, rgba(255,180,110,0.45) 0%, rgba(255,160,80,0.16) 32%, transparent 60%)',
        filter: 'blur(6px)',
      }} />
      {/* Top of the head + hair — colder light bleeding from the sky */}
      <div style={{
        ...rimSpot,
        left: '27%',
        top: '49%',
        width: 48,
        height: 32,
        background: 'radial-gradient(ellipse at 50% 80%, rgba(220,200,170,0.40) 0%, transparent 60%)',
        filter: 'blur(5px)',
      }} />
      {/* Back of the head + neck — fainter shaping light */}
      <div style={{
        ...rimSpot,
        left: '24%',
        top: '57%',
        width: 36,
        height: 50,
        background: 'radial-gradient(ellipse at 80% 50%, rgba(255,190,120,0.30) 0%, transparent 55%)',
        filter: 'blur(5px)',
      }} />
    </div>
  );
}

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
            textShadow: `0 2px 14px rgba(0,0,0,0.85), 0 0 22px ${tailColor}55, 0 0 60px ${tailColor}33`,
          } as Record<string, unknown>}
        >
          {ch}
        </motion.span>
      ))}
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 95,
  background: '#000',
  overflow: 'hidden',
};

const bgImage: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: `url('/start-bg.png')`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
};

const svgLayer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: 2,
};

// Radar sweep wedge anchored over the terminal area on the left.
const radarSweep = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  left: '12%',
  top: '32%',
  width: 240,
  height: 240,
  marginLeft: -120,
  marginTop: -120,
  borderRadius: '50%',
  background: `conic-gradient(from 0deg, ${tail}3a 0deg, ${tail}28 14deg, transparent 50deg, transparent 360deg)`,
  filter: 'blur(2px)',
  opacity: 0.45,
  pointerEvents: 'none',
  zIndex: 2,
  mixBlendMode: 'screen',
});

// Runway streaks — small subtle dots that travel up the runway
// centreline toward the vanishing point. Repositioned to sit on the
// actual centre of the runway in the photo (~60% horizontal, 80%
// vertical) and made smaller / dimmer so they read as distant
// runway markers, not loading dots.
const streakWrap: React.CSSProperties = {
  position: 'absolute',
  left: '60%',
  top: '80%',
  width: 1,
  height: 1,
  pointerEvents: 'none',
  zIndex: 2,
};
const streakDot: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: 0,
  width: 3,
  height: 1.6,
  borderRadius: 1,
  background: COLOR.gold.base,
  boxShadow: `0 0 6px ${COLOR.gold.base}, 0 0 14px ${COLOR.gold.base}99`,
  transform: 'translate(-50%, 0)',
};

// CEO rim light — soft warm glows positioned over the right edge of
// the suited figure in the photo. Screen blend mode so they additively
// brighten the underlying photo instead of replacing it. Result: the
// silhouette stays dark, but its outline reads more clearly as if
// catching warm light from the runway and terminal off-screen right.
const rimLightLayer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 2,
  mixBlendMode: 'screen',
};
const rimSpot: React.CSSProperties = {
  position: 'absolute',
};

const topShade: React.CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: '38%',
  background: 'linear-gradient(180deg, rgba(7,10,24,0.78) 0%, rgba(7,10,24,0.45) 60%, rgba(7,10,24,0) 100%)',
  pointerEvents: 'none',
  zIndex: 3,
};

const bottomShade: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0, bottom: 0,
  height: '32%',
  background: 'linear-gradient(0deg, rgba(7,10,24,0.92) 0%, rgba(7,10,24,0.62) 50%, rgba(7,10,24,0) 100%)',
  pointerEvents: 'none',
  zIndex: 3,
};

const vignette = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  inset: 0,
  background: `radial-gradient(ellipse at center, transparent 50%, ${tail}22 100%)`,
  pointerEvents: 'none',
  mixBlendMode: 'screen',
  zIndex: 3,
});

const topArea: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0,
  top: 'calc(env(safe-area-inset-top, 0px) + 24px)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '0 16px',
  zIndex: 5,
};
const wordmarkRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
};
const wordmarkChar: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 900,
  letterSpacing: '0.18em',
  color: '#F8FAFC',
  display: 'inline-block',
};
const brandSepRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 2,
};
const brandSepLine: React.CSSProperties = {
  width: 62,
  height: 1,
  background: 'linear-gradient(90deg, transparent, rgba(244,199,91,0.85), transparent)',
};
const subMarkText: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: '0.55em',
  color: COLOR.gold.base,
  marginTop: 2,
  textShadow: '0 2px 10px rgba(0,0,0,0.85)',
};
const slogan: React.CSSProperties = {
  marginTop: 14,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.04em',
  color: '#E2E8F0',
  textAlign: 'center',
  textShadow: '0 2px 8px rgba(0,0,0,0.8)',
  maxWidth: 320,
  lineHeight: 1.4,
};

const ctaArea: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0,
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
  display: 'flex',
  justifyContent: 'center',
  zIndex: 6,
  pointerEvents: 'none',
};
const ctaPlate = (tail: string): React.CSSProperties => ({
  position: 'relative',
  pointerEvents: 'auto',
  background: 'linear-gradient(180deg, rgba(11,17,32,0.55), rgba(7,10,24,0.85))',
  border: `1px solid ${tail}55`,
  borderRadius: 18,
  padding: '12px 18px 10px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  minWidth: 280,
  boxShadow: `0 18px 40px rgba(0,0,0,0.6), 0 0 30px ${tail}33`,
  backdropFilter: 'blur(10px)',
});
const ctaGlow = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  inset: -10,
  borderRadius: RADIUS.pill,
  background: `radial-gradient(ellipse at center, ${COLOR.gold.base}33 0%, ${tail}11 50%, transparent 75%)`,
  filter: 'blur(14px)',
  animation: 'breathe 2.4s ease-in-out infinite',
  pointerEvents: 'none',
  zIndex: -1,
});
const ctaButton: React.CSSProperties = {
  paddingLeft: 28,
  paddingRight: 28,
  fontSize: 13,
  height: 48,
  letterSpacing: '0.12em',
  zIndex: 1,
};
const ctaHint: React.CSSProperties = {
  fontSize: 9,
  color: '#CBD5E1',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  textShadow: '0 1px 6px rgba(0,0,0,0.7)',
};
