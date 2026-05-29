import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { selectPendingOfflineSummary, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { sfx } from '../juice/sfx';
import { formatCash } from '../format';

/**
 * Offline / catch-up summary (BRD §4.8 + §5.1 Stage 4).
 *
 * Cash is already credited by the catch-up tick; this modal is the
 * celebration moment. Tap "Collect" or backdrop to dismiss. The
 * pending 2× rewarded-ad doubler ships with the ad SDK in Phase 15.
 */
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec - h * 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSec}s`;
}

export function OfflineSummary() {
  const summary = useGameStore(selectPendingOfflineSummary);
  const ackBase = useGameStore((s) => s.acknowledgeOfflineSummary);
  const tailColor = useGameStore((s) => s.state?.tailColor ?? '#5AC8FA');
  const setStayInTouchCard = useUiStore((s) => s.setStayInTouchCard);

  const sounded = useRef(false);
  useEffect(() => {
    if (summary && !sounded.current) { sfx.play('offline_welcome'); sounded.current = true; }
    if (!summary) sounded.current = false;
  }, [summary]);

  // Design Review v4 — point 1. The first time the player completes
  // an offline summary, fire the in-game "stay-in-touch" card *after*
  // dismiss. This is when the value of notifications is concrete —
  // the player has just experienced offline earning. The OS permission
  // popup never fires before this moment.
  const ack = (): void => {
    const wasFirst = summary && summary.earnings > 0;
    ackBase();
    if (wasFirst) {
      // Defer one tick so the OfflineSummary unmounts before the
      // permission card mounts; otherwise the player sees a stack.
      window.setTimeout(() => setStayInTouchCard(true), 220);
    }
  };

  return (
    <AnimatePresence>
      {summary && (
        <motion.div
          key="offline-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={backdrop as Record<string, unknown>}
          onClick={(): void => { ack(); }}
        >
          <motion.div
            key="offline-card"
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            onClick={(e): void => e.stopPropagation()}
            style={card as Record<string, unknown>}
          >
            <div style={{ ...accentBar, background: tailColor }} />
            <div style={inner}>
              <div style={kicker}>Welcome back</div>
              <h2 style={title}>While you were away</h2>
              <p style={subtitle}>{formatDuration(summary.elapsedMs)} offline · routes kept earning</p>
              <div style={amountRow}>
                <span style={amountLabel}>Cash credited</span>
                <span style={amountValue}>${formatCash(summary.earnings)}</span>
              </div>
              <p style={smallNote}>
                A 2× rewarded-ad doubler arrives with the ad system. For now, the catch-up is auto-collected.
              </p>
              <button style={{ ...btn, background: tailColor }} onClick={(): void => { ack(); }}>
                Collect
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(3px)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 52,
  padding: 16,
};
const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 360,
  background: 'linear-gradient(160deg, #1A2244, #0B1120)',
  borderRadius: 16,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
};
const accentBar: React.CSSProperties = { height: 4 };
const inner: React.CSSProperties = { padding: '20px 22px 22px' };
const kicker: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: '#5AC8FA',
  fontWeight: 700,
};
const title: React.CSSProperties = {
  margin: '8px 0 4px',
  fontSize: 22,
  color: '#F8FAFC',
  fontWeight: 700,
};
const subtitle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: '#94A3B8',
};
const amountRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '14px 16px',
  background: 'rgba(244,199,91,0.10)',
  border: '1px solid rgba(244,199,91,0.25)',
  borderRadius: 10,
  marginTop: 14,
};
const amountLabel: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  color: '#94A3B8',
  textTransform: 'uppercase',
};
const amountValue: React.CSSProperties = {
  fontSize: 22,
  color: '#F4C75B',
  fontWeight: 700,
  fontFeatureSettings: '"tnum" 1',
  textShadow: '0 0 20px rgba(244,199,91,0.4)',
};
const smallNote: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 16,
  fontSize: 11,
  color: '#94A3B8',
  lineHeight: 1.55,
};
const btn: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: 0,
  color: '#0B1120',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  minHeight: 44,
};
