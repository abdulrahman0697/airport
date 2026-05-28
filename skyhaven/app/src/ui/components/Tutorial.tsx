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
  // Design Review v6 — point 6. The opening "Welcome to SkyHaven
  // Tycoon" full-screen modal was a lecture. Removed entirely. The
  // player goes straight from cinematic into picking a base.
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
  // Closing info-moment removed too — the player dismisses Mission
  // Control by hitting the goal, not by reading a final card.
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
        {...(placement === 'top'
          ? { 'data-popover-block-top': true }
          : { 'data-popover-block-bottom': true })}
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
  // Design Review v4 — point 4. Two phases: identity setup and the
  // boarding-pass-style Founder Certificate stamp moment.
  const [phase, setPhase] = useState<'setup' | 'certificate'>('setup');
  // Design Review v6 — point 7. Three livery styles for the live
  // preview. Classic Stripe = single tail-colour stripe down the
  // fuselage. Modern Tail = bold filled tail fin. Premium Minimal =
  // thin tail-colour bands.
  const [livery, setLivery] = useState<'classic' | 'modern' | 'premium'>('modern');

  if (phase === 'certificate') {
    return (
      <FounderCertificate
        name={name.trim() || 'SkyHaven Air'}
        color={color}
        onContinue={(): void => onConfirm(name.trim() || 'SkyHaven Air', color)}
      />
    );
  }

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
          <AirlineCrest name={name} tailColor={color} size={68} />
        </div>

        {/* Live aircraft livery preview — Design Review v4, point 5.
            The selected tail colour applies in real-time to the
            aircraft tail/wings so the player sees their airline come
            alive on a plane, not just on a button. */}
        <div style={liveryPreviewWrap(color)}>
          <div style={liveryPreviewKicker}>LIVERY PREVIEW</div>
          {/* Live repaint — Design Review v6 point 7. Picker chips
              below trigger a snap-repaint via key change on the
              illustration container. */}
          <motion.div
            key={`livery-${livery}-${color}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            style={liveryPreviewStage as Record<string, unknown>}
          >
            <LiveryAircraft tailColor={color} livery={livery} />
          </motion.div>
          <div style={liveryChipsRow}>
            <LiveryChip
              label="Classic Stripe"
              active={livery === 'classic'}
              tail={color}
              onClick={(): void => setLivery('classic')}
            />
            <LiveryChip
              label="Modern Tail"
              active={livery === 'modern'}
              tail={color}
              onClick={(): void => setLivery('modern')}
            />
            <LiveryChip
              label="Premium Minimal"
              active={livery === 'premium'}
              tail={color}
              onClick={(): void => setLivery('premium')}
            />
          </div>
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
            onClick={(): void => setPhase('certificate')}
          >
            Register Airline  →
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Live aircraft livery preview — Design Review v6 point 7.
function LiveryAircraft({ tailColor, livery }: { tailColor: string; livery: 'classic' | 'modern' | 'premium' }) {
  // Side-view ATR-style turboprop with parametric livery painting.
  return (
    <svg width="200" height="68" viewBox="0 0 200 68">
      <defs>
        <linearGradient id="livery-fuselage" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#CBD5E1" />
        </linearGradient>
      </defs>
      {/* Wing under fuselage */}
      <path d="M 60 36 L 100 36 L 90 44 L 70 44 Z" fill="#94A3B8" opacity="0.6" />
      {/* Fuselage */}
      <path
        d="M 28 32 Q 28 24 44 22 L 158 22 Q 174 24 178 32 Q 174 40 158 42 L 44 42 Q 28 40 28 32 Z"
        fill="url(#livery-fuselage)"
      />
      {/* Cockpit */}
      <path d="M 28 30 L 38 28 L 38 35 L 28 33 Z" fill="#2A3556" opacity="0.85" />
      {/* Window strip */}
      {Array.from({ length: 18 }).map((_, i) => (
        <rect key={i} x={48 + i * 6} y={28} width="2.5" height="4" fill="#2A3556" opacity="0.75" />
      ))}
      {/* Door */}
      <rect x="44" y="29" width="3" height="9" fill="#2A3556" opacity="0.4" />
      {/* Engine + prop */}
      <g transform="translate(80 38)">
        <circle cx="0" cy="0" r="3.5" fill="#1F2A4D" />
        <ellipse cx="-3" cy="0" rx="0.8" ry="4" fill="#94A3B8" opacity="0.55" />
      </g>
      {/* Tail fin */}
      {livery === 'modern' && (
        <>
          <path d="M 158 22 L 178 8 L 188 22 L 178 24 Z" fill={tailColor} />
          <text x="172" y="20" fontSize="6" fontWeight="900" letterSpacing="0.1em"
            fill="#0B1120" textAnchor="middle">SH</text>
        </>
      )}
      {livery === 'classic' && (
        <>
          <path d="M 158 22 L 178 8 L 188 22 L 178 24 Z" fill="#F8FAFC" stroke={tailColor} strokeWidth="1.2" />
          <rect x="34" y="30" width="148" height="3" fill={tailColor} opacity="0.9" />
        </>
      )}
      {livery === 'premium' && (
        <>
          <path d="M 158 22 L 178 8 L 188 22 L 178 24 Z" fill="#F8FAFC" stroke={tailColor} strokeWidth="0.8" />
          <rect x="34" y="36" width="148" height="0.8" fill={tailColor} opacity="0.85" />
          <rect x="34" y="38" width="148" height="0.4" fill={tailColor} opacity="0.55" />
          {/* Tail accent dot */}
          <circle cx="178" cy="16" r="2" fill={tailColor} />
        </>
      )}
      {/* Wheels */}
      <circle cx="62" cy="48" r="2.5" fill="#2A3556" />
      <circle cx="98" cy="48" r="2.5" fill="#2A3556" />
      <circle cx="38" cy="46" r="2" fill="#2A3556" />
    </svg>
  );
}

function LiveryChip({ label, active, tail, onClick }: { label: string; active: boolean; tail: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...liveryChip,
        background: active ? `${tail}22` : 'rgba(11,17,32,0.55)',
        border: `1px solid ${active ? tail : 'rgba(148,163,184,0.3)'}`,
        color: active ? tail : COLOR.ink.muted,
      }}
    >
      {label}
    </button>
  );
}

// ─── Founder Certificate (Design Review v4 — point 4) ───────────────
/**
 * A boarding-pass-style commercial operator license. Animated approval
 * stamp lands ~700ms after mount; "Cleared for Commercial Operations"
 * text reveals; player taps Continue to advance the tutorial.
 */
function FounderCertificate({
  name, color, onContinue,
}: {
  name: string;
  color: string;
  onContinue: () => void;
}) {
  const [stamped, setStamped] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setStamped(true), 700);
    return () => window.clearTimeout(id);
  }, []);
  const today = new Date();
  const dateStr = `${today.getDate()}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={founderShell as Record<string, unknown>}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        style={certificateShell(color) as Record<string, unknown>}
      >
        {/* Boarding-pass perforated top edge */}
        <div style={certPerforation} aria-hidden />

        <div style={certHeaderRow}>
          <div>
            <div style={certKicker(color)}>COMMERCIAL OPERATOR LICENSE</div>
            <div style={certCarrier}>{name.toUpperCase()}</div>
          </div>
          <div style={certCrest}>
            <AirlineCrest name={name} tailColor={color} size={48} />
          </div>
        </div>

        <div style={certDashed} />

        <div style={certGrid}>
          <CertCell label="LICENSE" value="REGIONAL · CARGO · INTL" />
          <CertCell label="DATE" value={dateStr} />
          <CertCell label="BASE" value="HUB · TBD" />
          <CertCell label="CAPITAL" value="$50,000 USD" accent={COLOR.gold.base} />
          <CertCell label="FOUNDING FLEET" value="1 × ATR 42" />
          <CertCell label="ROUTE RIGHTS" value="REGIONAL ↔ INTL" />
        </div>

        <div style={certDashed} />

        <div style={{ position: 'relative', minHeight: 78 }}>
          <div style={certFooter}>
            <div style={certFooterKicker}>AUTHORIZED BY</div>
            <div style={certFooterValue}>SkyHaven Aviation Authority</div>
          </div>

          {/* Approval stamp */}
          <AnimatePresence>
            {stamped && (
              <motion.div
                initial={{ scale: 1.8, opacity: 0, rotate: -22 }}
                animate={{ scale: 1, opacity: 0.95, rotate: -12 }}
                transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                style={stamp(color) as Record<string, unknown>}
              >
                <div style={stampLine1}>CLEARED FOR</div>
                <div style={stampLine2}>COMMERCIAL</div>
                <div style={stampLine3}>OPERATIONS  ✓</div>
                <div style={stampMeta}>{dateStr}  ·  #SKY-{Math.floor(Math.random() * 9000 + 1000)}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={certPerforation} aria-hidden />

        <div style={{ marginTop: SPACE.m }}>
          <Button
            variant={stamped ? 'gold' : 'ghost'}
            size="lg"
            fullWidth
            hapticOnPress="heavy"
            disabled={!stamped}
            onClick={onContinue}
          >
            {stamped ? 'Take the controls  →' : 'Awaiting approval…'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CertCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={certCell}>
      <div style={certCellLabel}>{label}</div>
      <div style={{ ...certCellValue, color: accent ?? '#0B1120' }}>{value}</div>
    </div>
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
// Livery preview (Design Review v4 — point 5)
const liveryPreviewWrap = (color: string): React.CSSProperties => ({
  margin: '6px 0 4px',
  padding: '10px 8px 6px',
  background: `linear-gradient(180deg, ${color}1a, rgba(11,17,32,0.4))`,
  border: `1px solid ${color}33`,
  borderRadius: 12,
  textAlign: 'center',
});
const liveryPreviewKicker: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.22em',
  color: COLOR.ink.faint,
  marginBottom: 4,
};
const liveryPreviewStage: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};
const liveryChipsRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 6,
  marginTop: 8,
  flexWrap: 'wrap',
};
const liveryChip: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  padding: '5px 9px',
  borderRadius: 999,
  cursor: 'pointer',
};

