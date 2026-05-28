/**
 * Safe-area helpers (Design pass DB).
 *
 * Resolves the runtime pixel value of the `--world-top` CSS variable
 * (top-bar bottom edge) so JS-positioned overlays can clamp against
 * it. The value derives from `env(safe-area-inset-top, 0) + 100px`
 * by default — but reading it from the computed style ensures we
 * stay in sync if the design system later retunes the constant.
 */
export function worldTopPx(): number {
  if (typeof window === 'undefined') return 100;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--world-top');
    if (!raw) return 100;
    // CSS calc() resolves to a px string at compute time (modern
    // browsers); fall back to a sane default if we got something
    // unexpected.
    const m = /([-\d.]+)\s*px/.exec(raw);
    return m ? parseFloat(m[1]!) : 100;
  } catch {
    return 100;
  }
}

/** Smallest valid `top` for a popover so it sits below the top bar. */
export function popoverTopFloor(): number {
  return worldTopPx() + 8;
}

/** Largest valid `top + height` so a popover doesn't slip under the bottom tabs. */
export function popoverBottomCeiling(): number {
  if (typeof window === 'undefined') return 9999;
  return window.innerHeight - 72; // bottom tab strip ≈ 64px + buffer
}
