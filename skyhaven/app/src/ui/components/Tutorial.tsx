import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  selectTailColor,
  selectTutorialCompleted,
  selectTutorialStep,
  useGameStore,
} from '../../state/store';
import type { SaveState } from '../../engine/types';

/**
 * Playable tutorial (BRD §5.2).
 *
 * Interactive walkthrough — each step either takes a quick player
 * input (rename) or watches the real game state for the player to
 * perform the action (sign a contract, buy a plane, open a route).
 * A glowing spotlight ring sits over the target UI element; a
 * tooltip card near it explains what to do. Auto-advances when the
 * state check passes.
 *
 * No skip link in release builds (BRD §5.2 + locked decision). The
 * tutorial is failure-proof: the player can navigate freely; the
 * tutorial just waits.
 */

type Step =
  | { kind: 'info'; title: string; body: string; cta: string }
  | { kind: 'identity'; title: string; body: string }
  | { kind: 'wait-state'; title: string; body: string; target: string; check: (s: SaveState) => boolean }
  | { kind: 'wait-time'; title: string; body: string; durationMs: number };

const STEPS: readonly Step[] = [
  {
    kind: 'info',
    title: 'Welcome to SkyHaven Tycoon',
    body: "Build an airline that owns the sky. Let's set you up — we'll do everything together.",
    cta: 'Begin',
  },
  {
    kind: 'identity',
    title: 'Name your airline',
    body: 'Pick a name and a tail colour. Your two-letter code follows automatically.',
  },
  {
    kind: 'wait-state',
    title: 'Secure more fuel',
    body: 'Tap the fuel gauge on the right edge, then sign the Local Refinery contract. More supply lets you fly more planes.',
    target: 'fuel-gauge',
    check: (s) => s.fuel.contracts.length >= 2,
  },
  {
    kind: 'wait-state',
    title: 'Buy a second aircraft',
    body: 'Open the Fleet tab → "Buy aircraft" → grab any T1. We need more wings to grow.',
    target: 'fleet-tab',
    check: (s) => s.fleet.length >= 2,
  },
  {
    kind: 'wait-state',
    title: 'Open a new route',
    body: 'Open the Routes tab → "+ New route". Pick an origin and destination — the new aircraft will start earning.',
    target: 'routes-tab',
    check: (s) => s.routes.length >= 2,
  },
  {
    kind: 'wait-time',
    title: 'Watch it earn',
    body: 'Your second route is flying. Cash counts up automatically — no taps needed.',
    durationMs: 6_000,
  },
  {
    kind: 'info',
    title: "You're ready",
    body: 'An objective card will guide your next steps. Hubs, regions, managers, classics — the skies are yours.',
    cta: "Let's go",
  },
];

export function Tutorial() {
  const completed = useGameStore(selectTutorialCompleted);
  const step = useGameStore(selectTutorialStep);
  const tailColor = useGameStore(selectTailColor);
  const airlineName = useGameStore((s) => s.state?.airlineName ?? '');
  const state = useGameStore((s) => s.state);
  const advance = useGameStore((s) => s.advanceTutorial);
  const complete = useGameStore((s) => s.completeTutorial);
  const setIdentity = useGameStore((s) => s.setAirlineIdentity);

  const current = step < STEPS.length ? STEPS[step]! : null;

  // Auto-advance when a wait-state's check passes.
  useEffect(() => {
    if (!current || current.kind !== 'wait-state' || !state) return;
    if (current.check(state)) advance();
  }, [current, state, advance]);

  // Auto-advance wait-time steps after their duration.
  useEffect(() => {
    if (!current || current.kind !== 'wait-time') return;
    const id = setTimeout(() => advance(), current.durationMs);
    return () => clearTimeout(id);
  }, [current, advance]);

  // Once the player has walked past the last step, finalise the tutorial.
  useEffect(() => {
    if (!completed && step >= STEPS.length) complete();
  }, [completed, step, complete]);

  if (completed) return null;
  if (!current) return null;

  const isSpotlight = current.kind === 'wait-state';

  return (
    <>
      {isSpotlight && <Spotlight target={(current as { target: string }).target} />}
      <TutorialCard
        step={step}
        total={STEPS.length}
        current={current}
        tailColor={tailColor}
        airlineName={airlineName}
        onAdvance={advance}
        onSetIdentity={(name, color): void => { setIdentity(name, color); advance(); }}
      />
    </>
  );
}