// Founder certificate (Design Review v4 — point 4)
const certificateShell = (color: string): React.CSSProperties => ({
  width: '100%',
  maxWidth: 400,
  background: 'linear-gradient(170deg, #EFF4FB, #D5DEEF)',
  borderRadius: 18,
  border: `2px solid ${color}66`,
  padding: '14px 16px 16px',
  boxShadow: `0 32px 60px rgba(0,0,0,0.6), 0 0 64px ${color}44`,
  color: '#0B1120',
  position: 'relative',
});
const certPerforation: React.CSSProperties = {
  height: 8,
  background: 'radial-gradient(circle at 4px 4px, rgba(11,17,32,0.3) 1.6px, transparent 2.4px) 0 0 / 12px 8px',
  margin: '-4px -16px',
};
const certHeaderRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  paddingTop: 6,
};
const certKicker = (color: string): React.CSSProperties => ({
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.24em',
  color,
});
const certCarrier: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: '0.04em',
  color: '#0B1120',
  marginTop: 2,
};
const certCrest: React.CSSProperties = {
  flexShrink: 0,
};
const certDashed: React.CSSProperties = {
  height: 1,
  background: 'repeating-linear-gradient(90deg, rgba(11,17,32,0.3) 0, rgba(11,17,32,0.3) 4px, transparent 4px, transparent 8px)',
  margin: '10px 0',
};
const certGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};
const certCell: React.CSSProperties = {
  background: 'rgba(11,17,32,0.06)',
  borderRadius: 6,
  padding: '5px 8px',
};
const certCellLabel: React.CSSProperties = {
  fontSize: 8,
  letterSpacing: '0.18em',
  fontWeight: 800,
  color: '#475569',
  textTransform: 'uppercase',
};
const certCellValue: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  marginTop: 1,
  letterSpacing: '0.02em',
  color: '#0B1120',
  fontFeatureSettings: '"tnum" 1',
};
const certFooter: React.CSSProperties = {
  paddingTop: 4,
};
const certFooterKicker: React.CSSProperties = {
  fontSize: 8,
  letterSpacing: '0.2em',
  fontWeight: 800,
  color: '#475569',
};
const certFooterValue: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#0B1120',
  marginTop: 2,
  fontStyle: 'italic',
};
const stamp = (color: string): React.CSSProperties => ({
  position: 'absolute',
  top: -4,
  right: 6,
  border: `3px solid ${color}`,
  color,
  background: `${color}10`,
  padding: '6px 12px',
  borderRadius: 8,
  textAlign: 'center',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  boxShadow: `0 4px 12px rgba(0,0,0,0.15)`,
  transformOrigin: 'center',
});
const stampLine1: React.CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.2em',
};
const stampLine2: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: '0.04em',
};
const stampLine3: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
};
const stampMeta: React.CSSProperties = {
  fontSize: 7,
  fontWeight: 600,
  letterSpacing: '0.1em',
  marginTop: 3,
  opacity: 0.85,
};

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
