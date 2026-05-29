/**
 * Out-of-fuel rewarded offer (Phase 15).
 *
 * When the reserve runs dry while draining, prompt a rewarded ad that
 * refills fuel to 100%. Armed once per dry-out and re-armed after the
 * reserve recovers, so it never nags. Subscribes transiently (no
 * per-tick re-render).
 */
import { useEffect, useState } from 'react';
import { useGameStore } from '../../state/store';
import { showRewardedAd } from '../monetize/ads';
import { RewardOfferPopup } from './RewardOfferPopup';

export function FuelEmptyOffer() {
  const fillFuel = useGameStore((s) => s.fillFuel);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let armed = true;
    const unsub = useGameStore.subscribe((st) => {
      const f = st.state?.fuel;
      if (!f) return;
      const draining = f.supplyRate - f.demandRate < 0;
      const pct = f.capacity > 0 ? f.reserve / f.capacity : 1;
      if (draining && f.reserve <= 0 && armed) {
        armed = false;
        setOpen(true);
      } else if (pct >= 0.2) {
        armed = true;
      }
    });
    return unsub;
  }, []);

  return (
    <RewardOfferPopup
      open={open}
      kicker="Out of fuel"
      title="Refuel for free"
      body="Your reserve ran dry — watch a short ad to refill fuel to 100%."
      cta="Refill fuel"
      autoMs={0}
      onWatch={async (): Promise<void> => {
        const ok = await showRewardedAd('fuel_fill');
        if (ok) fillFuel();
      }}
      onClose={(): void => setOpen(false)}
    />
  );
}
