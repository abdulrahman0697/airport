import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { selectTailColor, selectTutorial, useGameStore } from '../../state/store';

/**
 * Playable tutorial (BRD §5.2).
 *
 * Phase 9 ships an info-card sequence with one interactive step
 * (name + tail color). Each card overlays the live UI so the player
 * sees the map underneath while they're learning. Cards advance on
 * tap; no skip link in release builds (BRD §5.2 + locked decision).
 *
 * Beats:
 *   0. Welcome
 *   1. Identity — rename + tail color (interactive)
 *   2. Map orientation
 *   3. The fleet
 *   4. The first route
 *   5. Tabs orientation
 *   6. Handoff
 */
type StepShape =
  | { kind: 'info'; title: string; body: string; cta: string }
  | { kind: 'identity'; title: string; body: string };

const STEPS: readonly StepShape[] = [
  {
    kind: 'info',
    title: 'Welcome to SkyHaven Tycoon',
    body: 'Build an airline that owns the sky. Routes earn around the clock — your job is the decisions.',
    cta: 'Begin',
  },
  {
    kind: 'identity',
    title: 'Name your airline',
    body: 'Pick a name and a tail colour. Your two-letter code follows automatically.',
  },
  {
    kind: 'info',
    title: 'The world map',
    body: 'Pan and pinch to explore. Every bright pin is an airport you can fly. Coloured arcs show your active routes.',
    cta: 'Got it',
  },
  {
    kind: 'info',
    title: 'Your first plane',
    body: 'A regional turboprop is parked at your home airport, ready to fly. Open Fleet to see it and buy more.',
    cta: 'Got it',
  },
  {
    kind: 'info',
    title: 'Your first route',
    body: 'A short route is already drawn for you. Watch the cash counter — every leg credits revenue. No tap needed.',
    cta: 'Got it',
  },
  {
    kind: 'info',
    title: 'Five tabs, four levers',
    body: 'Routes opens new lanes. Fleet buys aircraft + upgrades. Crew hires managers per hub. Use the fuel gauge on the right to manage supply.',
    cta: 'Got it',
  },
  {
    kind: 'info',
    title: 'Onwards',
    body: 'An objective card will guide you through the next steps. The skies are yours.',
    cta: "Let's go",
  },
];

export function Tutorial() {
  const { completed, step } = useGameStore(selectTutorial);
  const tailColor = useGameStore(selectTailColor);
  const airlineName = useGameStore((s) => s.state?.airlineName ?? '');
  const advance = useGameStore((s) => s.advanceTutorial);
  const complete = useGameStore((s) => s.completeTutorial);
  const setIdentity = useGameStore((s) => s.setAirlineIdentity);

  if (completed) return null;

  const current = STEPS[step] ?? STEPS[STEPS.length - 1]!;
  const isLast = step >= STEPS.length - 1;

  const next = (): void => {
    if (isLast) {
      complete();
    } else {
      advance();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="tutorial-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={backdrop as Record<string, unknown>}
      >
        <motion.div
          key={`step-${step}`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          style={card as Record<string, unknown>}
        >
          <div style={kicker}>Step {step + 1} of {STEPS.length}</div>
          <h2 style={title}>{current.title}</h2>
          <p style={body}>{current.body}</p>

          {current.kind === 'identity' ? (
            <IdentityFields
              initialName={airlineName}
              initialColor={tailColor}
              onSubmit={(n, c): void => {
                setIdentity(n, c);
                advance();
              }}
            />
          ) : (
            <button style={{ ...primaryBtn, background: tailColor }} onClick={next}>
              {current.cta}
            </button>
          )}
        </motion.div>
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
const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.72)',
  backdropFilter: 'blur(4px)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 60,
  padding: 16,
};
const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 380,
  background: 'linear-gradient(160deg, #1A2244, #0B1120)',
  borderRadius: 16,
  padding: '22px 22px 22px',
  border: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
};
const kicker: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: '#94A3B8',
};
const title: React.CSSProperties = {
  margin: '6px 0 8px',
  fontSize: 22,
  color: '#F8FAFC',
  fontWeight: 700,
};
const body: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#F8FAFC',
  fontSize: 14,
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
