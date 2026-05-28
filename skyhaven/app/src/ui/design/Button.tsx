/**
 * Button primitive (Design pass D2).
 *
 * Variants:
 *  - **primary**: brand-cyan fill, ink-dark text. Used for the
 *    single most important action on a surface.
 *  - **secondary**: outlined, cyan stroke. For non-destructive but
 *    not primary actions.
 *  - **ghost**: transparent, muted text. For low-emphasis dismissals.
 *  - **destructive**: danger outlined. For sells, closes, deletes.
 *  - **gold**: gold fill — exclusively for claim/reward CTAs.
 *
 * Sizes:
 *  - sm (28px), md (36px, default), lg (44px touch-target).
 *
 * Motion: press scale 0.97 for `micro` duration, returning via snap.
 * Pairs with `juice/haptics` for tactile feedback; sound hook is
 * stubbed for Pass D7.
 *
 * Every clickable in the game should migrate to this — see the
 * docs/DESIGN_ROADMAP.md interaction-patterns rule from team-ui.
 */
import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { haptics } from '../juice/haptics';
import { sfx } from '../juice/sfx';
import { COLOR, MOTION, RADIUS, SPACE } from './tokens';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'gold';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render a leading icon (SVG or character). */
  leadingIcon?: ReactNode;
  /** Stretch to fill the parent width. */
  fullWidth?: boolean;
  /** Override the accent color (overrides variant defaults). */
  accent?: string;
  /** Press / release haptic strength. */
  hapticOnPress?: 'light' | 'medium' | 'heavy' | 'none';
  style?: React.CSSProperties;
}

const HEIGHTS: Record<ButtonSize, number> = { sm: 28, md: 36, lg: 44 };
const PADDINGS: Record<ButtonSize, string> = {
  sm: `${SPACE.xs}px ${SPACE.s}px`,
  md: `${SPACE.s}px ${SPACE.m}px`,
  lg: `${SPACE.m}px ${SPACE.l}px`,
};
const TEXT: Record<ButtonSize, number> = { sm: 11, md: 12, lg: 13 };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leadingIcon,
    fullWidth,
    accent,
    hapticOnPress = 'light',
    onClick,
    onPointerDown,
    style,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const [pressed, setPressed] = useState(false);
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    if (disabled) return;
    setPressed(true);
    if (hapticOnPress !== 'none') {
      haptics[hapticOnPress]();
      // Pair the haptic with a matching SFX — UI feels twice as
      // responsive with sound + touch firing in lockstep.
      if (hapticOnPress === 'light') sfx.tick();
      else sfx.confirm();
    }
    onPointerDown?.(e);
  };
  const handlePointerUp = (): void => setPressed(false);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={disabled}
      style={{
        ...buttonBase(size, variant, accent),
        ...(fullWidth ? { width: '100%' } : {}),
        ...(disabled ? disabledStyle : {}),
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        ...style,
      }}
      {...rest}
    >
      {leadingIcon && <span style={iconWrap}>{leadingIcon}</span>}
      {children !== undefined && (
        <span style={{ fontSize: TEXT[size], fontWeight: 700, letterSpacing: '0.04em' }}>
          {children}
        </span>
      )}
    </button>
  );
});

function buttonBase(size: ButtonSize, variant: ButtonVariant, accent?: string): React.CSSProperties {
  const accentColor = accent ?? variantAccent(variant);
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.s,
    height: HEIGHTS[size],
    minHeight: HEIGHTS[size],
    padding: PADDINGS[size],
    border: 0,
    borderRadius: RADIUS.s,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 700,
    letterSpacing: '0.04em',
    transition: `transform ${MOTION.duration.micro}ms ${MOTION.easing.snap}, background ${MOTION.duration.short}ms ${MOTION.easing.snap}, box-shadow ${MOTION.duration.short}ms ${MOTION.easing.snap}`,
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };
  switch (variant) {
    case 'primary':
      return {
        ...base,
        background: accentColor,
        color: COLOR.bg.deep,
        boxShadow: `0 4px 14px ${accentColor}55, inset 0 1px 0 rgba(255,255,255,0.4)`,
      };
    case 'secondary':
      return {
        ...base,
        background: `${accentColor}14`,
        color: accentColor,
        border: `1px solid ${accentColor}55`,
      };
    case 'ghost':
      return {
        ...base,
        background: 'transparent',
        color: COLOR.ink.secondary,
        border: `1px solid ${COLOR.border.medium}`,
      };
    case 'destructive':
      return {
        ...base,
        background: 'transparent',
        color: COLOR.danger,
        border: `1px solid ${COLOR.danger}66`,
      };
    case 'gold':
      return {
        ...base,
        background: `linear-gradient(160deg, ${COLOR.gold.light}, ${COLOR.gold.base})`,
        color: COLOR.bg.deep,
        boxShadow: `0 4px 14px ${COLOR.gold.base}55, inset 0 1px 0 rgba(255,255,255,0.55)`,
      };
  }
}

function variantAccent(variant: ButtonVariant): string {
  switch (variant) {
    case 'destructive': return COLOR.danger;
    case 'gold':        return COLOR.gold.base;
    default:            return COLOR.accent.cyan;
  }
}

const disabledStyle: React.CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
  filter: 'saturate(0.6)',
};

const iconWrap: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  lineHeight: 1,
};

/**
 * Icon-only square button. Smaller hit-target tightly cropped to the
 * icon — used for close, refresh, settings glyphs.
 */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(function IconButton(
  { size = 'md', variant = 'ghost', children, style, ...rest },
  ref,
) {
  const dim = HEIGHTS[size];
  return (
    <Button
      ref={ref}
      size={size}
      variant={variant}
      style={{ width: dim, padding: 0, ...style }}
      {...rest}
    >
      {children}
    </Button>
  );
});
