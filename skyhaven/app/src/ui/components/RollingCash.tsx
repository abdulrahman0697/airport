import { useEffect, useRef, useState } from 'react';
import { formatCash } from '../format';

/**
 * Smooth-rolling cash counter.
 *
 * Animates the displayed value toward `value` with a critically-damped
 * lerp. Honours `prefers-reduced-motion` by snapping directly. The full
 * per-digit odometer treatment lands in Phase 10 with the visual polish.
 */
export function RollingCash({ value, color = '#F4C75B' }: { value: number; color?: string }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const targetRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    targetRef.current = value;
    if (rafRef.current) return;
    const reduce = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const step = (): void => {
      const cur = shownRef.current;
      const tgt = targetRef.current;
      const diff = tgt - cur;
      if (Math.abs(diff) < Math.max(0.5, Math.abs(tgt) * 1e-5)) {
        shownRef.current = tgt;
        setShown(tgt);
        rafRef.current = 0;
        return;
      }
      // Critically-damped lerp: closes 8% of the gap per frame at 60fps,
      // making large jumps still feel snappy but readable.
      const next = cur + diff * 0.08;
      shownRef.current = next;
      setShown(next);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [value]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <span style={{ color, fontFeatureSettings: '"tnum" 1', textShadow: `0 0 12px ${color}55` }}>
      ${formatCash(shown)}
    </span>
  );
}
