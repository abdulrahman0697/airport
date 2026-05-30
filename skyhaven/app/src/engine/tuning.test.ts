import { afterEach, describe, expect, it } from 'vitest';
import { TUNING, applyEngineTuning, resetEngineTuning } from './tuning';
import { emptyHubManagers, networkBonusForRoute } from './hubs';

afterEach(() => resetEngineTuning());

describe('engine tuning', () => {
  it('defaults are identity / historical values', () => {
    expect(TUNING.globalYieldMult).toBe(1);
    expect(TUNING.hubBonusPerLevel).toBe(0.05);
    expect(TUNING.conditionDecayMult).toBe(1);
    expect(TUNING.fuelDemandMult).toBe(1);
    expect(TUNING.repairCostMult).toBe(1);
  });

  it('applies valid overrides and rejects malformed values', () => {
    applyEngineTuning({ globalYieldMult: 1.5, hubBonusPerLevel: -1, conditionDecayMult: NaN });
    expect(TUNING.globalYieldMult).toBe(1.5);
    expect(TUNING.hubBonusPerLevel).toBe(0.05); // negative rejected
    expect(TUNING.conditionDecayMult).toBe(1); // NaN rejected
  });

  it('hub network bonus reflects the tuning override', () => {
    const hub = { iata: 'AAA', level: 4, managers: emptyHubManagers() };
    expect(networkBonusForRoute([hub], 'AAA', 'BBB')).toBeCloseTo(0.20);
    applyEngineTuning({ hubBonusPerLevel: 0.10 });
    expect(networkBonusForRoute([hub], 'AAA', 'BBB')).toBeCloseTo(0.40);
  });

  it('resets cleanly to defaults', () => {
    applyEngineTuning({ globalYieldMult: 3 });
    resetEngineTuning();
    expect(TUNING.globalYieldMult).toBe(1);
  });
});
