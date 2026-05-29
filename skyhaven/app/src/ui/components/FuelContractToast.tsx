/**
 * FuelContractToast.
 *
 * Pops a fuel-contract-style document over the screen the moment a
 * new contract is signed (`fuel.contracts` grows by one). Stays on
 * screen ~3.6s with a spring entrance, an authorising stamp landing
 * after ~600ms, and a confetti burst on the gold counter-signature.
 *
 * Designed as a celebration moment — the player should feel they
 * just signed a real piece of paper, not flipped a database flag.
 *
 * Filtered: the free starter contract (`fc.starter`) is granted as
 * part of `initialState`, so it's already in `fuel.contracts` on
 * first mount; the toast snapshots the initial set and only fires
 * for contracts added *after* that snapshot.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { getFuelContract } from '../../data/fuelContracts';
import { selectTailColor, useGameStore } from '../../state/store';
import { ConfettiBurst } from '../design/ConfettiBurst';
import { COLOR, RADIUS } from '../design/tokens';
import { formatCash } from '../format';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';

interface SignedContract {
  id: string;
  name: string;
  supplyRatePerSec: number;
  cost: number;
}

const VISIBLE_MS = 3600;

export function FuelContractToast() {
  const contracts = useGameStore((s) => s.state?.fuel.contracts);
  const tailColor = useGameStore(selectTailColor);
  const known = useRef<Set<string> | null>(null);
  const [pending, setPending] = useState<SignedContract | null>(null);
  const [stamped, setStamped] = useState(false);

  // Detect newly-added contracts.
  useEffect(() => {
    if (!contracts) return;
    // First observation: snapshot what's already there (starter
    // contract from initialState, plus anything from a cloud save).
    if (known.current === null) {
      known.current = new Set(contracts);
      return;
    }
    const fresh = contracts.find((id) => !known.current!.has(id));
    if (!fresh) return;
    known.current = new Set(contracts);
    const def = getFuelContract(fresh);
    if (!def) return;
    setPending({
      id: def.id,
      name: def.name,
      supplyRatePerSec: def.supplyRatePerSec,
      cost: def.cost,
    });
    setStamped(false);
    haptics.medium();
    sfx.play('fuel_contract_sign');
  }, [contracts]);

  // Stamp + auto-dismiss timeline.
  useEffect(() => {
    if (!pending) return;
    const stampId = window.setTimeout(() => {
      setStamped(true);
      haptics.success();
      sfx.play('fuel_contract_stamp');
    }, 600);
    const closeId = window.setTimeout(() => {
      setPending(null);
    }, VISIBLE_MS);
    return () => {
      window.clearTimeout(stampId);
      window.clearTimeout(closeId);
    };
  }, [pending]);

  const dismiss = (): void => {
    haptics.light();
    sfx.tick();
    setPending(null);
  };

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          key="fuel-contract-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={backdrop as Record<string, unknown>}
          onClick={dismiss}
        >
          <motion.div
            key="fuel-contract-card"
            initial={{ y: 28, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            style={card(tailColor) as Record<string, unknown>}
            onClick={(e): void => e.stopPropagation()}
          >
            <div style={perforation} aria-hidden />
            <div style={kicker(tailColor)}>FUEL SUPPLY CONTRACT</div>
            <div style={titleText}>{pending.name}</div>
            <div style={dashed} />

            <div style={grid}>
              <Cell label="DAILY SUPPLY" value={`+${pending.supplyRatePerSec.toLocaleString()} fuel / s`} />
              <Cell
                label="CONTRACT FEE"
                value={pending.cost === 0 ? 'Complimentary' : `$${formatCash(pending.cost, 1)}`}
                accent={COLOR.gold.base}
              />
              <Cell label="TERM" value="Perpetual" />
              <Cell label="EFFECT" value="Lifts route-open gate" accent={COLOR.success} />
            </div>

            <div style={dashed} />

            <div style={{ position: 'relative', minHeight: 64 }}>
              <div style={footer}>
                <div style={footerKicker}>COUNTERSIGNED BY</div>
                <div style={footerValue}>SkyHaven Procurement</div>
              </div>

              <AnimatePresence>
                {stamped && (
                  <motion.div
                    key="stamp"
                    initial={{ scale: 1.7, opacity: 0, rotate: -22 }}
                    animate={{ scale: 1, opacity: 0.96, rotate: -10 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                    style={stamp(tailColor) as Record<string, unknown>}
                  >
                    <div style={stampLine1}>CONTRACT</div>
                    <div style={stampLine2}>EXECUTED</div>
                    <div style={stampLine3}>{new Date().toISOString().slice(0, 10)}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div style={perforation} aria-hidden />

            <button onClick={dismiss} style={dismissBtn(tailColor)}>
              Acknowledge ✓
            </button>

            {stamped && (
              <ConfettiBurst
                seed={pending.id.length * 41}
                count={36}
                palette={[tailColor, COLOR.gold.base, COLOR.gold.light, '#FFFFFF']}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={cellBox}>
      <div style={cellLabel}>{label}</div>
      <div style={{ ...cellValue, color: accent ?? '#0B1120' }}>{value}</div>
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(4px)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 95,
  padding: 16,
};

const card = (accent: string): React.CSSProperties => ({
  position: 'relative',
  width: '100%',
  maxWidth: 380,
  background: 'linear-gradient(170deg, #EFF4FB, #D5DEEF)',
  borderRadius: 18,
  border: `2px solid ${accent}66`,
  padding: '12px 16px 14px',
  boxShadow: `0 30px 60px rgba(0,0,0,0.6), 0 0 56px ${accent}40`,
  color: '#0B1120',
  overflow: 'hidden',
});

const perforation: React.CSSProperties = {
  height: 8,
  background: 'radial-gradient(circle at 4px 4px, rgba(11,17,32,0.3) 1.6px, transparent 2.4px) 0 0 / 12px 8px',
  margin: '-4px -16px 0',
};

const kicker = (accent: string): React.CSSProperties => ({
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.26em',
  color: accent,
  marginTop: 6,
});

const titleText: React.CSSProperties = {
  fontSize: 19,
  fontWeight: 900,
  letterSpacing: '0.03em',
  color: '#0B1120',
  marginTop: 2,
};

const dashed: React.CSSProperties = {
  height: 1,
  background: 'repeating-linear-gradient(90deg, rgba(11,17,32,0.28) 0, rgba(11,17,32,0.28) 4px, transparent 4px, transparent 8px)',
  margin: '10px 0',
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};

const cellBox: React.CSSProperties = {
  background: 'rgba(11,17,32,0.06)',
  borderRadius: 6,
  padding: '6px 8px',
};

const cellLabel: React.CSSProperties = {
  fontSize: 8,
  letterSpacing: '0.18em',
  fontWeight: 800,
  color: '#475569',
  textTransform: 'uppercase',
};

const cellValue: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  marginTop: 1,
  letterSpacing: '0.02em',
  fontFeatureSettings: '"tnum" 1',
};

const footer: React.CSSProperties = {
  paddingTop: 2,
};

const footerKicker: React.CSSProperties = {
  fontSize: 8,
  letterSpacing: '0.2em',
  fontWeight: 800,
  color: '#475569',
};

const footerValue: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  fontStyle: 'italic',
  color: '#0B1120',
  marginTop: 2,
};

const stamp = (accent: string): React.CSSProperties => ({
  position: 'absolute',
  top: -4,
  right: 4,
  border: `3px solid ${accent}`,
  color: accent,
  background: `${accent}10`,
  padding: '6px 12px',
  borderRadius: 8,
  textAlign: 'center',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
});

const stampLine1: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.22em',
};

const stampLine2: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: '0.16em',
  marginTop: 2,
};

const stampLine3: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.14em',
  marginTop: 3,
  opacity: 0.85,
};

const dismissBtn = (accent: string): React.CSSProperties => ({
  marginTop: 12,
  width: '100%',
  padding: '10px 12px',
  background: accent,
  color: '#0B1120',
  border: 0,
  borderRadius: RADIUS.m,
  fontWeight: 800,
  fontSize: 13,
  letterSpacing: '0.08em',
  cursor: 'pointer',
  fontFamily: 'inherit',
});