// ─── Spotlight ring + soft dim ───────────────────────────────────────
function Spotlight({ target }: { target: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let cancelled = false;
    const measure = (): void => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tutorial="${target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    // Poll for lazy-loaded elements (e.g. inside lazy-imported panels).
    const id = setInterval(measure, 300);
    window.addEventListener('resize', measure);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('resize', measure);
    };
  }, [target]);

  if (!rect) return null;
  const padding = 8;

  return (
    <motion.div
      key={target}
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        scale: [1, 1.06, 1],
      }}
      transition={{
        opacity: { duration: 0.2 },
        scale: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
      }}
      style={{
        position: 'fixed',
        left: rect.left - padding,
        top: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: 14,
        border: '2px solid #5AC8FA',
        boxShadow:
          '0 0 0 9999px rgba(0,0,0,0.55), 0 0 32px rgba(90,200,250,0.65), inset 0 0 18px rgba(90,200,250,0.18)',
        pointerEvents: 'none',
        zIndex: 60,
      }}
    />
  );
}

// ─── The card that floats over the UI ────────────────────────────────
function TutorialCard({
  step,
  total,
  current,
  tailColor,
  airlineName,
  onAdvance,
  onSetIdentity,
}: {
  step: number;
  total: number;
  current: Step;
  tailColor: string;
  airlineName: string;
  onAdvance: () => void;
  onSetIdentity: (name: string, color: string) => void;
}) {
  // For spotlight steps the card sits near the *top* so it doesn't
  // obscure the bottom-tab buttons / fuel gauge spotlight.
  const placement = current.kind === 'wait-state' ? 'top' : 'center';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`step-${step}`}
        initial={{ y: placement === 'top' ? -20 : 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: placement === 'top' ? -20 : 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        style={(placement === 'center' ? shellCenter : shellTop) as Record<string, unknown>}
      >
        <div style={card}>
          <div style={kicker}>
            <span>Step {step + 1} of {total}</span>
            {current.kind === 'wait-state' && (
              <span style={waitDot}>● waiting for you</span>
            )}
            {current.kind === 'wait-time' && (
              <span style={waitDotNeutral}>● auto-advance</span>
            )}
          </div>
          <h2 style={title}>{current.title}</h2>
          <p style={body}>{current.body}</p>

          {current.kind === 'identity' && (
            <IdentityFields
              initialName={airlineName}
              initialColor={tailColor}
              onSubmit={onSetIdentity}
            />
          )}

          {current.kind === 'info' && (
            <button style={{ ...primaryBtn, background: tailColor }} onClick={onAdvance}>
              {current.cta}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function IdentityFields({
  initialName, initialColor, onSubmit,
}: {
  initialName: string;
  initialColor: string;
  onSubmit: (name: string, color: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const colors = ['#5AC8FA', '#F4C75B', '#8B5CF6', '#F87171', '#34D399', '#FFFFFF'];
  return (
    <div>
      <label style={fieldLabel}>Airline name</label>
      <input
        value={name}
        onChange={(e): void => setName(e.target.value.slice(0, 20))}
        style={input}
        maxLength={20}
        placeholder="SkyHaven Airlines"
      />
      <label style={fieldLabel}>Tail colour</label>
      <div style={swatchRow}>
        {colors.map((c) => (
          <button
            key={c}
            onClick={(): void => setColor(c)}
            style={{
              ...swatch,
              background: c,
              outline: color === c ? '2px solid rgba(255,255,255,0.85)' : 'none',
              outlineOffset: 2,
            }}
            aria-label={`Choose ${c}`}
          />
        ))}
      </div>
      <button
        style={{ ...primaryBtn, background: color, marginTop: 14 }}
        onClick={(): void => onSubmit(name.trim() || 'SkyHaven Airlines', color)}
      >
        Continue
      </button>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const shellCenter: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  zIndex: 62,
  pointerEvents: 'none',
};
const shellTop: React.CSSProperties = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + 90px)',
  left: 12,
  right: 12,
  zIndex: 62,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
};
const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 380,
  background: 'linear-gradient(160deg, #1A2244, #0B1120)',
  borderRadius: 16,
  padding: '18px 20px 20px',
  border: '1px solid rgba(90,200,250,0.35)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 30px rgba(90,200,250,0.18)',
  pointerEvents: 'auto',
};
const kicker: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
  color: '#94A3B8',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};
const waitDot: React.CSSProperties = {
  fontSize: 9,
  color: '#5AC8FA',
  letterSpacing: '0.08em',
  textTransform: 'none',
};
const waitDotNeutral: React.CSSProperties = {
  fontSize: 9,
  color: '#94A3B8',
  letterSpacing: '0.08em',
  textTransform: 'none',
};
const title: React.CSSProperties = {
  margin: '6px 0 8px',
  fontSize: 20,
  color: '#F8FAFC',
  fontWeight: 700,
};
const body: React.CSSProperties = {
  margin: '0 0 14px',
  color: '#F8FAFC',
  fontSize: 13,
  lineHeight: 1.55,
};
const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: 0,
  color: '#0B1120',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  minHeight: 44,
};
const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#94A3B8',
  marginTop: 12,
  marginBottom: 4,
};
const input: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#F8FAFC',
  padding: '10px',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  minHeight: 44,
};
const swatchRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 4,
};
const swatch: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: 0,
  cursor: 'pointer',
};
