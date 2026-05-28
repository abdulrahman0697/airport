/**
 * Safe-area helpers (Design pass DB).
 *
 * Resolves the runtime pixel value of the `--world-top` CSS variable
 * (top-bar bottom edge) so JS-positioned overlays can clamp against
 * it. The value derives from `env(safe-area-inset-top, 0) + 100px`
 * by default — but reading it from the computed style ensures we
 * stay in sync if the design system later retunes the constant.
 *
 * Popover clearance also accounts for opt-in obstacles that any
 * fixed-position widget can tag itself with:
 *   - `data-popover-block-top`: extends the popover floor down to
 *     this element's bottom edge (e.g. EventBanner).
 *   - `data-popover-block-bottom`: lifts the popover ceiling up to
 *     this element's top edge (e.g. MapLiveTicker ticker bar,
 *     Tutorial Mission Control strip).
 *
 * Elements that aren't currently rendered or are display:none are
 * ignored automatically.
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

function rectBottomOf(selector: string): number {
  if (typeof document === 'undefined') return 0;
  let max = 0;
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.bottom > max) max = r.bottom;
  }
  return max;
}

function rectTopOf(selector: string): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 9999;
  let min = window.innerHeight;
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.top < min) min = r.top;
  }
  return min;
}

/** Smallest valid `top` for a popover so it sits below the top bar
 *  and any visible top-anchored obstacles (event banner, etc.). */
export function popoverTopFloor(): number {
  const base = worldTopPx() + 8;
  const obstacles = rectBottomOf('[data-popover-block-top]');
  return Math.max(base, obstacles + 8);
}

/** Largest valid `top + height` so a popover doesn't slip under the
 *  bottom tabs or any visible bottom-anchored obstacles (live ticker
 *  bar, mission control strip, etc.). */
export function popoverBottomCeiling(): number {
  if (typeof window === 'undefined') return 9999;
  const base = window.innerHeight - 72; // bottom tab strip ≈ 64px + buffer
  const obstacles = rectTopOf('[data-popover-block-bottom]');
  return Math.min(base, obstacles - 8);
}
