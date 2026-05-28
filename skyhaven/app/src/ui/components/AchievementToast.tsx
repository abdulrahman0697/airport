/**
 * Achievement-unlock toast — Design Review v3, point 19.
 *
 * Re-skinned to read as an aviation pilot badge instead of a flat
 * notification card. A small route-line animation traces beneath the
 * name, the icon sits in a metallic medal, and a short flavour line
 * lands the milestone. Tap to dismiss; auto-dismiss after a few sec.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { getAchievement } from '../../data/achievements';
import { selectAchievements, selectTailColor, useGameStore } from '../../state/store';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

interface Toast { id: string; key: number }

const SHOW_MS = 5000;

const FLAVOR: Record<string, string> = {
  default: 'Logged to the Airline Chronicle.',
};

export function AchievementToast() {
  const achievements = useGameStore(selectAchievements);
  const tailColor = useGameStore(selectTailColor);
  const prevRef = useRef<readonly string[] | null>(null);
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const keyRef = useRef(1);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = achievements;
    if (prev === null) return;
    if (achievements.length <= prev.length) return;
    const known = new Set(prev);
    const added = achievements.filter((id) => !known.has(id));
    if (added.length === 0) return;
    const newToasts = added.map((id) => ({ id, key: keyRef.current++ }));
    setToasts((cur) => [...cur, ...newToasts]);
    haptics.success();
    sfx.claim();
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
              initial={{ x: 60, opacity: 0, rotateZ: -2 }}
              animate={{ x: 0, opacity: 1, rotateZ: 0 }}
              exit={{ x: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              style={card(tailColor) as Record<string, unknown>}
              onClick={(): void => setToasts((cur) => cur.filter((x) => x.key !== t.key))}
            >
              <div style={medalRow}>
                <Medal tailColor={tailColor} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={kicker(tailColor)}>PILOT LOG  ·  NEW BADGE</div>
                  <div style={name}>{def.name}</div>
                </div>
              </div>
              <RouteLine tailColor={tailColor} />
              <div style={desc}>{def.description}</div>
              <div style={flavor}>{FLAVOR[def.id] ?? FLAVOR.default}</div>
              <div style={rewardRow}>
                <div style={rewardLabel}>BONUS</div>
                <div style={rewardValue}>+${formatCash(def.reward)}</div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function Medal({ tailColor }: { tailColor: string }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
      <defs>
        <radialGradient id="medal-grad" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#F4C75B" />
          <stop offset="0.7" stopColor="#B08D57" />
          <stop offset="1" stopColor="#5C4A2E" />
        </radialGradient>
      </defs>
      <circle cx="22" cy="22" r="20" fill="url(#medal-grad)" stroke="#0B1120" strokeWidth="1.4" />
      <circle cx="22" cy="22" r="14" fill="#0B1120" opacity="0.6" />
      <path d="M22 13 L26 21 L34 21 L28 26 L30 34 L22 29 L14 34 L16 26 L10 21 L18 21 Z"
        fill={tailColor} stroke="#0B1120" strokeWidth="0.8" />
    </svg>
  );
}

function RouteLine({ tailColor }: { tailColor: string }) {
  return (
    <svg style={routeLineStyle} width="240" height="22" viewBox="0 0 240 22" aria-hidden>
      <defs>
        <linearGradient id="rl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tailColor} stopOpacity="0" />
          <stop offset="0.4" stopColor={tailColor} stopOpacity="1" />
          <stop offset="1" stopColor={tailColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M 6 11 Q 60 -2 120 11 T 234 11" fill="none" stroke="url(#rl)" strokeWidth="1.6" strokeDasharray="4 3" />
      <circle cx="6" cy="11" r="2" fill={tailColor} />
      <circle cx="234" cy="11" r="2" fill={tailColor} />
      <text x="120" y="20" textAnchor="middle" fill={tailColor} fontSize="6" fontWeight="800" letterSpacing="0.16em">CHRONICLE</text>
    </svg>
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
const card = (tail: string): React.CSSProperties => ({
  background: 'linear-gradient(160deg, #14213D, #0B1426)',
  borderRadius: 14, padding: '12px 14px',
  border: `2px solid ${tail}88`,
  boxShadow: `0 18px 40px rgba(0,0,0,0.55), 0 0 28px ${tail}55`,
  color: '#F8FAFC', cursor: 'pointer',
  pointerEvents: 'auto',
});
const medalRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
};
const kicker = (tail: string): React.CSSProperties => ({
  fontSize: 9, letterSpacing: '0.22em',
  fontWeight: 800,
  color: tail,
});
const name: React.CSSProperties = {
  fontSize: 15, fontWeight: 800, marginTop: 2,
  color: '#F8FAFC',
  letterSpacing: '0.01em',
};
const routeLineStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 6, marginBottom: 4,
};
const desc: React.CSSProperties = {
  fontSize: 12, marginTop: 2, lineHeight: 1.45,
  color: '#CBD5E1',
};
const flavor: React.CSSProperties = {
  fontSize: 10, marginTop: 4,
  color: '#94A3B8',
  fontStyle: 'italic',
};
const rewardRow: React.CSSProperties = {
  marginTop: 8, paddingTop: 8,
  borderTop: '1px dashed rgba(244,199,91,0.3)',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const rewardLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.22em', color: '#94A3B8',
};
const rewardValue: React.CSSProperties = {
  fontSize: 16, fontWeight: 900, color: '#F4C75B',
  fontFeatureSettings: '"tnum" 1',
};
