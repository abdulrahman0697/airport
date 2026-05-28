/**
 * Aviation-native icon set (Design Review v2 — points 9, 16).
 *
 * Pure SVG, no emojis. Each icon takes `size` and `color`; default
 * stroke is `currentColor` so they inherit the surrounding ink color.
 * Designed for the BottomTabs nav at 22 px and other label rows at
 * 14 — 18 px.
 */
import type { SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

function Icon({ size = 22, color = 'currentColor', children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Radar / Network — concentric arcs + sweep line. */
export function NetworkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" opacity="0.5" />
      <circle cx="12" cy="12" r="2" opacity="0.7" />
      <path d="M12 12 L20 6" opacity="0.8" />
      <circle cx="12" cy="12" r="1" fill={props.color ?? 'currentColor'} />
    </Icon>
  );
}

/** Operations — paper-plane arrow pointing up-right (route launch). */
export function OperationsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 13l9-9 3 3-9 9-3-3z" />
      <path d="M14 8l3-3 4 4-3 3" />
      <path d="M3 13L3 21L11 21" opacity="0.5" />
    </Icon>
  );
}

/** Hangar — boxy roof + plane silhouette inside. */
export function HangarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 20V11l9-5 9 5v9" />
      <path d="M3 20h18" />
      <path d="M8 20v-5l4-2 4 2v5" opacity="0.7" />
      <path d="M11 17l1-1 1 1" />
    </Icon>
  );
}

/** Staff HQ — two-person silhouette. */
export function StaffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="3" />
      <path d="M3 21c0-3 2.5-5.5 5-5.5s5 2.5 5 5.5" />
      <circle cx="17" cy="9" r="2.5" opacity="0.7" />
      <path d="M13 19c0-2.5 2-4.5 4-4.5s4 2 4 4.5" opacity="0.7" />
    </Icon>
  );
}

/** Control Tower — slender tower with antenna on top. */
export function TowerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 21V14l-1-1 3-7 3 7-1 1v7" />
      <rect x="9" y="11" width="6" height="3.5" rx="0.5" />
      <path d="M12 4V2" />
      <circle cx="12" cy="2" r="0.8" fill={props.color ?? 'currentColor'} />
      <path d="M8 21h8" />
    </Icon>
  );
}

/** Executive Deals — briefcase with handle. */
export function DealsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="7" width="18" height="13" rx="1.5" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" opacity="0.6" />
      <circle cx="12" cy="13.5" r="1" fill={props.color ?? 'currentColor'} />
    </Icon>
  );
}

/** Office / CEO — building silhouette with crown lines. */
export function OfficeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="6" width="14" height="15" rx="1" />
      <path d="M8 9h2M14 9h2M8 13h2M14 13h2M8 17h2M14 17h2" />
      <path d="M5 6l7-4 7 4" />
    </Icon>
  );
}

/** Achievements — trophy on plinth. */
export function TrophyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4z" />
      <path d="M5 5H3a2 2 0 0 0 0 4h2M19 5h2a2 2 0 0 1 0 4h-2" />
      <path d="M9 16h6l1 4H8l1-4z" />
      <circle cx="12" cy="8" r="1" fill={props.color ?? 'currentColor'} />
    </Icon>
  );
}

/** Boarding pass icon — ticket with stub line. */
export function BoardingPassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M15 7v10" strokeDasharray="2 1" opacity="0.7" />
      <path d="M6 10h6M6 13h4" opacity="0.7" />
    </Icon>
  );
}
