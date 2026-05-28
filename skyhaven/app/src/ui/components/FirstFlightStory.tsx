/**
 * FirstFlightStory — first-launch cinematic that plays after the
 * splash dismisses and before the tutorial starts.
 *
 * A six-beat photo story that mirrors what just happened in the
 * splash ("Start Boarding → Clear for Takeoff"). Plays once only
 * (gated on uiStore.cinematicSeen), with subtle Ken-Burns zoom on
 * each photo, cross-fade transitions, and a typewriter caption
 * underneath. Beat six is the +$5,000 First Flight Revenue burst,
 * then the cinematic dismisses into the founder flow.
 *
 * Story beats:
 *   1. story1-arrival.png   "Passengers arrive at SkyHaven"
 *   2. story2-tarmac.png    "Walking out to the gate"
 *   3. story3-boarding.png  "Boarding the inaugural flight"
 *   4. story4-clearance.png "Cleared for departure"
 *   5. story5-runway.png    "Lined up on runway 27"
 *   6. (same image) + +$5,000 First Flight Revenue overlay
 *
 * A small "Skip ▸" affordance in the top-right lets the player
 * fast-forward to the founder flow if they've seen it before. The
 * cinematicSeen flag in uiStore is set on completion or skip so the
 * story never replays.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { selectTailColor, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { ConfettiBurst } from '../design/ConfettiBurst';
import { COLOR, MOTION, RADIUS } from '../design/tokens';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

interface Beat {
  src: string;
  caption: string;
  /** Hold duration in ms before transitioning to the next beat. */
  hold: number;
}

const BEATS: readonly Beat[] = [
  { src: '/story1-arrival.png',   caption: 'Passengers arrive at SkyHaven', hold: 2600 },
  { src: '/story2-tarmac.png',    caption: 'Walking out to the gate',        hold: 2600 },
  { src: '/story3-boarding.png',  caption: 'Boarding the inaugural flight',  hold: 2600 },
  { src: '/story4-clearance.png', caption: 'Cleared for departure',          hold: 2600 },
  { src: '/story5-runway.png',    caption: 'Lined up on runway 27',          hold: 2400 },
  { src: '/story5-runway.png',    caption: 'First flight revenue posted',    hold: 2800 },
];

const CROSSFADE_MS = 700;

