import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { STREAK_REWARDS } from '../../engine/dailyLogin';
import { selectPendingDailyReward, useGameStore } from '../../state/store';
import { sfx } from '../juice/sfx';
import { formatCash } from '../format';

/**
 * Daily-login reward modal (BRD §7 Daily layer).
 *
 * Fires once per calendar day on the first foreground transition.
 * Shows a 7-day strip with the active day highlighted; tap "Claim"
 * to add the cash and dismiss.
 */
export function DailyReward() {
  const reward = useGameStore(selectPendingDailyReward);
  const claim = useGameStore((s) => s.claimDailyReward);
  const tailColor = useGameStore((s) => s.state?.tailColor ?? '#5AC8FA');

  const sounded = useRef(false);
  useEffect(() => {
    if (reward && !sounded.current) { sfx.play('reward_login'); sounded.current = true; }
    if (!reward) sounded.current = false;
  }, [reward]);

  return (
    <AnimatePresence>
      {reward && (
        <motion.div
          key="daily-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={backdrop as Record<string, unknown>}
          onClick={(): void => { claim(); }}
        >
          <motion.div
            key="daily-card"
            initial={{ y: 30, scale: 0.9, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            onClick={(e): void => e.stopPropagation()}
            style={card as Record<string, unknown>}
          >
            <div style={{ ...accentBar, background: tailColor }} />
            <div style={inner}>
              <div style={kicker}>Daily reward</div>
              <h2 style={title}>Day {reward.day}</h2>
              <p style={subtitle}>Login streak: {reward.day} {reward.day === 1 ? 'day' : 'days'}</p>

              <div style={strip}>
                {STREAK_REWARDS.slice(1, 8).map((amount, i) => {
                  const day = i + 1;
                  const active = day === Math.min(reward.day, 7);
                  return (
                    <div key={day} style={{ ...slot, ...(active ? slotActive : {}) }}>
                      <div style={slotDay}>Day {day}</div>
                      <div style={slotAmount}>${formatCash(amount, 0)}</div>
                    </div>
                  );
                })}
              </div>

              <div style={rewardRow}>
                <span style={rewardLabel}>Today's reward</span>
                <span style={rewardValue}>+${formatCash(reward.amount)}</span>
              </div>
              <button style={{ ...btn, background: tailColor }} onClick={(): void => { claim(); }}>
                Claim
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
  position: 'fixed', inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(3px)',
  display: 'grid', placeItems: 'center',
  zIndex: 53, padding: 16,
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: 360,
  background: 'linear-gradient(160deg, #1A2244, #0B1120)',
  borderRadius: 16, overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
};
const accentBar: React.CSSProperties = { height: 4 };
const inner: React.CSSProperties = { padding: '20px 22px 22px' };
const kicker: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: '#5AC8FA', fontWeight: 700,
};
const title: React.CSSProperties = {
  margin: '6px 0 4px', fontSize: 22, color: '#F8FAFC', fontWeight: 700,
};
const subtitle: React.CSSProperties = { margin: 0, fontSize: 12, color: '#94A3B8' };
const strip: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
  margin: '16px 0 14px',
};
const slot: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 6, padding: '8px 4px', textAlign: 'center',
  border: '1px solid rgba(255,255,255,0.06)',
};
const slotActive: React.CSSProperties = {
  background: 'rgba(90,200,250,0.18)',
  borderColor: 'rgba(90,200,250,0.55)',
  boxShadow: '0 0 16px rgba(90,200,250,0.35)',
};
const slotDay: React.CSSProperties = {
  fontSize: 8, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase',
};
const slotAmount: React.CSSProperties = {
  fontSize: 10, color: '#F4C75B', marginTop: 4, fontWeight: 700,
  fontFeatureSettings: '"tnum" 1',
};
const rewardRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  padding: '12px 14px',
  background: 'rgba(244,199,91,0.10)',
  border: '1px solid rgba(244,199,91,0.25)',
  borderRadius: 10,
  marginBottom: 12,
};
const rewardLabel: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em',
  color: '#94A3B8', textTransform: 'uppercase',
};
const rewardValue: React.CSSProperties = {
  fontSize: 20, color: '#F4C75B', fontWeight: 700,
  fontFeatureSettings: '"tnum" 1',
};
const btn: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: 0, color: '#0B1120', fontWeight: 700, fontSize: 14,
  cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
};
