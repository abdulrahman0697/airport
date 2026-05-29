import { describe, expect, it } from 'vitest';
import { DAILY_MISSION_COUNT } from '../data/dailyMissions';
import { localDateKey, recomputeProgress, rollIfNeeded } from './dailyMissions';
import { createInitialState } from './initialState';
import { migrate } from './migrations';
import { CURRENT_SCHEMA_VERSION } from './types';

describe('dailyMissions', () => {
  it('rolls a fresh set on first call and snapshots state', () => {
    const s0 = createInitialState(0);
    const now = 1_700_000_000_000;
    const s1 = rollIfNeeded(s0, now);
    expect(s1.dailyMissions).not.toBeNull();
    expect(s1.dailyMissions!.missions).toHaveLength(DAILY_MISSION_COUNT);
    expect(s1.dailyMissions!.date).toBe(localDateKey(now));
    expect(s1.dailyMissionSnapshot).not.toBeNull();
    expect(s1.dailyMissionSnapshot!.routesCount).toBe(s0.routes.length);
    expect(s1.dailyMissionSnapshot!.fleetCount).toBe(s0.fleet.length);
  });

  it('is idempotent within the same day', () => {
    const s0 = createInitialState(0);
    const now = 1_700_000_000_000;
    const s1 = rollIfNeeded(s0, now);
    const s2 = rollIfNeeded(s1, now);
    expect(s2).toBe(s1);
  });

  it('re-rolls on date change', () => {
    const s0 = createInitialState(0);
    const day1 = new Date('2026-05-27T10:00:00').getTime();
    const day2 = new Date('2026-05-28T10:00:00').getTime();
    const s1 = rollIfNeeded(s0, day1);
    const s2 = rollIfNeeded(s1, day2);
    expect(s2.dailyMissions!.date).toBe(localDateKey(day2));
    expect(s2.dailyMissions!.date).not.toBe(s1.dailyMissions!.date);
  });

  it('updates buy_aircraft progress as the fleet grows', () => {
    let s = createInitialState(0);
    const now = 1_700_000_000_000;
    s = rollIfNeeded(s, now);
    // Add an aircraft to drive buy_aircraft progress against the snapshot.
    const first = s.fleet[0];
    if (first) {
      s = { ...s, fleet: [...s.fleet, { ...first, uid: 'ac-test-2' }] };
    }
    const s2 = recomputeProgress(s);
    const mission = s2.dailyMissions?.missions.find((m) => m.templateId === 'buy_aircraft');
    if (mission) {
      expect(mission.progress).toBeGreaterThan(0);
    }
  });
});

describe('migration v7 → v8', () => {
  it('defaults dailyMissions and dailyMissionSnapshot to null', () => {
    const v7 = { ...createInitialState(0), schemaVersion: 7 } as Record<string, unknown>;
    delete v7.dailyMissions;
    delete v7.dailyMissionSnapshot;
    const out = migrate(v7, Date.now()) as unknown as { schemaVersion: number; dailyMissions: unknown; dailyMissionSnapshot: unknown };
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.dailyMissions).toBeNull();
    expect(out.dailyMissionSnapshot).toBeNull();
  });
});
