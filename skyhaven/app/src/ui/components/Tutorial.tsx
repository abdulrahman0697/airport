import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  selectTailColor,
  selectTutorialCompleted,
  selectTutorialStep,
  useGameStore,
} from '../../state/store';
import { usePanelStore, type PanelId } from './PanelHost';
import type { SaveState } from '../../engine/types';

/**
 * Playable tutorial (BRD §5.2).
 *
 * Interactive walkthrough — each step either takes a quick player
 * input (rename) or watches the real game state for the player to
 * perform the action (sign a contract, buy a plane, open a route).
 * A glowing spotlight ring sits over the target UI element; a
 * tooltip card on the *opposite* end of the screen explains what to
 * do without obscuring the target. Auto-advances on state check.
 *
 * Failure-proof: navigation isn't blocked; the tutorial just waits.
 */

type Step =
  | { kind: 'info'; title: string; body: string; cta: string }
  | { kind: 'identity'; title: string; body: string }
  | {
      kind: 'wait-state'; title: string; body: string;
      /** `target` shifts based on whether the relevant panel is open. */
      targetFor: (panel: PanelId) => string;
      check: (s: SaveState) => boolean;
    }
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
    body: 'Tap the glowing fuel gauge, then sign the highlighted contract. More supply means more aircraft can fly.',
    targetFor: (panel) => panel === 'fuel' ? 'fuel-sign-contract' : 'fuel-gauge',
    check: (s) => s.fuel.contracts.length >= 2,
  },
  {
    kind: 'wait-state',
    title: 'Buy a second aircraft',
    body: 'Open the Fleet tab, switch to the highlighted "Buy aircraft" tab, and grab any T1.',
    targetFor: (panel) => panel === 'fleet' ? 'fleet-buy-tab' : 'fleet-tab',
    check: (s) => s.fleet.length >= 2,
  },
  {
    kind: 'wait-state',
    title: 'Open a new route',
    body: 'Open the Routes tab, then tap the highlighted "+ New route" button.',
    targetFor: (panel) => panel === 'routes' ? 'routes-new-button' : 'routes-tab',
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

  const activePanel = usePanelStore((s) => s.active);
  const current = step < STEPS.length ? STEPS[step]! : null;
  const target = current?.kind === 'wait-state' ? current.targetFor(activePanel) : null;
  const rect = useTargetRect(target);

  useEffect(() => {
    if (!current || current.kind !== 'wait-state' || !state) return;
    if (current.check(state)) advance();
  }, [current, state, advance]);

  useEffect(() => {
    if (!current || current.kind !== 'wait-time') return;
    const id = setTimeout(() => advance(), current.durationMs);
    return () => clearTimeout(id);
  }, [current, advance]);

  useEffect(() => {
    if (!completed && step >= STEPS.length) complete();
  }, [completed, step, complete]);

  if (completed) return null;
  if (!current) return null;

  return (
    <>
      {current.kind === 'wait-state' && rect && <Spotlight rect={rect} />}
      <TutorialCard
        step={step}
        total={STEPS.length}
        current={current}
        tailColor={tailColor}
        airlineName={airlineName}
        targetRect={rect}
        onAdvance={advance}
        onSetIdentity={(name, color): void => { setIdentity(name, color); advance(); }}
      />
    </>
  );
}

// ─── Hook: live-track a data-tutorial target's bounding rect ─────────
function useTargetRect(target: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!target) { setRect(null); return; }
    const measure = (): void => {
      const el = document.querySelector<HTMLElement>(`[data-tutorial="${target}"]`);
      if (!el) { setRect((cur) => (cur ? null : cur)); return; }
      const next = el.getBoundingClientRect();
      setRect((cur) => {
        if (!cur) return next;
        // Only re-set if the rect actually moved — avoids React thrash.
        const same =
          cur.top === next.top && cur.left === next.left
          && cur.width === next.width && cur.height === next.height;
        return same ? cur : next;
      });
    };
    measure();
    // Poll for lazy-loaded targets inside lazy panels.
    const id = setInterval(measure, 300);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [target]);
  return rect;
}

