/**
 * Share Airline modal (Design pass D10).
 *
 * Wraps the ShareableAirlineCard in the design-system Modal so the
 * player can preview it before screenshotting. The card itself is a
 * pure render — no async I/O — so the modal opens instantly.
 */
import { Modal } from '../design/Modal';
import { SPACE } from '../design/tokens';
import { ShareableAirlineCard } from './ShareableAirlineCard';

export function ShareAirlineModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} maxWidth={400} ariaLabel="Close share dialog">
      <div style={{ padding: SPACE.m, display: 'grid', placeItems: 'center' }}>
        <ShareableAirlineCard />
        <p style={hint}>
          Screenshot this card and post it. Long-press to save the card image
          on most phones.
        </p>
      </div>
    </Modal>
  );
}

const hint: React.CSSProperties = {
  margin: `${SPACE.m}px 0 0`,
  fontSize: 11,
  color: '#94A3B8',
  textAlign: 'center',
  lineHeight: 1.5,
};
