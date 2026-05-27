/**
 * Design tokens — the single source of truth for everything visual.
 *
 * Every later design pass (cards, modals, buttons, tutorial,
 * cinematic moments) composes from these. Pre-D1 we had hex literals
 * scattered across 30+ files; if a hex literal slips into a new
 * surface, treat it as a code-review issue.
 *
 * Style direction (per docs/DESIGN_ROADMAP.md): dark glassmorphic HUD
 * with vivid neon accents, parallax depth, satisfying micro-
 * interactions. Reference: Pocket Planes, Idle Miner Tycoon, Township.
 */

/**
 * Color palette. Tier classes:
 *   bg.*        — surface tones (deepest → glass overlay)
 *   ink.*       — text + iconography
 *   accent.*    — primary brand cyan
 *   gold.*      — money / achievement
 *   success/warn/danger — feedback semantics
 *   eco.*       — eco-rating tiers
 */
export const COLOR = {
  bg: {
    deep:   '#0A0F1F',
    canvas: '#0B1120',
    panel:  '#111A2E',
    glass:  'rgba(255,255,255,0.04)',
    glassHover: 'rgba(255,255,255,0.08)',
    elevated: 'rgba(11,17,32,0.92)',
  },
  ink: {
    primary:   '#F8FAFC',
    secondary: '#CBD5E1',
    muted:     '#94A3B8',
    faint:     '#64748B',
  },
  accent: {
    cyan:    '#5AC8FA',
    cyanDim: 'rgba(90,200,250,0.28)',
    cyanGlow:'rgba(90,200,250,0.55)',
    violet:  '#8B5CF6',
  },
  gold: {
    base:   '#F4C75B',
    light:  '#FCE9A5',
    deep:   '#B08D2E',
    dim:    'rgba(244,199,91,0.16)',
  },
  success: '#34D399',
  successDim: 'rgba(52,211,153,0.16)',
  warn:    '#F59E0B',
  warnDim: 'rgba(245,158,11,0.16)',
  danger:  '#F87171',
  dangerDim: 'rgba(248,113,113,0.16)',
  eco: {
    bronze:   '#B08D57',
    silver:   '#C0C0C8',
    gold:     '#F4C75B',
    platinum: '#E5E4E2',
  },
  border: {
    soft:   'rgba(255,255,255,0.06)',
    medium: 'rgba(255,255,255,0.12)',
    strong: 'rgba(255,255,255,0.24)',
    accent: 'rgba(90,200,250,0.45)',
  },
} as const;

/**
 * Type ramp. `display` is reserved for hero moments (tier unlock,
 * achievement reveal); `title`/`body`/`label` cover everyday UI.
 */
export const TYPE = {
  display: { size: 32, weight: 800, letter: '0.04em' },
  title:   { size: 22, weight: 700, letter: '0.02em' },
  heading: { size: 16, weight: 700, letter: '0.04em' },
  body:    { size: 14, weight: 500, letter: '0.01em' },
  small:   { size: 12, weight: 500, letter: '0.02em' },
  label:   { size: 10, weight: 700, letter: '0.18em', transform: 'uppercase' as const },
  tag:     { size: 9,  weight: 800, letter: '0.12em', transform: 'uppercase' as const },
} as const;

/** Spacing scale — multiples of 4px. */
export const SPACE = {
  xs: 4,
  s:  8,
  m:  12,
  l:  16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Corner radius scale. */
export const RADIUS = {
  xs: 4,
  s:  8,
  m:  12,
  l:  16,
  xl: 20,
  pill: 999,
} as const;

/** Shadow scale — composed for the dark theme (warm-cool stacks). */
export const SHADOW = {
  card:   '0 6px 18px rgba(0,0,0,0.45)',
  panel:  '0 14px 40px rgba(0,0,0,0.55)',
  modal:  '0 24px 70px rgba(0,0,0,0.6), 0 0 48px rgba(90,200,250,0.18)',
  hud:    '0 6px 18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
  glow: (color: string, strength = 0.6): string =>
    `0 0 24px ${color}, 0 0 48px ${color}${Math.round(strength * 100)}`,
} as const;

/**
 * Motion tokens. Durations in ms; easings as CSS-friendly strings.
 * Reduced-motion-aware components should multiply duration by ~0 (or
 * skip the transition entirely).
 */
export const MOTION = {
  duration: {
    instant: 0,
    micro:   120,   // pressed → released
    short:   200,   // chip swaps, small reveals
    medium:  320,   // modal in, cards reorder
    long:    520,   // hero moments, cinematic camera
  },
  easing: {
    /** Soft entry from the bottom — modals, sheets. */
    out:     'cubic-bezier(0.16, 1, 0.3, 1)',
    /** Tight feedback — taps, button press. */
    snap:    'cubic-bezier(0.4, 0, 0.2, 1)',
    /** Toy-bouncy — confetti, hero reveals. */
    spring:  'cubic-bezier(0.22, 1.36, 0.48, 1.0)',
  },
} as const;

/**
 * Z-index scale. Higher = above lower. Keep modals < toast < watchdog.
 */
export const Z = {
  base:        1,
  hud:        10,
  panel:      20,
  bottomTabs: 30,
  modal:      100,
  spotlight:  200,
  card:       202,
  toast:      300,
  watchdog:   9999,
} as const;
