/**
 * Game clock (Arrivals & Time update).
 *
 * 1 real second = 1 game minute (i.e. 1 real minute = 1 game hour), so
 * the on-map clock advances at the same rate flights are timed against.
 * Derived purely from `createdAtMs` vs wall-clock — display only, no
 * engine state — so the world's calendar keeps turning across sessions.
 *
 * Only shown on the world map (not the home surface or during the
 * tutorial), top-centre, clear of the event banner's left/right text.
 */
import { useEffect, useState } from 'react';
import { selectTutorialCompleted, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';

function format(createdAtMs: number, nowMs: number): string {
  const gameMinutes = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000)); // 1 real sec = 1 game min
  const day = Math.floor(gameMinutes / 1440) + 1;
  const h = Math.floor((gameMinutes % 1440) / 60);
  const m = gameMinutes % 60;
  return `Day ${day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function GameClock() {
  const mapMode = useUiStore((s) => s.mapMode);
  const tutorialDone = useGameStore(selectTutorialCompleted);
  const createdAtMs = useGameStore((s) => s.state?.createdAtMs ?? 0);
  const [label, setLabel] = useState(() => format(createdAtMs, Date.now()));

  useEffect(() => {
    if (!mapMode) return;
    const tick = (): void => setLabel(format(createdAtMs, Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [mapMode, createdAtMs]);

  if (!tutorialDone || !mapMode || !createdAtMs) return null;

  return (
    <div style={chip} aria-label="Game time" data-popover-block-top>
      <span style={dot} />
      <span style={text}>{label}</span>
    </div>
  );
}

const chip: React.CSSProperties = {
  position: 'fixed',
  top: 'calc(var(--world-top) + 8px)',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(11,17,32,0.85)',
  border: '1px solid rgba(148,163,184,0.3)',
  borderRadius: 999,
  padding: '5px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  zIndex: 19,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  pointerEvents: 'none',
};
const dot: React.CSSProperties = {
  width: 6, height: 6, borderRadius: 999,
  background: '#F4C75B',
  boxShadow: '0 0 6px #F4C75B',
};
const text: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
  color: '#F8FAFC',
  fontFeatureSettings: '"tnum" 1',
};
