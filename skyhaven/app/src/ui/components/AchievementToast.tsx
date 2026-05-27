/**
 * Achievement-unlock toast.
 *
 * Watches the store's `achievements` array for additions and shows a
 * stacked toast for each new id. Auto-dismisses after a few seconds;
 * tap to dismiss early.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { getAchievement } from '../../data/achievements';
import { selectAchievements, useGameStore } from '../../state/store';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';

interface Toast { id: string; key: number }

const SHOW_MS = 4500;

export function AchievementToast() {
  const achievements = useGameStore(selectAchievements);
  const prevRef = useRef<readonly string[] | null>(null);
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const keyRef = useRef(1);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = achievements;
    // First render: don't toast existing unlocks.
    if (prev === null) return;
    if (achievements.length <= prev.length) return;
    const known = new Set(prev);
    const added = achievements.filter((id) => !known.has(id));
    if (added.length === 0) return;
    const newToasts = added.map((id) => ({ id, key: keyRef.current++ }));
    setToasts((cur) => [...cur, ...newToasts]);
    haptics.success();
    const timer = setTimeout(() => {
      setToasts((cur) => cur.slice(newToasts.length));
    }, SHOW_MS);
    return () => clearTimeout(timer);
  }, [achievements]);

  if (toasts.length === 0) return null;

  return (
    <div style={shell}>
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const def = getAchievement(t.id);
          if (!def) return null;
          return (
            <motion.div
              key={t.key}
              initial={{ y: -24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              style={card as Record<string, unknown>}
              onClick={(): void => setToasts((cur) => cur.filter((x) => x.key !== t.key))}
            >
              <div style={kicker}>★ Achievement unlocked</div>
              <div style={name}>{def.name}</div>
              <div style={desc}>{def.description}</div>
              <div style={reward}>+${formatCash(def.reward)}</div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

const shell: React.CSSProperties = {
  position: 'fixed',
  top: 'calc(var(--world-top) + 8px)',
  right: 10,
  display: 'flex', flexDirection: 'column', gap: 6,
  zIndex: 50,
  width: 280,
  pointerEvents: 'none',
};
const card: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(244,199,91,0.95), rgba(176,141,87,0.92))',
  borderRadius: 12, padding: '12px 14px',
  border: '1px solid #F4C75B',
  boxShadow: '0 18px 40px rgba(0,0,0,0.5), 0 0 24px rgba(244,199,91,0.5)',
  color: '#0B1120', cursor: 'pointer',
  pointerEvents: 'auto',
};
const kicker: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
  fontWeight: 800,
};
const name: React.CSSProperties = { fontSize: 16, fontWeight: 800, marginTop: 4 };
const desc: React.CSSProperties = { fontSize: 12, marginTop: 2, lineHeight: 1.4 };
const reward: React.CSSProperties = {
  fontSize: 14, fontWeight: 800, marginTop: 6,
  fontFeatureSettings: '"tnum" 1',
};
