import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { getClassicDef } from '../../data/classics';
import { selectPendingVintageDrop, selectVintage, useGameStore } from '../../state/store';
import { sfx } from '../juice/sfx';

/**
 * Vintage drop reveal (BRD §4.9 "juicy reveal moment").
 *
 * Whenever the tick drops a new classic into the player's hangar, it
 * sets `state.pendingVintageDrop`. This component shows a centered
 * card; tapping "Add to Hangar" or the backdrop acknowledges the
 * drop (clears the field).
 */
export function VintageDropPopup() {
  const id = useGameStore(selectPendingVintageDrop);
  const vintage = useGameStore(selectVintage);
  const ack = useGameStore((s) => s.acknowledgeVintageDrop);
  const def = id ? getClassicDef(id) : null;

  // Distinctive "rarity" cue when a classic is revealed.
  const sounded = useRef<string | null>(null);
  useEffect(() => {
    if (id && sounded.current !== id) { sfx.play('vintage_award'); sounded.current = id; }
    if (!id) sounded.current = null;
  }, [id]);

  return (
    <AnimatePresence>
      {id && def && (
        <motion.div
          key="vintage-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={backdrop as Record<string, unknown>}
          onClick={(): void => { ack(); }}
        >
          <motion.div
            key={id}
            initial={{ scale: 0.7, y: 30, opacity: 0, rotate: -3 }}
            animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
            onClick={(e): void => e.stopPropagation()}
            style={card as Record<string, unknown>}
          >
            <div style={accentBar} />
            <div style={inner}>
              <div style={kicker}>Vintage Drop</div>
              <div style={year}>{def.year}</div>
              <h2 style={name}>{def.displayName}</h2>
              <div style={tagline}>{def.tagline}</div>
              <p style={bio}>{def.bio}</p>
              <div style={bonusRow}>
                <span style={bonusLabel}>Permanent bonus</span>
                <span style={bonusValue}>+1% global yield</span>
              </div>
              <div style={progressRow}>
                {vintage.length} of 12 collected
              </div>
              <button onClick={(): void => { ack(); }} style={btn}>
                Add to Hangar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.65)',
  backdropFilter: 'blur(3px)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 55,
  padding: 16,
};
const card: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: 360,
  background: 'linear-gradient(160deg, #2A1F0E, #0C1428)',
  borderRadius: 18,
  overflow: 'hidden',
  boxShadow: '0 24px 70px rgba(0,0,0,0.6), 0 0 60px rgba(244,199,91,0.20)',
  border: '1px solid rgba(244,199,91,0.4)',
};
const accentBar: React.CSSProperties = {
  height: 5,
  background: 'linear-gradient(90deg, #F4C75B, #FCE9A5, #F4C75B)',
};
const inner: React.CSSProperties = { padding: '22px 22px 20px' };
const kicker: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: '#F4C75B',
  fontWeight: 700,
};
const year: React.CSSProperties = {
  fontSize: 11,
  color: '#94A3B8',
  marginTop: 8,
  letterSpacing: '0.12em',
};
const name: React.CSSProperties = {
  margin: '4px 0 4px',
  fontSize: 26,
  fontWeight: 800,
  color: '#F8FAFC',
  textShadow: '0 0 24px rgba(244,199,91,0.45)',
};
const tagline: React.CSSProperties = {
  fontSize: 12,
  color: '#F4C75B',
  fontWeight: 600,
};
const bio: React.CSSProperties = {
  margin: '12px 0 16px',
  fontSize: 13,
  color: '#F8FAFC',
  lineHeight: 1.55,
};
const bonusRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '10px 12px',
  background: 'rgba(244,199,91,0.10)',
  borderRadius: 8,
  border: '1px solid rgba(244,199,91,0.25)',
  marginBottom: 6,
};
const bonusLabel: React.CSSProperties = {
  fontSize: 11,
  color: '#94A3B8',
  letterSpacing: '0.06em',
};
const bonusValue: React.CSSProperties = {
  fontSize: 12,
  color: '#F4C75B',
  fontWeight: 700,
};
const progressRow: React.CSSProperties = {
  fontSize: 11,
  color: '#94A3B8',
  textAlign: 'center',
  margin: '10px 0 14px',
};
const btn: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: 0,
  background: '#F4C75B',
  color: '#0B1120',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  minHeight: 44,
};
