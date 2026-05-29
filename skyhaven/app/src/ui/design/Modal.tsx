/**
 * Modal primitive (Design pass D1).
 *
 * Composes the standard backdrop + sheet + close button + escape
 * handling so every popup in the game has identical motion + dismiss
 * behaviour. Replaces ~6 ad-hoc modals scattered through the codebase.
 *
 * Motion: backdrop fades in over `motion.short`; sheet springs in from
 * 12px below with a subtle scale, both honouring prefers-reduced-
 * motion via Framer Motion's transition shortcut.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { COLOR, MOTION, RADIUS, SHADOW, SPACE, Z } from './tokens';

export interface ModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Triggered on backdrop tap, escape key, or close-button. */
  onClose: () => void;
  /** Modal contents. Should be self-contained — no margins. */
  children: ReactNode;
  /** Max width override (defaults to 420). */
  maxWidth?: number;
  /** Accent border color (defaults to cyan). */
  accent?: string;
  /** Optional id for the close-button aria-label. */
  ariaLabel?: string;
  /** If false the modal can't be dismissed by tapping outside. */
  dismissOnBackdrop?: boolean;
}

export function Modal({
  open,
  onClose,
  children,
  maxWidth = 420,
  accent = COLOR.accent.cyan,
  ariaLabel = 'Close',
  dismissOnBackdrop = true,
}: ModalProps) {
  // Escape to close (only while the modal is mounted).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Render to document.body so the modal escapes any panel /
  // stacking context that would otherwise trap its z-index. Without
  // this the panel host (z:20) sits below the top bar (z:30), so
  // even with modal z:100 the close button vanished behind TopBar.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.duration.short / 1000, ease: 'easeOut' }}
          style={backdrop as Record<string, unknown>}
          onClick={(e): void => {
            if (!dismissOnBackdrop) return;
            // Only fire when the actual backdrop is tapped, not bubble-up.
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            key="modal-sheet"
            initial={{ y: 16, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            style={{
              ...sheet,
              maxWidth,
              border: `1px solid ${accent}45`,
              boxShadow: `${SHADOW.modal}, 0 0 36px ${accent}28`,
            } as Record<string, unknown>}
            onClick={(e): void => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              aria-label={ariaLabel}
              style={closeBtn}
              type="button"
            >
              ×
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* Backdrop starts BELOW the top bar (var(--world-top)) so the
   close button on the modal sheet sits in reachable space and
   the player can still see / use the cash + CEO chrome above. */
const backdrop: React.CSSProperties = {
  position: 'fixed',
  top: 'var(--world-top)',
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(6px)',
  display: 'grid',
  placeItems: 'start center',
  padding: `${SPACE.m}px ${SPACE.l}px ${SPACE.l}px`,
  zIndex: Z.modal,
};

const sheet: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  background: `linear-gradient(170deg, ${COLOR.bg.panel}, ${COLOR.bg.canvas})`,
  borderRadius: RADIUS.l,
  padding: 0,
  overflow: 'hidden',
  // Fit inside the (viewport − top bar) area the backdrop occupies.
  maxHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
};

const closeBtn: React.CSSProperties = {
  position: 'absolute',
  top: SPACE.s,
  right: SPACE.s,
  width: 36,
  height: 36,
  borderRadius: RADIUS.pill,
  background: 'rgba(11,17,32,0.6)',
  color: COLOR.ink.muted,
  border: `1px solid ${COLOR.border.soft}`,
  fontSize: 24,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1,
  fontFamily: 'inherit',
};
