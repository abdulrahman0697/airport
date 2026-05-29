import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { EVENT_DEFS } from '../../data/events';
import { getRegion } from '../../data/regions';
import { isRunning } from '../../engine/events';
import { selectActiveEvents, useGameStore } from '../../state/store';
import { sfx } from '../juice/sfx';

/**
 * Live-event HUD banner (BRD §4.12).
 *
 * Sits under the top bar. Lists active events with their remaining time,
 * colour-coded for positive (cyan) and negative (amber) impact. Stacks
 * vertically when multiple events overlap.
 */
export function EventBanner() {
  const allEvents = useGameStore(selectActiveEvents);
  // Force a re-render every second so the countdown ticks even when
  // the game state doesn't otherwise update.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  // Only show events whose effects are actually applying. Announced
  // events live in the EventPopup until their start time.
  const events = allEvents.filter((e) => isRunning(e, now));

  // Fire the resolve cue when a running event drops out of the set.
  const runningKey = events.map((e) => e.id).join(',');
  const prevRunning = useRef<Set<string>>(new Set());
  useEffect(() => {
    const cur = new Set(events.map((e) => e.id));
    let ended = false;
    for (const id of prevRunning.current) if (!cur.has(id)) ended = true;
    if (ended) sfx.play('event_end');
    prevRunning.current = cur;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningKey]);

  if (events.length === 0) return null;

  return (
    <div style={shell} aria-label="Active events" data-popover-block-top>
      <AnimatePresence>
        {events.map((e) => {
          const def = EVENT_DEFS[e.kind];
          const remainingMs = Math.max(0, e.startedAt + e.durationMs - now);
          const remainingSec = Math.ceil(remainingMs / 1000);
          const region = e.regionId !== null ? getRegion(e.regionId) : null;
          const accent = def.positive ? '#5AC8FA' : '#F59E0B';
          return (
            <motion.div
              key={e.id}
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              style={{ ...item, borderColor: accent, color: accent } as Record<string, unknown>}
            >
              <div style={itemHead}>
                <span style={{ ...dot, background: accent }} />
                <span style={itemName}>{def.name}</span>
                {region && <span style={regionPill}>{region.name}</span>}
              </div>
              <div style={itemBody}>
                <span style={itemDesc}>{def.description}</span>
                <span style={itemCountdown}>
                  {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = {
  position: 'fixed',
  top: 'calc(var(--world-top) + 8px)',
  left: 10,
  right: 64, // leave space for FuelGauge on the right
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  zIndex: 9,
  pointerEvents: 'none',
};
const item: React.CSSProperties = {
  background: 'rgba(11, 17, 32, 0.82)',
  backdropFilter: 'blur(8px)',
  borderLeft: '3px solid #5AC8FA',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 11,
  letterSpacing: '0.04em',
};
const itemHead: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };
const dot: React.CSSProperties = { width: 6, height: 6, borderRadius: 3, display: 'inline-block' };
const itemName: React.CSSProperties = {
  fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 10,
};
const regionPill: React.CSSProperties = {
  fontSize: 9, color: '#94A3B8',
  background: 'rgba(255,255,255,0.06)',
  padding: '1px 6px', borderRadius: 4,
};
const itemBody: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 4,
  color: '#F8FAFC',
};
const itemDesc: React.CSSProperties = { fontSize: 11 };
const itemCountdown: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 700,
};
