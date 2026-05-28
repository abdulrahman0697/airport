/**
 * CashTickToast (Design Review v2 — point 18).
 *
 * Floats a "+$X" pop above the TopBar's cash counter whenever
 * `lifetimeEarnings` ticks up by a meaningful chunk (>= TICK_FLOOR
 * since last toast, debounced to one per ~2.5 s so the screen stays
 * legible during fast catch-ups). Each toast lives 1200 ms — slide
 * up + fade out via Framer Motion.
 *
 * Makes money feel alive (point 18 of the review).
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { selectLifetime, useGameStore } from '../../state/store';
import { COLOR, RADIUS, SPACE } from '../design/tokens';
import { formatCash } from '../format';

const TICK_FLOOR = 1_000;        // smallest delta worth a toast
const DEBOUNCE_MS = 2500;
const TOAST_LIFE_MS = 1200;
const MAX_LIVE = 4;

interface Pop {
  id: number;
  amount: number;
}

export function CashTickToast() {
  const lifetime = useGameStore(selectLifetime);
  const seenRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const lastFiredAtRef = useRef(0);
  const idRef = useRef(1);
  const [pops, setPops] = useState<readonly Pop[]>([]);

  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = lifetime;
      return;
    }
    const delta = lifetime - seenRef.current;
    if (delta <= 0) {
      seenRef.current = lifetime;
      return;
    }
    accumulatedRef.current += delta;
    seenRef.current = lifetime;

    const now = Date.now();
    if (
      accumulatedRef.current >= TICK_FLOOR
      && now - lastFiredAtRef.current >= DEBOUNCE_MS
    ) {
      const amount = accumulatedRef.current;
      accumulatedRef.current = 0;
      lastFiredAtRef.current = now;
      const id = idRef.current++;
      setPops((cur) => [...cur, { id, amount }].slice(-MAX_LIVE));
      window.setTimeout(() => {
        setPops((cur) => cur.filter((p) => p.id !== id));
      }, TOAST_LIFE_MS);
    }
  }, [lifetime]);

  if (pops.length === 0) return null;

  return (
    <div style={shell} aria-hidden>
      <AnimatePresence>
        {pops.map((p) => (
          <motion.span
            key={p.id}
            initial={{ y: 4, opacity: 0, scale: 0.7 }}
            animate={{ y: -28, opacity: 1, scale: 1 }}
            exit={{ y: -56, opacity: 0, scale: 0.85 }}
            transition={{ duration: TOAST_LIFE_MS / 1000, ease: [0.16, 1, 0.3, 1] }}
            style={pop as Record<string, unknown>}
          >
            +${formatCash(p.amount)}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

const shell: React.CSSProperties = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + 60px)',
  right: SPACE.l,
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  pointerEvents: 'none',
  zIndex: 14,
};

const pop: React.CSSProperties = {
  display: 'inline-block',
  background: COLOR.bg.elevated,
  border: `1px solid ${COLOR.gold.base}66`,
  borderRadius: RADIUS.pill,
  padding: '4px 12px',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.03em',
  color: COLOR.gold.base,
  fontFeatureSettings: '"tnum" 1',
  boxShadow: `0 0 18px ${COLOR.gold.base}66`,
  whiteSpace: 'nowrap',
};
