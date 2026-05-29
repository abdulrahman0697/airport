/**
 * Fuel warning cues (no render).
 *
 * Subscribes to the game store and fires `fuel_low` when the reserve
 * dips below 20% while draining, and `fuel_critical` when it runs dry.
 * Each cue is armed once and only re-arms after the reserve recovers
 * (hysteresis), so a draining tank doesn't machine-gun the sound every
 * tick. Mounted once at the app root.
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '../../state/store';
import { sfx } from '../juice/sfx';

export function FuelAlerts() {
  const lowArmed = useRef(true);
  const critArmed = useRef(true);

  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
      const f = s.state?.fuel;
      if (!f) return;
      const draining = f.supplyRate - f.demandRate < 0;
      const pct = f.capacity > 0 ? f.reserve / f.capacity : 1;

      if (draining && f.reserve <= 0) {
        if (critArmed.current) { sfx.play('fuel_critical'); critArmed.current = false; }
      } else if (f.reserve > 0) {
        critArmed.current = true;
      }

      if (draining && f.reserve > 0 && pct < 0.20) {
        if (lowArmed.current) { sfx.play('fuel_low'); lowArmed.current = false; }
      } else if (pct >= 0.25) {
        lowArmed.current = true;
      }
    });
    return unsub;
  }, []);

  return null;
}
