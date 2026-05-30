/**
 * Arrival money pops (Arrivals & Time update).
 *
 * Revenue lands when a plane arrives, so each landing gets a brief
 * floating "+$X · DOH" card near the top of the world map. Cards rise
 * and fade; map-only and post-tutorial. Reduced-motion is handled by the
 * global CSS rule (collapses the rise). Driven by the store's transient
 * recentArrivals tail — never persisted.
 */
import { useEffect, useRef, useState } from 'react';
import {
  selectRecentArrivals,
  selectTailColor,
  selectTutorialCompleted,
  useGameStore,
} from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { formatCash } from '../format';

interface Pop { key: number; destIata: string; amount: number }
const LIFETIME_MS = 3000;

export function ArrivalPops() {
  const mapMode = useUiStore((s) => s.mapMode);
  const tutorialDone = useGameStore(selectTutorialCompleted);
  const tailColor = useGameStore(selectTailColor);
  const arrivals = useGameStore(selectRecentArrivals);
  const [pops, setPops] = useState<Pop[]>([]);
  const lastKey = useRef(0);

  useEffect(() => {
    if (!mapMode || !tutorialDone || arrivals.length === 0) return;
    const fresh = arrivals.filter((a) => a.key > lastKey.current);
    if (fresh.length === 0) return;
    lastKey.current = arrivals[arrivals.length - 1]!.key;
    // Cap how many appear at once so a big catch-up tick can't flood.
    const add = fresh.slice(-4).map((a) => ({ key: a.key, destIata: a.destIata, amount: a.amount }));
    setPops((cur) => [...cur, ...add].slice(-6));
    const timer = window.setTimeout(() => {
      setPops((cur) => cur.filter((p) => !add.some((x) => x.key === p.key)));
    }, LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [arrivals, mapMode, tutorialDone]);

  if (!mapMode || !tutorialDone || pops.length === 0) return null;

  return (
    <div style={layer} aria-hidden>
      {pops.map((p) => (
        <div key={p.key} style={card(tailColor)}>
          <span style={amount}>+${formatCash(p.amount)}</span>
          <span style={dest}>{p.destIata}</span>
        </div>
      ))}
    </div>
  );
}

const layer: React.CSSProperties = {
  position: 'fixed',
  top: 'calc(var(--world-top) + 92px)',
  left: 0,
  right: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  zIndex: 17,
  pointerEvents: 'none',
};
const card = (tail: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(11,17,32,0.88)',
  border: `1px solid ${tail}66`,
  borderRadius: 999,
  padding: '5px 12px',
  boxShadow: '0 6px 16px rgba(0,0,0,0.45)',
  backdropFilter: 'blur(6px)',
  animation: 'arrivalRise 3s ease-out forwards',
});
const amount: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#34D399',
  fontFeatureSettings: '"tnum" 1',
};
const dest: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  color: '#94A3B8',
};
