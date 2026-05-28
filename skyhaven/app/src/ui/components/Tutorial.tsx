import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  selectPendingHubPickRegion,
  selectTailColor,
  selectTutorialCompleted,
  selectTutorialStep,
  useGameStore,
} from '../../state/store';
import { AirlineCrest } from '../design/AirlineCrest';
import { Button } from '../design/Button';
import { COLOR, RADIUS, SPACE } from '../design/tokens';
import { usePanelStore, type PanelId } from './PanelHost';
import { useUiStore } from '../../state/uiStore';
import type { SaveState } from '../../engine/types';

/**
 * Playable tutorial — Design Review v3, points 2, 4, 5.
 *
 * The previous version used giant "Mission Briefing" cards that froze
 * the world and felt like form-filling. The new version uses two
 * patterns:
 *
 *  1. Mission Control strip (~20–25% screen height, docked low,
 *     non-blocking) for routine wait-state instructions. Three slots:
 *     Objective, Tap, Reward — plus a glowing line/ring on the target
 *     UI element. The player can keep interacting with the world; the
 *     strip just nudges.
 *
 *  2. Full-screen emotional moments only for the open (welcome),
 *     close (you're ready), and the Founder Card identity step.
 *
 * Copy follows a strict template: action verb + screen + exact button
 * + result. No "switch to 'B" half-words.
 */

type TargetSpec = string | readonly string[];

type Step =
  | { kind: 'info'; title: string; body: string; cta: string }
  | { kind: 'identity'; title: string; body: string }
  | {
      kind: 'wait-state';
      title: string;
      tap: string;
      reward: string;
      targetFor: (panel: PanelId) => TargetSpec;
      check: (s: SaveState) => boolean;
    }
  | { kind: 'wait-time'; title: string; body: string; durationMs: number };