// ─── Spotlight ring + soft dim ───────────────────────────────────────
function Spotlight({ rect }: { rect: DOMRect }) {
  const padding = 8;
  return (
    <motion.div
      key={`${rect.left}-${rect.top}-${rect.width}`}
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        scale: [1, 1.06, 1],
      }}
      transition={{
        opacity: { duration: 0.22 },
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
        // Outer dim is lighter than before so panel contents stay readable
        // when the player taps through to (say) the FuelPanel.
        boxShadow:
          '0 0 0 9999px rgba(0,0,0,0.45), 0 0 32px rgba(90,200,250,0.7), inset 0 0 18px rgba(90,200,250,0.18)',
        pointerEvents: 'none',
        zIndex: 60,
      }}
    />
  );
}

// ─── The tutorial card ───────────────────────────────────────────────
function TutorialCard({
  step, total, current, tailColor, airlineName, targetRect,
  onAdvance, onSetIdentity,
}: {
  step: number;
  total: number;
  current: Step;
  tailColor: string;
  airlineName: string;
  targetRect: DOMRect | null;
  onAdvance: () => void;
  onSetIdentity: (name: string, color: string) => void;
}) {
  const placement = useMemo(() => {
    if (current.kind !== 'wait-state' || !targetRect) return 'center' as const;
    // Place the card on the OPPOSITE end of the screen from the target,
    // with comfortable margin. The fuel gauge sits high-right, the
    // bottom tabs sit at the bottom — opposite-end placement keeps the
    // card from ever covering the highlighted button.
    const middle = window.innerHeight / 2;
    const targetMid = targetRect.top + targetRect.height / 2;
    return targetMid > middle ? ('top' as const) : ('bottom' as const);
  }, [current.kind, targetRect]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`step-${step}-${placement}`}
        initial={{ y: placement === 'top' ? -24 : placement === 'bottom' ? 24 : 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        style={(placement === 'center' ? shellCenter : placement === 'top' ? shellTop : shellBottom) as Record<string, unknown>}
      >
        <div style={card}>
          <div style={kicker}>
            <span>Step {step + 1} of {total}</span>
            {current.kind === 'wait-state' && <span style={waitTag}>● waiting for you</span>}
            {current.kind === 'wait-time' && <span style={waitTagNeutral}>● auto-advance</span>}
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
// Target is in the BOTTOM half (bottom-tab spotlights) → card at TOP.
const shellTop: React.CSSProperties = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + 88px)',
  left: 12,
  right: 12,
  zIndex: 62,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
};
// Target is in the TOP half (fuel-gauge spotlight) → card at BOTTOM,
// safely above the bottom-tab strip + the goal-chain ribbon.
const shellBottom: React.CSSProperties = {
  position: 'fixed',
  bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 80px)',
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
  padding: '16px 18px 18px',
  border: '1px solid rgba(90,200,250,0.45)',
  boxShadow: '0 18px 60px rgba(0,0,0,0.55), 0 0 36px rgba(90,200,250,0.20)',
  pointerEvents: 'auto',
};
const kicker: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
  color: '#94A3B8',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
};
const waitTag: React.CSSProperties = {
  fontSize: 9,
  color: '#5AC8FA',
  letterSpacing: '0.06em',
  textTransform: 'none',
};
const waitTagNeutral: React.CSSProperties = {
  fontSize: 9,
  color: '#94A3B8',
  letterSpacing: '0.06em',
  textTransform: 'none',
};
const title: React.CSSProperties = {
  margin: '6px 0 6px',
  fontSize: 18,
  color: '#F8FAFC',
  fontWeight: 700,
  lineHeight: 1.2,
};
const body: React.CSSProperties = {
  margin: '0 0 12px',
  color: '#F8FAFC',
  fontSize: 13,
  lineHeight: 1.5,
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