export function FirstFlightStory() {
  const introDismissed = useUiStore((s) => s.introDismissed);
  const cinematicSeen = useUiStore((s) => s.cinematicSeen);
  const markCinematicSeen = useUiStore((s) => s.markCinematicSeen);
  const tailColor = useGameStore(selectTailColor);
  const [beat, setBeat] = useState(0);

  const visible = introDismissed && !cinematicSeen;

  // Drive beats sequentially. Each beat advances after its `hold`
  // duration. The final beat triggers cinematicSeen which unmounts
  // the cinematic.
  useEffect(() => {
    if (!visible) return;
    if (beat >= BEATS.length) {
      // All beats done — close the cinematic.
      markCinematicSeen();
      return;
    }
    const current = BEATS[beat]!;
    const id = window.setTimeout(() => {
      // Haptic cadence: subtle on most beats, success on revenue.
      if (beat === BEATS.length - 1) {
        haptics.success();
        sfx.success();
      } else if (beat === 3) {
        haptics.medium();
        sfx.confirm();
      } else {
        haptics.light();
      }
      setBeat((b) => b + 1);
    }, current.hold);
    return () => window.clearTimeout(id);
  }, [beat, visible, markCinematicSeen]);

  // Fire a single haptic when the story first opens.
  useEffect(() => {
    if (visible && beat === 0) {
      haptics.medium();
      sfx.confirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const skip = (): void => {
    haptics.light();
    sfx.tick();
    markCinematicSeen();
  };

  if (!visible) return null;

  const current = BEATS[Math.min(beat, BEATS.length - 1)]!;
  const isRevenueBeat = beat === BEATS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        key="first-flight-story"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: MOTION.duration.medium / 1000 }}
        style={shell as Record<string, unknown>}
      >
        {/* Stacked photo layers with cross-fade + Ken-Burns zoom.
            We mount one image per beat keyed by beat index so the
            previous image stays in the tree (fading out) while the
            next one fades in. */}
        <AnimatePresence>
          <motion.div
            key={`photo-${beat}`}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1.0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{
              opacity: { duration: CROSSFADE_MS / 1000, ease: 'easeOut' },
              scale: { duration: (current.hold + CROSSFADE_MS) / 1000, ease: 'easeOut' },
            }}
            style={{
              ...photoLayer,
              backgroundImage: `url('${current.src}')`,
            } as Record<string, unknown>}
          />
        </AnimatePresence>

        {/* Soft dark gradient at the bottom so the caption reads
            against any image. */}
        <div style={bottomGradient} aria-hidden />
        {/* Top gradient for the skip button. */}
        <div style={topGradient} aria-hidden />

        {/* Caption */}
        <div style={captionArea}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`cap-${beat}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              style={captionInner as Record<string, unknown>}
            >
              <div style={captionText}>{current.caption}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Revenue burst — beat 6 only. A big +$5,000 in gold, with
            a confetti shower, sliding up from the lower-third over
            the runway image. */}
        <AnimatePresence>
          {isRevenueBeat && (
            <motion.div
              key="revenue"
              initial={{ opacity: 0, scale: 0.6, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.2 }}
              style={revBurst as Record<string, unknown>}
            >
              <div style={revKicker(tailColor)}>FIRST FLIGHT REVENUE</div>
              <div style={revAmount}>+$5,000</div>
              <div style={revFoot}>Posted to your airline balance</div>
            </motion.div>
          )}
        </AnimatePresence>
        {isRevenueBeat && (
          <ConfettiBurst seed={101} count={48} palette={[tailColor, COLOR.gold.base, COLOR.gold.light, '#FFFFFF']} />
        )}

        {/* Skip control */}
        <button onClick={skip} style={skipBtn} aria-label="Skip cinematic">
          Skip ▸
        </button>

        {/* Per-beat progress dots at the bottom */}
        <div style={progressRow}>
          {BEATS.map((_, i) => (
            <span key={i} style={progressDot(i <= beat, tailColor)} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 92,
  background: '#000',
  overflow: 'hidden',
};

const photoLayer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
};

const topGradient: React.CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: '18%',
  background: 'linear-gradient(180deg, rgba(7,10,24,0.7), transparent)',
  pointerEvents: 'none',
};
const bottomGradient: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0, bottom: 0,
  height: '38%',
  background: 'linear-gradient(0deg, rgba(7,10,24,0.92), rgba(7,10,24,0.65) 50%, transparent)',
  pointerEvents: 'none',
};

const captionArea: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0,
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
  display: 'flex',
  justifyContent: 'center',
  padding: '0 24px',
  zIndex: 4,
};
const captionInner: React.CSSProperties = {
  textAlign: 'center',
  maxWidth: 460,
};
const captionText: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: '0.02em',
  color: '#F8FAFC',
  lineHeight: 1.3,
  textShadow: '0 2px 14px rgba(0,0,0,0.85), 0 4px 24px rgba(0,0,0,0.6)',
};

const revBurst: React.CSSProperties = {
  position: 'absolute',
  left: 0, right: 0,
  top: '32%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  zIndex: 5,
  pointerEvents: 'none',
};
const revKicker = (tail: string): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.32em',
  color: tail,
  textShadow: '0 2px 8px rgba(0,0,0,0.8)',
});
const revAmount: React.CSSProperties = {
  fontSize: 64,
  fontWeight: 900,
  color: COLOR.gold.base,
  letterSpacing: '0.02em',
  marginTop: 6,
  fontFeatureSettings: '"tnum" 1',
  textShadow: '0 0 32px rgba(244,199,91,0.85), 0 4px 14px rgba(0,0,0,0.7)',
};
const revFoot: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.18em',
  color: COLOR.gold.base,
  textTransform: 'uppercase',
  textShadow: '0 2px 6px rgba(0,0,0,0.8)',
};

const skipBtn: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
  right: 16,
  background: 'rgba(11,17,32,0.55)',
  color: '#CBD5E1',
  border: '1px solid rgba(148,163,184,0.3)',
  borderRadius: RADIUS.pill,
  padding: '6px 14px',
  fontSize: 11,
  fontFamily: 'inherit',
  cursor: 'pointer',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 700,
  zIndex: 6,
  backdropFilter: 'blur(6px)',
};

const progressRow: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
  left: 0, right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 6,
  zIndex: 4,
};
const progressDot = (active: boolean, tail: string): React.CSSProperties => ({
  width: active ? 24 : 6,
  height: 4,
  borderRadius: 2,
  background: active ? tail : 'rgba(148,163,184,0.35)',
  boxShadow: active ? `0 0 8px ${tail}` : 'none',
  transition: 'width 320ms ease, background 320ms ease, box-shadow 320ms ease',
});
