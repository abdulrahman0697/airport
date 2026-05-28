/**
 * Typewriter text reveal (Design pass D3).
 *
 * Renders `text` one character at a time at `cps` characters per
 * second, then settles. Reset on `text` change. Honours prefers-
 * reduced-motion by skipping straight to the final state.
 */
import { useEffect, useState } from 'react';

export interface TypewriterProps {
  text: string;
  /** Characters per second. Default 48 (~typing speed, not painful). */
  cps?: number;
  style?: React.CSSProperties;
}

export function Typewriter({ text, cps = 48, style }: TypewriterProps) {
  const [shown, setShown] = useState(() => prefersReducedMotion() ? text : '');

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(text);
      return;
    }
    setShown('');
    const interval = 1000 / cps;
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, interval);
    return () => window.clearInterval(id);
  }, [text, cps]);

  return <span style={style}>{shown}</span>;
}

function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
}