const STEPS: readonly Step[] = [
  {
    kind: 'info',
    title: 'Welcome to SkyHaven Tycoon',
    body: 'You are about to found an airline with $50K of founder capital. From one regional turboprop to a global aviation empire — let’s start.',
    cta: 'Begin Boarding',
  },
  {
    kind: 'identity',
    title: 'Found your airline',
    body: 'Pick a name, choose a tail colour, and your two-letter call sign follows automatically.',
  },
  {
    kind: 'wait-state',
    title: 'Secure your fuel pipeline',
    tap: 'Open Fuel → Sign Local Refinery contract',
    reward: '+ steady fuel supply (lifts route gate)',
    targetFor: (panel) => panel === 'fuel' ? 'fuel-sign-contract' : 'fuel-gauge',
    check: (s) => s.fuel.contracts.length >= 2,
  },
  {
    kind: 'wait-state',
    title: 'Buy your second aircraft',
    tap: 'Open Hangar → Buy aircraft tab → ATR 42 → Buy + deliver ($25K)',
    reward: '+1 aircraft ready to fly',
    targetFor: (panel) => panel === 'fleet'
      ? ['buy-aircraft-atr42', 'fleet-buy-tab']
      : 'fleet-tab',
    check: (s) => s.fleet.length >= 2,
  },
  {
    kind: 'wait-state',
    title: 'Open your first route',
    tap: 'Operations → New route → pick origin + destination → Authorize Route',
    reward: 'Active route + immediate income/min',
    targetFor: (panel) => panel === 'routes'
      ? ['routes-confirm-button', 'routes-dest-select', 'routes-origin-select', 'routes-new-button']
      : 'routes-tab',
    check: (s) => s.routes.length >= 1,
  },
  {
    kind: 'wait-time',
    title: 'Watch the empire breathe',
    body: 'Your aircraft is flying. Cash counts up automatically — no taps to claim. SkyHaven is an idle airline.',
    durationMs: 6_000,
  },
  {
    kind: 'info',
    title: 'You’re ready, Founder',
    body: 'Your home airport will physically grow with every milestone. Open routes. Hire managers. Unlock regions. The skies are yours.',
    cta: 'Open Your Network',
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

  // Publish the currently-spotlighted target so BottomTabs and other
  // chrome can dim non-target buttons (tap-path guidance — point 9).
  const setTutorialTarget = useUiStore((s) => s.setTutorialTarget);
  useEffect(() => {
    const first: string | null = Array.isArray(target)
      ? (target[0] ?? null)
      : (typeof target === 'string' ? target : null);
    setTutorialTarget(first);
    return () => setTutorialTarget(null);
  }, [target, setTutorialTarget]);

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

  const introDismissed = useUiStore((s) => s.introDismissed);
  const pendingHubPick = useGameStore(selectPendingHubPickRegion);
  if (!introDismissed) return null;
  if (pendingHubPick !== null) return null;
  if (completed) return null;
  if (!current) return null;

  // Wait-state steps render the compact, non-blocking Mission Control
  // strip + a soft glow ring on the target. Info / identity / wait-time
  // steps render a centered emotional moment.
  if (current.kind === 'wait-state') {
    return (
      <>
        {rect && <TargetGlow rect={rect} tailColor={tailColor} />}
        <MissionControlStrip
          step={step}
          total={STEPS.length}
          tailColor={tailColor}
          title={current.title}
          tap={current.tap}
          reward={current.reward}
          hasTarget={rect !== null}
          targetRect={rect}
        />
      </>
    );
  }

  if (current.kind === 'wait-time') {
    return (
      <MissionControlStrip
        step={step}
        total={STEPS.length}
        tailColor={tailColor}
        title={current.title}
        tap={current.body}
        reward="Auto-advances in a moment"
        hasTarget={false}
        targetRect={null}
      />
    );
  }

  if (current.kind === 'identity') {
    return (
      <FounderCard
        airlineName={airlineName}
        tailColor={tailColor}
        onConfirm={(name, color): void => { setIdentity(name, color); advance(); }}
      />
    );
  }

  // info: full emotional moment
  return (
    <InfoMoment
      title={current.title}
      body={current.body}
      cta={current.cta}
      tailColor={tailColor}
      step={step}
      total={STEPS.length}
      onAdvance={advance}
    />
  );
}

// ─── Hook: live-track a data-tutorial target's bounding rect ─────────
function useTargetRect(target: TargetSpec | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const key = Array.isArray(target) ? target.join('|') : (target ?? '');
  useEffect(() => {
    if (!target) { setRect(null); return; }
    const targets = Array.isArray(target) ? target : [target as string];
    const measure = (): void => {
      let found: HTMLElement | null = null;
      for (const t of targets) {
        const el = document.querySelector<HTMLElement>(`[data-tutorial="${t}"]`);
        if (el) { found = el; break; }
      }
      if (!found) { setRect((cur) => (cur ? null : cur)); return; }
      const next = found.getBoundingClientRect();
      setRect((cur) => {
        if (!cur) return next;
        const same =
          cur.top === next.top && cur.left === next.left
          && cur.width === next.width && cur.height === next.height;
        return same ? cur : next;
      });
    };
    measure();
    const id = setInterval(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rect;
}

// ─── Target glow ring (NO blocker backdrop) ─────────────────────────
/**
 * A pulsing cyan ring around the tutorial target. Unlike the previous
 * Spotlight component, this does NOT cover the rest of the screen with
 * a dim blocker — the player keeps full access to the world while
 * Mission Control nudges them.
 */
function TargetGlow({ rect, tailColor }: { rect: DOMRect; tailColor: string }) {
  const padding = 8;
  const x = rect.left - padding;
  const y = rect.top - padding;
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;
  return (
    <motion.div
      key={`${rect.left}-${rect.top}-${rect.width}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, scale: [1, 1.04, 1] }}
      transition={{
        opacity: { duration: 0.22 },
        scale: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
      }}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 14,
        border: `2px solid ${tailColor}`,
        boxShadow:
          `0 0 32px ${tailColor}b3, inset 0 0 18px ${tailColor}30`,
        pointerEvents: 'none',
        zIndex: 35,
      } as Record<string, unknown>}
    />
  );
}

// ─── Mission Control strip (compact, dynamically placed) ─────────────
/**
 * Position rule: if the spotlighted target is in the bottom half of the
 * viewport (e.g. the Authorize Route button in a route-creation modal,
 * a buy button mid-list), place the strip at the TOP so it never sits
 * on top of the very control the player is meant to tap. Otherwise
 * place it at the bottom above the tabs. The placement also accounts
 * for an estimated strip height so it can't overlap the target rect
 * itself.
 */
function MissionControlStrip({
  step, total, tailColor, title, tap, reward, hasTarget, targetRect,
}: {
  step: number;
  total: number;
  tailColor: string;
  title: string;
  tap: string;
  reward: string;
  hasTarget: boolean;
  targetRect: DOMRect | null;
}) {
  const placement = useStripPlacement(targetRect);
  const shellStyle = placement === 'top' ? stripShellTop(tailColor) : stripShellBottom(tailColor);
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`mission-${step}-${placement}`}
        initial={{ y: placement === 'top' ? -30 : 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: placement === 'top' ? -30 : 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        style={shellStyle as Record<string, unknown>}
      >
        <div style={stripKickerRow}>
          <span style={stripKicker(tailColor)}>
            <span style={kickerDot(tailColor)} />
            MISSION CONTROL · {step}/{total - 1}
          </span>
          <span style={stripStatus}>
            {hasTarget ? 'Glowing target on screen' : 'Waiting for action'}
          </span>
        </div>
        <div style={stripTitle}>{title}</div>
        <div style={stripBody}>
          <div style={stripCell}>
            <div style={stripCellLabel}>TAP</div>
            <div style={stripCellValue}>{tap}</div>
          </div>
          <div style={stripCellAccent(tailColor)}>
            <div style={stripCellLabel}>REWARD</div>
            <div style={{ ...stripCellValue, color: COLOR.gold.base }}>{reward}</div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Choose 'top' when the strip would otherwise overlap the spotlight
 * target. Recomputes on resize so rotation / keyboard show-up doesn't
 * leave the strip parked on top of a button.
 */
function useStripPlacement(targetRect: DOMRect | null): 'top' | 'bottom' {
  const [vh, setVh] = useState<number>(typeof window === 'undefined' ? 800 : window.innerHeight);
  useEffect(() => {
    const onResize = (): void => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (!targetRect) return 'bottom';
  const STRIP_H = 150;            // approx strip height
  const BOTTOM_ANCHOR = 80;       // tabs (64) + safe + gap
  const stripTopWhenBottom = vh - BOTTOM_ANCHOR - STRIP_H;
  // If the target's bottom would land in (or below) the strip's bounds,
  // the strip would overlap — so move it to the top instead.
  if (targetRect.bottom >= stripTopWhenBottom - 8) return 'top';
  return 'bottom';
}

// ─── Founder Card (identity moment) ─────────────────────────────────
const NAME_SUGGESTIONS = ['SkyHaven Air', 'HavenJet', 'GulfWing'];
const SWATCHES = ['#5AC8FA', '#F4C75B', '#8B5CF6', '#F87171', '#34D399', '#FFFFFF'];

function FounderCard({
  airlineName, tailColor, onConfirm,
}: {
  airlineName: string;
  tailColor: string;
  onConfirm: (name: string, color: string) => void;
}) {
  const [name, setName] = useState(airlineName || NAME_SUGGESTIONS[0]!);
  const [color, setColor] = useState(tailColor);
  const [editing, setEditing] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={founderShell as Record<string, unknown>}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        style={founderCard(color) as Record<string, unknown>}
      >
        <div style={founderKicker(color)}>FOUNDER CARD</div>

        <div style={founderHero}>
          <AirlineCrest name={name} tailColor={color} size={88} />
        </div>

        <h2 style={founderTitle}>{name.toUpperCase()}</h2>
        <div style={founderTagline}>est. {new Date().getFullYear()}  ·  Aviation Empire (Founding)</div>

        {!editing ? (
          <>
            <div style={founderHint}>QUICK PICK A NAME</div>
            <div style={suggestionsRow}>
              {NAME_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={(): void => setName(s)}
                  style={{
                    ...suggestionPill,
                    borderColor: name === s ? color : 'rgba(148,163,184,0.3)',
                    background: name === s ? `${color}22` : 'rgba(11,17,32,0.5)',
                    color: name === s ? color : COLOR.ink.secondary,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <button onClick={(): void => setEditing(true)} style={customizeBtn}>
              Customize name …
            </button>
          </>
        ) : (
          <>
            <div style={founderHint}>YOUR AIRLINE NAME</div>
            <input
              autoFocus
              value={name}
              onChange={(e): void => setName(e.target.value.slice(0, 20))}
              style={nameInput}
              maxLength={20}
              placeholder="SkyHaven Air"
            />
          </>
        )}

        <div style={founderHint}>TAIL COLOUR</div>
        <div style={swatchRow}>
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={(): void => setColor(c)}
              style={{
                ...swatch,
                background: c,
                outline: color === c ? '2px solid rgba(255,255,255,0.9)' : 'none',
                outlineOffset: 2,
              }}
              aria-label={`Choose tail color ${c}`}
            />
          ))}
        </div>

        <div style={{ marginTop: SPACE.l }}>
          <Button
            variant="gold"
            size="lg"
            fullWidth
            hapticOnPress="heavy"
            onClick={(): void => onConfirm(name.trim() || 'SkyHaven Air', color)}
          >
            Establish Airline
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Info moment (welcome / closing) ────────────────────────────────
function InfoMoment({
  title, body, cta, tailColor, step, total, onAdvance,
}: {
  title: string;
  body: string;
  cta: string;
  tailColor: string;
  step: number;
  total: number;
  onAdvance: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={infoShell as Record<string, unknown>}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        style={infoCard(tailColor) as Record<string, unknown>}
      >
        <div style={infoKicker(tailColor)}>
           CHAPTER {step + 1} / {total}
        </div>
        <h2 style={infoTitle}>{title}</h2>
        <p style={infoBody}>{body}</p>
        <Button
          variant="gold"
          size="lg"
          fullWidth
          accent={tailColor}
          hapticOnPress="heavy"
          onClick={onAdvance}
        >
          {cta}
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const stripShellBase = (tail: string): React.CSSProperties => ({
  position: 'fixed',
  left: 8,
  right: 8,
  // Sit above bottom-modal panels (z 20) AND above the bottom tabs
  // (z 30) so the strip is never covered. Sit BELOW the top bar (z 30)
  // — the top bar wins at the top, the strip is anchored just under it.
  zIndex: 120,
  maxWidth: 460,
  marginLeft: 'auto',
  marginRight: 'auto',
  background: 'linear-gradient(150deg, rgba(11,17,32,0.94), rgba(15,23,42,0.94))',
  border: `1px solid ${tail}55`,
  borderRadius: RADIUS.m,
  boxShadow: `0 10px 28px rgba(0,0,0,0.55), 0 0 18px ${tail}33`,
  backdropFilter: 'blur(14px)',
  // Tighter padding — Design Review v4, point 8. The strip should
  // claim no more than ~22% of the viewport.
  padding: '8px 10px 10px',
  pointerEvents: 'auto',
});
const stripShellBottom = (tail: string): React.CSSProperties => ({
  ...stripShellBase(tail),
  bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 8px)',
});
const stripShellTop = (tail: string): React.CSSProperties => ({
  ...stripShellBase(tail),
  top: 'calc(env(safe-area-inset-top, 0px) + 88px)',
});
const stripKickerRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
};
const stripKicker = (tail: string): React.CSSProperties => ({
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.18em',
  color: tail,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});
const kickerDot = (tail: string): React.CSSProperties => ({
  display: 'inline-block',
  width: 6, height: 6, borderRadius: 999,
  background: tail,
  boxShadow: `0 0 6px ${tail}`,
});
const stripStatus: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.1em',
  color: COLOR.ink.faint,
  fontWeight: 600,
};
const stripTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: COLOR.ink.primary,
  letterSpacing: '0.01em',
  margin: '2px 0 6px',
};
const stripBody: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 6,
};
const stripCell: React.CSSProperties = {
  background: 'rgba(11,17,32,0.55)',
  border: `1px solid ${COLOR.border.soft}`,
  borderRadius: RADIUS.s,
  padding: '5px 9px',
  minWidth: 0,
};
const stripCellAccent = (tail: string): React.CSSProperties => ({
  background: `linear-gradient(135deg, ${tail}1F, rgba(11,17,32,0.55))`,
  border: `1px solid ${COLOR.gold.base}55`,
  borderRadius: RADIUS.s,
  padding: '5px 9px',
});
const stripCellLabel: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.18em',
  color: COLOR.ink.faint,
};
const stripCellValue: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.ink.primary,
  marginTop: 2,
  lineHeight: 1.35,
};

// Founder card
const founderShell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: SPACE.l,
  background: 'radial-gradient(circle at 50% 30%, rgba(11,17,32,0.65), rgba(7,10,24,0.92))',
  backdropFilter: 'blur(6px)',
  zIndex: 60,
};
const founderCard = (tail: string): React.CSSProperties => ({
  width: '100%',
  maxWidth: 380,
  background: 'linear-gradient(170deg, #14213D, #0B1426)',
  borderRadius: 22,
  border: `2px solid ${tail}55`,
  boxShadow: `0 32px 60px rgba(0,0,0,0.6), 0 0 64px ${tail}44`,
  padding: '22px 22px 20px',
  position: 'relative',
});
const founderKicker = (tail: string): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.32em',
  color: tail,
  textAlign: 'center',
});
const founderHero: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  margin: '14px 0 12px',
};
const founderTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  textAlign: 'center',
  color: COLOR.ink.primary,
  letterSpacing: '0.08em',
};
const founderTagline: React.CSSProperties = {
  fontSize: 10,
  textAlign: 'center',
  color: COLOR.ink.faint,
  letterSpacing: '0.12em',
  marginTop: 4,
  marginBottom: SPACE.m,
  textTransform: 'uppercase',
};
const founderHint: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.22em',
  color: COLOR.ink.muted,
  marginTop: SPACE.m,
  marginBottom: 6,
};
const suggestionsRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
};
const suggestionPill: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 700,
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(148,163,184,0.3)',
  cursor: 'pointer',
  transition: 'border-color 200ms ease, background 200ms ease, color 200ms ease',
};
const customizeBtn: React.CSSProperties = {
  marginTop: 8,
  background: 'transparent',
  color: COLOR.ink.muted,
  border: 0,
  fontFamily: 'inherit',
  fontSize: 11,
  letterSpacing: '0.08em',
  cursor: 'pointer',
  textDecoration: 'underline',
};
const nameInput: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(148,163,184,0.3)',
  color: COLOR.ink.primary,
  padding: '10px 12px',
  borderRadius: 10,
  fontSize: 14,
  fontFamily: 'inherit',
  minHeight: 44,
  boxSizing: 'border-box',
};
const swatchRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};
const swatch: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: 0,
  cursor: 'pointer',
};

// Info moment
const infoShell: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: SPACE.l,
  background: 'radial-gradient(circle at 50% 30%, rgba(11,17,32,0.55), rgba(7,10,24,0.88))',
  backdropFilter: 'blur(4px)',
  zIndex: 60,
};
const infoCard = (tail: string): React.CSSProperties => ({
  width: '100%',
  maxWidth: 380,
  background: 'linear-gradient(170deg, #14213D, #0B1426)',
  borderRadius: 20,
  border: `2px solid ${tail}55`,
  boxShadow: `0 32px 60px rgba(0,0,0,0.6), 0 0 56px ${tail}44`,
  padding: SPACE.l,
});
const infoKicker = (tail: string): React.CSSProperties => ({
  display: 'inline-block',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.24em',
  color: tail,
  background: `${tail}14`,
  border: `1px solid ${tail}44`,
  padding: '4px 10px',
  borderRadius: 999,
  marginBottom: SPACE.s,
});
const infoTitle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 24,
  fontWeight: 900,
  color: COLOR.ink.primary,
  letterSpacing: '0.01em',
  lineHeight: 1.2,
};
const infoBody: React.CSSProperties = {
  margin: `0 0 ${SPACE.l}px`,
  color: COLOR.ink.secondary,
  fontSize: 14,
  lineHeight: 1.55,
};
