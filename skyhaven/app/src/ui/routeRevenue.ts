/**
 * Route revenue framing for the Arrivals & Time model.
 *
 * Revenue lands per arrival, so route UI reads as a per-trip payout plus
 * how often a trip lands (real seconds per leg = the wait between
 * payouts), e.g. "+$1.2K · ~3m". Falls back to a bare payout when timing
 * is unavailable.
 */
import { legDurationMs, legRevenue } from '../engine/economy';
import type { ActiveEvent, Hub, OwnedAircraft, Route } from '../engine/types';
import { formatCash } from './format';

function formatWait(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `~${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `~${m}m` : `~${m}m ${s}s`;
}

/** "+$1.2K · ~3m" — payout per landing and the wait between landings. */
export function formatPerTrip(
  route: Route,
  aircraft: OwnedAircraft,
  hubs: readonly Hub[] = [],
  events: readonly ActiveEvent[] = [],
  globalYieldMult = 1,
): string {
  const pay = legRevenue(route, aircraft, hubs, events, globalYieldMult);
  const dur = legDurationMs(route, aircraft);
  const payText = `+$${formatCash(pay)}`;
  if (!isFinite(dur) || dur <= 0) return payText;
  return `${payText} · ${formatWait(dur)}`;
}
