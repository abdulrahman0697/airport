/**
 * StayInTouchCard — Design Review v4, point 1.
 *
 * The in-game push-permission opt-in. Renders ONLY after the player
 * has experienced an offline-income moment, so they understand what
 * notifications are for *before* the OS popup arrives. If they tap
 * "Yes, alert me", we fire the system permission request. If they
 * tap "Not now", we silently dismiss and never bother them again
 * unless they reach for it manually in Settings.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { requestPushPermissionInGame } from '../../backend/push';
import { selectTailColor, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../design/Button';
import { COLOR, RADIUS, SHADOW, SPACE } from '../design/tokens';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

export function StayInTouchCard() {
  const open = useUiStore((s) => s.stayInTouchCard);
  const close = useUiStore((s) => s.setStayInTouchCard);
  const tailColor = useGameStore(selectTailColor);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const onAllow = async (): Promise<void> => {
    setBusy(true);
    haptics.medium();
    sfx.confirm();
    try {
      await requestPushPermissionInGame();
    } catch {
      // Ignored — the user can always re-enable from Settings.
    }
    close(false);
  };

  const onDecline = (): void => {
    haptics.light();
    close(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="stay-in-touch"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={backdrop as Record<string, unknown>}
        onClick={onDecline}
      >
        <motion.div
          initial={{ scale: 0.92, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          style={card(tailColor) as Record<string, unknown>}
          onClick={(e): void => e.stopPropagation()}
        >
          <div style={kicker(tailColor)}>STAY IN TOUCH</div>
          <h2 style={title}>Your airline keeps earning</h2>
          <p style={body}>
            Even when the app is closed, routes keep flying and revenue
            keeps building. Want us to alert you when something needs
            your attention — a fuel shock, a vintage drop, a tier
            milestone?
          </p>
          <div style={bulletList}>
            <Bullet color={tailColor}>Soft alerts when routes return</Bullet>
            <Bullet color={tailColor}>Live-event invites for limited windows</Bullet>
            <Bullet color={tailColor}>Tier unlock + vintage drop reminders</Bullet>
          </div>
          <p style={micro}>
            You can change this any time from Settings.
          </p>
          <div style={buttonsRow}>
            <Button variant="ghost" size="md" fullWidth onClick={onDecline}>
              Not now
            </Button>
            <Button
              variant="gold"
              size="md"
              fullWidth
              disabled={busy}
              hapticOnPress="heavy"
              onClick={(): void => { void onAllow(); }}
            >
              Yes, alert me
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Bullet({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={bulletRow}>
      <span style={{ ...bulletDot, background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={bulletText}>{children}</span>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 108,
  background: 'rgba(7,10,24,0.78)',
  backdropFilter: 'blur(6px)',
  display: 'grid',
  placeItems: 'center',
  padding: SPACE.l,
};
const card = (tail: string): React.CSSProperties => ({
  width: '100%',
  maxWidth: 400,
  background: 'linear-gradient(170deg, #14213D, #0B1426)',
  border: `2px solid ${tail}66`,
  borderRadius: 20,
  padding: SPACE.l,
  boxShadow: `${SHADOW.modal}, 0 0 48px ${tail}33`,
});
const kicker = (tail: string): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.24em',
  color: tail,
});
const title: React.CSSProperties = {
  margin: '8px 0 8px',
  fontSize: 22,
  fontWeight: 900,
  color: COLOR.ink.primary,
  letterSpacing: '0.01em',
};
const body: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 13,
  lineHeight: 1.55,
  color: COLOR.ink.secondary,
};
const bulletList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  background: 'rgba(11,17,32,0.55)',
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: RADIUS.m,
  padding: '10px 12px',
  marginBottom: 10,
};
const bulletRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};
const bulletDot: React.CSSProperties = {
  width: 6, height: 6,
  borderRadius: 999,
  flexShrink: 0,
};
const bulletText: React.CSSProperties = {
  fontSize: 12,
  color: COLOR.ink.primary,
  lineHeight: 1.5,
};
const micro: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 11,
  color: COLOR.ink.faint,
  textAlign: 'center',
};
const buttonsRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1.4fr',
  gap: 8,
};
