import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EVENT_DEFS } from '../../data/events';
import { getRegion } from '../../data/regions';
import { isAnnounced } from '../../engine/events';
import type { ActiveEvent } from '../../engine/types';
import { selectActiveEvents, useGameStore } from '../../state/store';
import { sfx } from '../juice/sfx';

/**
 * Event announcement popup (Phase 6 polish).
 *
 * When an event enters the announce window (before its effects begin),
 * we show a centered card with the event name + description so the
 * player has a moment to read it. The card auto-dismisses when the
 * event transitions to its running phase; the player can also dismiss
 * it early with "Got it" or by tapping the backdrop.
 *
 * One popup at a time. The engine enforces "no two events", so this
 * just renders the first announced event in the list.
 */
export function EventPopup() {
  const events = useGameStore(selectActiveEvents);
  const [, force] = useState(0);
  const dismissedRef = useRef<Set<string>>(new Set());

  // Re-render every 250 ms so the popup disappears once the announce
  // window closes even if no other store update happens.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const announced: ActiveEvent | null = useMemo(() => {
    for (const e of events) {
      if (isAnnounced(e, now) && !dismissedRef.current.has(e.id)) return e;
    }
    return null;
    // `now` is the second-level driver — re-evaluated on every render
    // (250 ms cadence above + store updates).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, now]);

  // Announce cue — positive for boom/rush, warning for the fuel spike.
  const soundedRef = useRef<string | null>(null);
  useEffect(() => {
    if (announced && soundedRef.current !== announced.id) {
      sfx.play(announced.kind === 'fuel_price_spike' ? 'event_negative' : 'event_positive');
      soundedRef.current = announced.id;
    }
  }, [announced]);

  const dismiss = (id: string): void => {
    dismissedRef.current.add(id);
    force((n) => n + 1);
  };

  return (
    <AnimatePresence>
      {announced && (
        <motion.div
          key="event-popup-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          style={backdrop as Record<string, unknown>}
          onClick={(): void => dismiss(announced.id)}
        >
          <motion.div
            key={announced.id}
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            onClick={(e): void => e.stopPropagation()}
            style={card as Record<string, unknown>}
          >
            <PopupBody
              event={announced}
              onDismiss={(): void => dismiss(announced.id)}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PopupBody({ event, onDismiss }: { event: ActiveEvent; onDismiss: () => void }) {
  const def = EVENT_DEFS[event.kind];
  const region = event.regionId !== null ? getRegion(event.regionId) : null;
  const accent = def.positive ? '#5AC8FA' : '#F59E0B';
  return (
    <>
      <div style={{ ...accentBar, background: accent }} />
      <div style={inner}>
        <div style={kicker(accent)}>
          {def.positive ? 'Live event' : 'Heads up'}
          {region && <span style={regionPill}>{region.name}</span>}
        </div>
        <h2 style={title(accent)}>{def.name}</h2>
        <p style={desc}>{def.description}</p>
        <p style={smallNote}>
          {def.positive
            ? 'Effects kick in shortly — make the most of it.'
            : 'Effects kick in shortly. A Crisis Manager at any hub halves the impact.'}
        </p>
        <button onClick={onDismiss} style={{ ...btn, background: accent }}>Got it</button>
      </div>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.55)',
  backdropFilter: 'blur(2px)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 50,
  padding: 16,
};
const card: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: 360,
  background: 'linear-gradient(160deg, #182142, #0C1428)',
  borderRadius: 16,
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
  border: '1px solid rgba(255,255,255,0.06)',
};
const accentBar: React.CSSProperties = {
  height: 4,
};
const inner: React.CSSProperties = { padding: '20px 22px 22px' };
const kicker = (color: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color,
  fontWeight: 700,
});
const regionPill: React.CSSProperties = {
  fontSize: 9,
  color: '#94A3B8',
  background: 'rgba(255,255,255,0.06)',
  padding: '2px 8px',
  borderRadius: 4,
};
const title = (color: string): React.CSSProperties => ({
  margin: '8px 0 6px',
  fontSize: 24,
  fontWeight: 700,
  color: '#F8FAFC',
  textShadow: `0 0 24px ${color}40`,
});
const desc: React.CSSProperties = {
  margin: 0,
  color: '#F8FAFC',
  fontSize: 14,
  lineHeight: 1.5,
};
const smallNote: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 18,
  color: '#94A3B8',
  fontSize: 11,
  lineHeight: 1.5,
};
const btn: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: 0,
  color: '#0B1120',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  minHeight: 44,
};
