import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { selectTailColor, useGameStore } from '../../state/store';

/**
 * Introduction splash (per owner feedback — pre-game brand moment).
 *
 * Full-screen overlay shown for every app launch until the player taps
 * "Start". Wordmark + tagline + a small decorative aircraft/airport
 * scene drawn in inline SVG so it's resolution-independent and weighs
 * nothing extra in the bundle.
 *
 * Dismissed via local React state — no persistence; every launch sees
 * the splash, which matches the BRD's "branded motion beat" intent
 * (BRD §2.6 / §5.1).
 */
export function IntroSplash() {
  const [dismissed, setDismissed] = useState(false);
  const tailColor = useGameStore(selectTailColor);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          key="intro-splash"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={shell as Record<string, unknown>}
        >
          <div style={inner}>
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.4 }}
              style={kicker as Record<string, unknown>}
            >
              SkyHaven Studios presents
            </motion.div>
            <motion.h1
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.18, type: 'spring', stiffness: 280, damping: 22 }}
              style={{ ...title, textShadow: `0 0 32px ${tailColor}55` } as Record<string, unknown>}
            >
              SKYHAVEN<br /><span style={titleSub}>TYCOON</span>
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              style={tagline as Record<string, unknown>}
            >
              Wings of the World
            </motion.div>

            {/* Decorative scene — aircraft cruising above a tiny terminal. */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              style={sceneWrap as Record<string, unknown>}
            >
              <svg viewBox="0 0 320 160" width="100%" height="160" aria-hidden>
                <defs>
                  <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={tailColor} stopOpacity="0" />
                    <stop offset="100%" stopColor={tailColor} stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0B1120" />
                    <stop offset="100%" stopColor="#162548" />
                  </linearGradient>
                </defs>

                {/* Sky backdrop */}
                <rect x="0" y="0" width="320" height="120" fill="url(#sky)" />
                {/* Stars */}
                {[...Array(40)].map((_, i) => {
                  const cx = (i * 19 + 7) % 320;
                  const cy = (i * 13 + 4) % 95;
                  const r = (i % 3) * 0.4 + 0.4;
                  return <circle key={i} cx={cx} cy={cy} r={r} fill="#C4ECFF" opacity={0.5} />;
                })}
                {/* Horizon */}
                <rect x="0" y="120" width="320" height="40" fill="#0B1120" />
                <line x1="0" y1="120" x2="320" y2="120" stroke={tailColor} strokeOpacity="0.5" strokeWidth="0.6" />
                {/* Terminal silhouette */}
                <polygon points="40,120 60,108 90,108 120,120" fill="#1A2244" />
                <polygon points="190,120 220,104 260,104 290,120" fill="#1A2244" />
                <rect x="156" y="92" width="6" height="28" fill="#1A2244" />
                <circle cx="159" cy="91" r="2" fill={tailColor} />
                <rect x="48" y="113" width="2" height="2" fill={tailColor} opacity="0.7" />
                <rect x="68" y="113" width="2" height="2" fill="#F4C75B" opacity="0.8" />
                <rect x="206" y="111" width="2" height="2" fill={tailColor} opacity="0.7" />
                <rect x="232" y="111" width="2" height="2" fill="#F4C75B" opacity="0.8" />
                {/* Aircraft */}
                <g transform="translate(180 56) rotate(-8)">
                  <line x1="-80" y1="0" x2="0" y2="0" stroke="url(#trail)" strokeWidth="2" strokeLinecap="round" />
                  <polygon points="-4,-3 24,-3 32,0 24,3 -4,3" fill={tailColor} />
                  <polygon points="6,-3 14,-12 17,-12 11,-3" fill={tailColor} />
                  <polygon points="6,3 14,12 17,12 11,3" fill={tailColor} />
                  <polygon points="20,-2 28,-7 30,-7 26,-2" fill="#F8FAFC" opacity="0.6" />
                </g>
              </svg>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.4 }}
              onClick={(): void => setDismissed(true)}
              style={{ ...btn, background: tailColor } as Record<string, unknown>}
            >
              Start
            </motion.button>
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
  background: 'radial-gradient(ellipse at center, #182143 0%, #0B1120 60%)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 80,
};
const inner: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  padding: '0 24px',
  textAlign: 'center',
};
const kicker: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.32em',
  textTransform: 'uppercase',
  color: '#94A3B8',
};
const title: React.CSSProperties = {
  margin: '12px 0 6px',
  fontSize: 48,
  fontWeight: 900,
  letterSpacing: '0.05em',
  color: '#F8FAFC',
  lineHeight: 0.95,
};
const titleSub: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: '0.32em',
  color: '#5AC8FA',
};
const tagline: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: '#94A3B8',
  marginBottom: 18,
};
const sceneWrap: React.CSSProperties = {
  margin: '8px 0 22px',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
};
const btn: React.CSSProperties = {
  width: '100%',
  maxWidth: 240,
  padding: '14px 18px',
  borderRadius: 12,
  border: 0,
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#0B1120',
  cursor: 'pointer',
  minHeight: 50,
};
