import { describe, expect, it } from 'vitest';
import { createInitialState } from '../engine/initialState';
import { chooseWinner, type CloudSaveDoc } from './cloudSave';

function mkCloud(earn: number, updatedAtMs: number, base = createInitialState(0)): CloudSaveDoc {
  return {
    state: { ...base, lifetimeEarnings: earn },
    updatedAtMs,
    schemaVersion: base.schemaVersion,
  };
}

describe('chooseWinner (progress-favouring)', () => {
  const localBase = createInitialState(0);

  it('pushes local up when no cloud doc exists', () => {
    const d = chooseWinner({ ...localBase, lifetimeEarnings: 50_000 }, 1, null);
    expect(d.reason).toBe('no-cloud');
    expect(d.applyLocal).toBe(false);
    expect(d.push).toBe(true);
  });

  it('cloud wins when its lifetime earnings are strictly higher', () => {
    const local = { ...localBase, lifetimeEarnings: 10_000 };
    const cloud = mkCloud(20_000, 5);
    const d = chooseWinner(local, 100, cloud);
    expect(d.reason).toBe('cloud-newer');
    expect(d.applyLocal).toBe(true);
    expect(d.push).toBe(false);
    expect(d.state.lifetimeEarnings).toBe(20_000);
  });

  it('local wins when its lifetime earnings are strictly higher', () => {
    const local = { ...localBase, lifetimeEarnings: 50_000 };
    const cloud = mkCloud(20_000, 5_000);
    const d = chooseWinner(local, 1, cloud);
    expect(d.reason).toBe('local-newer');
    expect(d.applyLocal).toBe(false);
    expect(d.push).toBe(true);
  });

  it('breaks ties by updatedAtMs', () => {
    const local = { ...localBase, lifetimeEarnings: 10_000 };
    const cloudNewer = mkCloud(10_000, 10_000);
    const cloudOlder = mkCloud(10_000, 1);
    expect(chooseWinner(local, 1, cloudNewer).reason).toBe('cloud-newer');
    expect(chooseWinner(local, 10_000, cloudOlder).reason).toBe('local-newer');
  });

  it('reports identical when both earnings and timestamps match', () => {
    const local = { ...localBase, lifetimeEarnings: 5_000 };
    const cloud = mkCloud(5_000, 1);
    const d = chooseWinner(local, 1, cloud);
    expect(d.reason).toBe('identical');
    expect(d.applyLocal).toBe(false);
    expect(d.push).toBe(false);
  });
});
