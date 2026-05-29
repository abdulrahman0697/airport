/**
 * Rewarded-offer popup (Phase 15).
 *
 * A self-contained bottom card with a 15-second countdown bar and two
 * actions: watch the ad (gold CTA) or skip/close. Used for the periodic
 * instant-cash / speed-up offers and the out-of-fuel prompt. Opt-in by
 * design — it auto-dismisses on the countdown, never blocks play.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { COLOR, RADIUS } from '../design/tokens';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

export function RewardOfferPopup(props: {
  open: boolean;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  /** Auto-dismiss window in ms (0 disables). */
  autoMs?: number;
  /** Runs the ad + grant; resolves when done. */
  onWatch: () => Promise<void>;
  onClose: () => void;
}) {
  const { open, kicker, title, body, cta, autoMs = 15_000, onWatch, onClose } = props;
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(Math.ceil(autoMs / 1000));
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || autoMs <= 0) return;
    setRemaining(Math.ceil(autoMs / 1000));
    const started = Date.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, autoMs - (Date.now() - started));
      setRemaining(Math.ceil(left / 1000));
      if (left <= 0) { window.clearInterval(id); closeRef.current(); }
    }, 250);
    return () => window.clearInterval(id);
  }, [open, autoMs]);

  const watch = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    haptics.medium();
    try {
      await onWatch();
      sfx.play('claim_coin');
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="reward-offer"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          style={wrap as Record<string, unknown>}
        >
          <div style={card}>
            <button onClick={(): void => { haptics.light(); onClose(); }} style={closeBtn} aria-label="Skip">✕</button>
            <div style={kickerStyle}>{kicker}</div>
            <div style={titleStyle}>{title}</div>
            <div style={bodyStyle}>{body}</div>
            <button onClick={(): void => { void watch(); }} disabled={busy} style={watchBtn}>
              {busy ? 'Loading ad…' : `▶  ${cta}`}
            </button>
            {autoMs > 0 && <div style={countdown}>Skips in {remaining}s</div>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const wrap: React.CSSProperties = {
  position: 'fixed',
  left: 0, right: 0,
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
  display: 'flex', justifyContent: 'center',
  padding: '0 14px', zIndex: 60, pointerEvents: 'none',
};
const card: React.CSSProperties = {
  position: 'relative', pointerEvents: 'auto',
  width: '100%', maxWidth: 360,
  background: 'linear-gradient(180deg, rgba(17,24,40,0.96), rgba(7,10,24,0.98))',
  border: `1px solid ${COLOR.gold.base}55`,
  borderRadius: RADIUS.m, padding: '14px 16px 12px',
  boxShadow: '0 18px 44px rgba(0,0,0,0.6), 0 0 24px rgba(244,199,91,0.18)',
};
const closeBtn: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, width: 28, height: 28,
  borderRadius: 8, border: 0, background: 'rgba(255,255,255,0.08)',
  color: '#94A3B8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
const kickerStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: COLOR.gold.base,
};
const titleStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 800, color: '#F8FAFC', marginTop: 4,
};
const bodyStyle: React.CSSProperties = {
  fontSize: 12, color: '#CBD5E1', marginTop: 4, lineHeight: 1.4, paddingRight: 24,
};
const watchBtn: React.CSSProperties = {
  marginTop: 12, width: '100%', minHeight: 44, borderRadius: 10, border: 0,
  background: COLOR.gold.base, color: '#0B1120', fontWeight: 800, fontSize: 14,
  cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em',
};
const countdown: React.CSSProperties = {
  textAlign: 'center', fontSize: 10, color: '#64748B', marginTop: 6,
  fontFeatureSettings: '"tnum" 1',
};
