/**
 * Haptics dispatcher (BRD §10).
 *
 * Thin wrapper around `@capacitor/haptics` so call sites don't have to
 * deal with the async/may-throw native API. Each method is a no-op on
 * environments where haptics aren't available (web preview, or when
 * the player has disabled them via OS settings).
 *
 * The vocabulary maps loosely to BRD §10 action categories:
 *  - selection — UI tap / toggle / pricing change
 *  - light    — small confirmation (collectible claim)
 *  - medium   — meaningful purchase (aircraft, contract, upgrade)
 *  - heavy    — large celebratory action (hub creation, manager hire)
 *  - success  — milestone landed (tier unlock, vintage drop)
 *  - warning  — failed action / fuel shortfall
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Player preference (persisted to localStorage). When off, every haptic
// call becomes a no-op so the device never vibrates. Defaults to on.
const HAPTICS_KEY = 'skyhaven.haptics.enabled.v1';
function readEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = window.localStorage.getItem(HAPTICS_KEY);
    return v === null ? true : v === '1';
  } catch { return true; }
}
let enabled = readEnabled();

const safe = <T extends unknown[]>(fn: (...args: T) => Promise<unknown>) =>
  (...args: T): void => { if (!enabled) return; fn(...args).catch(() => undefined); };

export const haptics = {
  selection: safe(() => Haptics.selectionChanged()),
  light: safe(() => Haptics.impact({ style: ImpactStyle.Light })),
  medium: safe(() => Haptics.impact({ style: ImpactStyle.Medium })),
  heavy: safe(() => Haptics.impact({ style: ImpactStyle.Heavy })),
  success: safe(() => Haptics.notification({ type: NotificationType.Success })),
  warning: safe(() => Haptics.notification({ type: NotificationType.Warning })),
  /** Whether device vibrations are currently enabled. */
  isEnabled(): boolean { return enabled; },
  /** Toggle device vibrations; persisted across sessions. */
  setEnabled(v: boolean): void {
    enabled = v;
    try { window.localStorage.setItem(HAPTICS_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  },
};
