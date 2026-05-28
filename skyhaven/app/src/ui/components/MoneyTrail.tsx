/**
 * MoneyTrail — Design Review v6, point 18.
 *
 * A globally-mountable burst layer that draws "+$X" tokens flying
 * from an arbitrary source coordinate up to the cash counter in the
 * top bar. Surfaces like NetworkSkyView call `emitMoneyTrail({ fromX,
 * fromY, amount })` whenever a flight arrives, and the trail lands at
 * the cash display so the loop "arrival → cash counter ticks up"
 * is physically visible.
 *
 * Implemented as a tiny event bus + Framer Motion overlay. No store
 * mutation; trails fade after ~1.2s.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { COLOR } from '../design/tokens';

interface Trail {
  id: number;
  fromX: number;
  fromY: number;
  text: string;
}

type Listener = (trail: Trail) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function emitMoneyTrail(opts: { fromX: number; fromY: number; amount: number }): void {
  const trail: Trail = {
    id: nextId++,
    fromX: opts.fromX,
    fromY: opts.fromY,
    text: opts.amount >= 1000
      ? `+$${(opts.amount / 1000).toFixed(1)}K`
      : `+$${Math.max(1, opts.amount | 0)}`,
  };
  for (const l of listeners) l(trail);
}

const LIFETIME_MS = 1200;
const TOP_BAR_TARGET = { x: 'calc(100vw - 90px)', y: 38 };

export function MoneyTrailLayer() {
  const [trails, setTrails] = useState<readonly Trail[]>([]);

  useEffect(() => {
    const onTrail: Listener = (trail) => {
      setTrails((cur) => [...cur, trail]);
      window.setTimeout(() => {
        setTrails((cur) => cur.filter((t) => t.id !== trail.id));
      }, LIFETIME_MS);
    };
    listeners.add(onTrail);
    return () => { listeners.delete(onTrail); };
  }, []);

  return (
    <div style={layer} aria-hidden>
      <AnimatePresence>
        {trails.map((t) => (
          <motion.div
            key={t.id}
            initial={{
              left: t.fromX,
              top: t.fromY,
              opacity: 0,
              scale: 0.7,
            }}
            animate={{
              left: TOP_BAR_TARGET.x,
              top: TOP_BAR_TARGET.y,
              opacity: 1,
              scale: 1,
            }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{
              duration: LIFETIME_MS / 1000,
              ease: [0.6, 0.05, 0.3, 1],
              opacity: { duration: 0.18 },
            }}
            style={trailToken as Record<string, unknown>}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

const layer: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 35,
};
const trailToken: React.CSSProperties = {
  position: 'absolute',
  fontSize: 13,
  fontWeight: 900,
  color: COLOR.gold.base,
  fontFeatureSettings: '"tnum" 1',
  textShadow: `0 0 8px ${COLOR.gold.base}, 0 2px 4px rgba(0,0,0,0.6)`,
  letterSpacing: '0.04em',
  // Translate origin so the token's anchor is its center, not its
  // top-left corner. That way the start coords land on the burst point.
  transform: 'translate(-50%, -50%)',
  whiteSpace: 'nowrap',
};
