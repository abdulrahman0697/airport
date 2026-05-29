/**
 * Periodic rewarded-offer scheduler (Phase 15).
 *
 * While the player is actively in the game (foreground, past the intro),
 * surface a rewarded offer every 5 minutes of play, alternating:
 *   5m → 15-minute income · 10m → 3-minute 2× speed-up · 15m → income · …
 * Each offer is a 15-second opt-in popup (watch or skip). Backgrounding
 * pauses the play-time clock so the cadence tracks real engagement.
 */
import { useEffect, useRef, useState } from 'react';
import { track } from '../../backend/analytics';
import { effectiveIncomePerSec } from '../../engine/economy';
import { useGameStore } from '../../state/store';
import { useUiStore } from '../../state/uiStore';
import { formatCash } from '../format';
import { showRewardedAd } from '../monetize/ads';
import { RewardOfferPopup } from './RewardOfferPopup';

const OFFER_INTERVAL_SEC = 300; // every 5 minutes of play
const INSTANT_YIELD_SECONDS = 15 * 60; // "15-minute yield"
const SPEED_UP_MS = 3 * 60 * 1000; // 3-minute 2× revenue

type Offer = 'instant_yield' | 'speed_up';

export function MonetizeOffers() {
  const introDismissed = useUiStore((s) => s.introDismissed);
  const grantYieldSeconds = useGameStore((s) => s.grantYieldSeconds);
  const startSpeedUp = useGameStore((s) => s.startSpeedUp);

  const [offer, setOffer] = useState<Offer | null>(null);
  const elapsed = useRef(0);
  const triggered = useRef(0);
  const offerRef = useRef<Offer | null>(null);
  offerRef.current = offer;

  useEffect(() => {
    if (!introDismissed) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      elapsed.current += 1;
      if (offerRef.current) return; // one at a time
      const nextMark = (triggered.current + 1) * OFFER_INTERVAL_SEC;
      if (elapsed.current >= nextMark) {
        const kind: Offer = triggered.current % 2 === 0 ? 'instant_yield' : 'speed_up';
        triggered.current += 1;
        track.adOffer(kind);
        setOffer(kind);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [introDismissed]);

  const estYield = (): string => {
    const s = useGameStore.getState().state;
    if (!s) return '';
    const amt = effectiveIncomePerSec(s, Date.now()) * INSTANT_YIELD_SECONDS;
    return amt > 0 ? ` (~$${formatCash(amt)})` : '';
  };

  if (!offer) return null;

  if (offer === 'instant_yield') {
    return (
      <RewardOfferPopup
        open
        kicker="Free bonus"
        title="Instant income boost"
        body={`Collect 15 minutes of income${estYield()} — watch a short ad.`}
        cta="Collect income"
        onWatch={async (): Promise<void> => {
          const ok = await showRewardedAd('instant_yield');
          if (ok) grantYieldSeconds(INSTANT_YIELD_SECONDS, Date.now());
        }}
        onClose={(): void => setOffer(null)}
      />
    );
  }

  return (
    <RewardOfferPopup
      open
      kicker="Free bonus"
      title="Double revenue · 3 min"
      body="Watch a short ad to double all revenue for 3 minutes."
      cta="Start 2× boost"
      onWatch={async (): Promise<void> => {
        const ok = await showRewardedAd('speed_up');
        if (ok) startSpeedUp(Date.now(), SPEED_UP_MS);
      }}
      onClose={(): void => setOffer(null)}
    />
  );
}
