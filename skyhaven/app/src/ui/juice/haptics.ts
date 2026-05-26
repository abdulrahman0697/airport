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

const safe = <T extends unknown[]>(fn: (...args: T) => Promise<unknown>) =>
  (...args: T): void => { fn(...args).catch(() => undefined); };

export const haptics = {
  selection: safe(() => Haptics.selectionChanged()),
  light: safe(() => Haptics.impact({ style: ImpactStyle.Light })),
  medium: safe(() => Haptics.impact({ style: ImpactStyle.Medium })),
  heavy: safe(() => Haptics.impact({ style: ImpactStyle.Heavy })),
  success: safe(() => Haptics.notification({ type: NotificationType.Success })),
  warning: safe(() => Haptics.notification({ type: NotificationType.Warning })),
};
