/**
 * LivingAirportSplash — opening screen using the photographic
 * airport sunset image as the background.
 *
 * Layout (top → bottom):
 *   - Background photo: a man looking out over a runway at sunset.
 *     We apply a vertical darkening gradient at both ends so the
 *     wordmark up top and the CTA at the bottom always read clearly.
 *   - SKYHAVEN TYCOON logo at the top with the gold plane glyph
 *     between two gradient lines — same brand mark as before.
 *   - A short slogan beneath the logo.
 *   - A single "Begin Boarding" CTA positioned bottom-right of the
 *     image, in the runway/sky area where contrast is highest and
 *     the suited figure on the left isn't covered.
 *   - A tail-coloured glow under the button to lift it off the
 *     warm sky tones.
 *
 * Animation kept minimal so the photograph is the hero:
 *   - Wordmark staggers in
 *   - Slogan fades in
 *   - Subtle floating aircraft icon over the runway (optional)
 *   - CTA breathes / glows
 *
 * No money, no objectives, no action cards, no ticker — same brief
 * as before but now overlaid on the player's chosen background.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
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
          {/* Background photo. Set via inline url() so Vite picks it
              from /public and serves it at the root path. */}
          <div style={bgImage} aria-hidden />
          {/* Top darkening gradient — keeps the logo + slogan readable
              against the sky. */}
          <div style={topShade} aria-hidden />
          {/* Bottom darkening gradient — gives the CTA contrast against
              the runway glow without hiding the figure. */}
          <div style={bottomShade} aria-hidden />
          {/* Subtle tail-colour vignette */}
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

          {/* BOTTOM: CTA in the area with strongest contrast (lower
              right of the runway). The button gets its own glass plate
              + tail glow so it always reads cleanly. */}
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

// The background image. Cover fit, centered, so portrait phones show
// the photograph without distortion. URL is `/start-bg.png` because
// the file lives at /home/user/airport/skyhaven/app/public/ and Vite
// serves the public directory at the root URL.
const bgImage: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: `url('/start-bg.png')`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
};

// Top darkening gradient — sky portion gets ~70% darker to lift the
// wordmark off the clouds.
const topShade: React.CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: '38%',
  background: 'linear-gradient(180deg, rgba(7,10,24,0.78) 0%, rgba(7,10,24,0.45) 60%, rgba(7,10,24,0) 100%)',
  pointerEvents: 'none',
};

// Bottom darkening gradient — runway portion gets ~70% darker so the
// CTA pops without obscuring the suited figure on the left.
const bottomShade: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0, bottom: 0,
  height: '32%',
  background: 'linear-gradient(0deg, rgba(7,10,24,0.92) 0%, rgba(7,10,24,0.62) 50%, rgba(7,10,24,0) 100%)',
  pointerEvents: 'none',
};

// Subtle tail-colour vignette around the edges.
const vignette = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  inset: 0,
  background: `radial-gradient(ellipse at center, transparent 50%, ${tail}22 100%)`,
  pointerEvents: 'none',
  mixBlendMode: 'screen',
});

// Top area: logo + slogan.
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

// CTA area: anchored to the bottom-right of the photo so the suited
// figure on the lower-left of the image stays unobscured.
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
