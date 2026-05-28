/**
 * AircraftDeliveryRitual — Design Review v3, point 12.
 *
 * Buying an aircraft must feel like receiving a new asset, not paying
 * an invoice. Three beats:
 *
 *   1. Contract Signed — a stamp lands on the spec sheet.
 *   2. Hangar Reveal — the aircraft illustration slides in from the
 *      left into a tilted hangar frame, lights tick on row by row.
 *   3. Assign vs Park — two choices. Assign Now (focuses the player on
 *      route creation) or Park in Hangar (lets them keep shopping).
 *
 * Subscribes to `uiStore.pendingDelivery`; when set, plays the ritual;
 * on close, clears the entry.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { getAircraftDef } from '../../data/aircraft';
import { selectTailColor, useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../design/Button';
import { AircraftIllustration } from '../design/SvgAircraft';
import { COLOR, RADIUS, SHADOW, SPACE } from '../design/tokens';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';
import { usePanelStore } from './PanelHost';

const BEAT_2_MS = 950;
const BEAT_3_MS = 2200;

export function AircraftDeliveryRitual() {
  const pending = useUiStore((s) => s.pendingDelivery);
  const clear = useUiStore((s) => s.setPendingDelivery);
  const tailColor = useGameStore(selectTailColor);
  const open = usePanelStore((s) => s.open);

  const [beat, setBeat] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (!pending) return;
    setBeat(1);
    haptics.medium();
    sfx.confirm();
    const t1 = window.setTimeout(() => { setBeat(2); haptics.light(); }, BEAT_2_MS);
    const t2 = window.setTimeout(() => { setBeat(3); haptics.success(); }, BEAT_3_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pending]);

  if (!pending) return null;
  const def = getAircraftDef(pending.defId);
  if (!def) { clear(null); return null; }

  const isCargo = def.category === 'cargo';
  const close = (): void => { clear(null); };
  const assignNow = (): void => {
    haptics.heavy();
    clear(null);
    open('routes');
  };
  const parkInHangar = (): void => {
    haptics.light();
    clear(null);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="aircraft-ritual"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={shell as Record<string, unknown>}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          style={card(tailColor) as Record<string, unknown>}
        >
          {/* Beat 1 — Contract */}
          <div style={kicker(tailColor)}>
             AIRCRAFT DELIVERY  ·  CONTRACT {beat >= 2 ? 'SIGNED' : '…'}
          </div>

          {/* Stamp */}
          <AnimatePresence>
            {beat >= 1 && (
              <motion.div
                key="stamp"
                initial={{ rotate: -25, scale: 1.6, opacity: 0 }}
                animate={{ rotate: -12, scale: 1, opacity: beat >= 2 ? 0.7 : 0.4 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                style={stamp as Record<string, unknown>}
              >
                CONTRACT SIGNED
              </motion.div>
            )}
          </AnimatePresence>

          {/* Aircraft headline */}
          <div style={nameRow}>
            <div>
              <div style={subline}>{isCargo ? 'FREIGHTER' : `TIER ${def.tier}`}  ·  {def.displayName}</div>
              <div style={priceLine}>${formatCash(def.basePurchaseCost, 1)}  ·  {def.capacity}{isCargo ? ' t' : ' seats'}</div>
            </div>
          </div>

          {/* Hangar reveal — beat 2+ */}
          <div style={hangar}>
            <div style={hangarRoof(tailColor)} />
            <div style={hangarLightsRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{
                    ...hangarLight,
                    background: beat >= 2 ? tailColor : 'rgba(148,163,184,0.2)',
                    boxShadow: beat >= 2 ? `0 0 6px ${tailColor}` : 'none',
                    transition: `background 240ms ease ${i * 70}ms, box-shadow 240ms ease ${i * 70}ms`,
                  }}
                />
              ))}
            </div>
            <AnimatePresence>
              {beat >= 2 && (
                <motion.div
                  key="aircraft"
                  initial={{ x: -120, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                  style={aircraftWrap as Record<string, unknown>}
                >
                  <AircraftIllustration defId={def.id} tailColor={tailColor} width={240} />
                </motion.div>
              )}
            </AnimatePresence>
            <div style={hangarFloor} />
          </div>

          {/* Delivery copy */}
          <div style={deliveryNote}>
            {isCargo
              ? `${def.displayName} delivered. Best used on long-haul cargo lanes.`
              : roleHintFor(def.tier)}
          </div>

          {/* Beat 3 — Assign or Park */}
          {beat >= 3 ? (
            <div style={buttonsRow}>
              <Button variant="ghost" size="md" fullWidth onClick={parkInHangar}>
                Park in Hangar
              </Button>
              <Button variant="gold" size="md" fullWidth onClick={assignNow} hapticOnPress="heavy">
                Assign Now →
              </Button>
            </div>
          ) : (
            <div style={loadingRow}>
              <span style={loadingDot(tailColor)} />
              <span>{beat === 1 ? 'Stamping contract…' : 'Towing into hangar…'}</span>
            </div>
          )}

          <button onClick={close} style={closeBtn} aria-label="Close delivery">✕</button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function roleHintFor(tier: number): string {
  switch (tier) {
    case 1: return 'Delivered to your hangar. Best used on short regional routes.';
    case 2: return 'Delivered to your hangar. Pairs well with city-pair connectors.';
    case 3: return 'Delivered to your hangar. A versatile narrow-body workhorse.';
    case 4: return 'Delivered to your hangar. Strong cash-per-flight on medium-haul.';
    case 5: return 'Delivered to your hangar. A wide-body that earns at scale.';
    case 6: return 'Delivered to your hangar. Built for long-haul empire routes.';
    case 7: return 'Delivered to your hangar. Heavy flagship — capacity at premium yield.';
    case 8: return 'Delivered to your hangar. Mega-flagship — runway-gated to top hubs.';
    default: return 'Delivered to your hangar. Ready to assign.';
  }
}

// ─── Styles ──────────────────────────────────────────────────────────
const shell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: SPACE.l,
  background: 'radial-gradient(circle at 50% 40%, rgba(11,17,32,0.55), rgba(7,10,24,0.92))',
  backdropFilter: 'blur(6px)',
  zIndex: 110,
};
const card = (tail: string): React.CSSProperties => ({
  position: 'relative',
  width: '100%',
  maxWidth: 420,
  background: 'linear-gradient(170deg, #14213D, #0B1426)',
  borderRadius: 20,
  border: `2px solid ${tail}66`,
  boxShadow: `${SHADOW.modal}, 0 0 48px ${tail}44`,
  padding: '18px 18px 16px',
  overflow: 'hidden',
});
const kicker = (tail: string): React.CSSProperties => ({
  fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
  color: tail,
  marginBottom: 6,
});
const stamp: React.CSSProperties = {
  position: 'absolute',
  top: 56, right: 14,
  fontSize: 11,
  fontWeight: 900,
  color: COLOR.success,
  border: `2px solid ${COLOR.success}`,
  padding: '4px 10px',
  borderRadius: 6,
  letterSpacing: '0.16em',
  background: 'rgba(52,211,153,0.06)',
  pointerEvents: 'none',
  transformOrigin: 'center',
};
const nameRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
  marginBottom: 8,
};
const subline: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: '0.14em',
  color: COLOR.ink.muted,
};
const priceLine: React.CSSProperties = {
  fontSize: 16, fontWeight: 800, color: COLOR.ink.primary,
  marginTop: 4, fontFeatureSettings: '"tnum" 1',
};
const hangar: React.CSSProperties = {
  position: 'relative',
  height: 130,
  borderRadius: RADIUS.m,
  background: 'linear-gradient(180deg, #0B1426 0%, #050912 100%)',
  border: '1px solid rgba(148,163,184,0.18)',
  overflow: 'hidden',
  marginTop: 6,
};
const hangarRoof = (tail: string): React.CSSProperties => ({
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: 14,
  background: `linear-gradient(90deg, transparent, ${tail}1f, transparent)`,
  borderBottom: `1px solid ${tail}33`,
});
const hangarLightsRow: React.CSSProperties = {
  position: 'absolute',
  top: 18, left: 12, right: 12,
  display: 'flex',
  justifyContent: 'space-between',
};
const hangarLight: React.CSSProperties = {
  width: 8, height: 8, borderRadius: 999,
};
const aircraftWrap: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 22,
  transform: 'translateX(-50%)',
};
const hangarFloor: React.CSSProperties = {
  position: 'absolute',
  bottom: 0, left: 0, right: 0,
  height: 14,
  background: 'linear-gradient(180deg, rgba(148,163,184,0.05), rgba(148,163,184,0.15))',
  borderTop: '1px solid rgba(148,163,184,0.18)',
};
const deliveryNote: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: COLOR.ink.secondary,
  lineHeight: 1.45,
};
const loadingRow: React.CSSProperties = {
  marginTop: 12,
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 11,
  color: COLOR.ink.muted,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontWeight: 700,
};
const loadingDot = (tail: string): React.CSSProperties => ({
  width: 8, height: 8, borderRadius: 999,
  background: tail,
  boxShadow: `0 0 6px ${tail}`,
  animation: 'breathe 1.2s ease-in-out infinite',
});
const buttonsRow: React.CSSProperties = {
  marginTop: 12,
  display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8,
};
const closeBtn: React.CSSProperties = {
  position: 'absolute',
  top: 10, right: 12,
  width: 26, height: 26,
  background: 'rgba(11,17,32,0.5)',
  border: '1px solid rgba(148,163,184,0.3)',
  color: COLOR.ink.muted,
  borderRadius: 999,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
};
