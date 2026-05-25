import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../state/store';
import { formatCash } from '../format';
import { usePanelStore } from './PanelHost';

/**
 * Floating HUD fuel gauge (BRD §4.6).
 *
 * Sits below the top bar on the right edge. Shows reserve / capacity
 * as a vertical fill, plus the net rate (supply − demand) as a small
 * delta below. Color shifts amber when net is negative, red when
 * empty + draining. Tap → opens the FuelPanel.
 */
export function FuelGauge() {
  const fuel = useGameStore((s) => s.state?.fuel);
  const open = usePanelStore((s) => s.open);

  // Smooth the displayed reserve so the bar doesn't jitter.
  const [shown, setShown] = useState(fuel?.reserve ?? 0);
  const shownRef = useRef(fuel?.reserve ?? 0);
  const targetRef = useRef(fuel?.reserve ?? 0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!fuel) return;
    targetRef.current = fuel.reserve;
    if (rafRef.current) return;
    const step = (): void => {
      const tgt = targetRef.current;
      const cur = shownRef.current;
      const diff = tgt - cur;
      if (Math.abs(diff) < 1) {
        shownRef.current = tgt;
        setShown(tgt);
        rafRef.current = 0;
        return;
      }
      const next = cur + diff * 0.12;
      shownRef.current = next;
      setShown(next);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [fuel]);
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  if (!fuel) return null;
  const pct = fuel.capacity > 0 ? Math.max(0, Math.min(1, shown / fuel.capacity)) : 0;
  const net = fuel.supplyRate - fuel.demandRate;
  const draining = net < 0;
  const empty = fuel.reserve <= 0 && draining;
  const color = empty ? '#F87171' : draining ? '#F59E0B' : '#5AC8FA';

  return (
    <button onClick={(): void => open('fuel')} style={shell} aria-label={`Fuel: ${pct * 100 | 0}%`}>
      <div style={bar}>
        <div style={{ ...fill, height: `${pct * 100}%`, background: color }} />
      </div>
      <div style={{ ...rateLabel, color }}>
        {net >= 0 ? '+' : ''}{net.toFixed(1)}/s
      </div>
      <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>
        {formatCash(shown, 0)}
      </div>
    </button>
  );
}

const shell: React.CSSProperties = {
  position: 'fixed',
  right: 10,
  top: 'max(72px, calc(env(safe-area-inset-top) + 60px))',
  width: 44,
  background: 'rgba(11, 17, 32, 0.78)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '8px 4px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  cursor: 'pointer',
  zIndex: 15,
  pointerEvents: 'auto',
  color: '#F8FAFC',
  fontFamily: 'inherit',
  fontFeatureSettings: '"tnum" 1',
};

const bar: React.CSSProperties = {
  width: 8,
  height: 56,
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 4,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column-reverse',
};

const fill: React.CSSProperties = {
  width: '100%',
  transition: 'background-color 240ms ease',
};

const rateLabel: React.CSSProperties = {
  marginTop: 6,
  fontSize: 10,
  fontWeight: 600,
};
