import { describe, expect, it } from 'vitest';
import { applyServerEvents } from './actions';
import { createInitialState } from './initialState';
import type { ActiveEvent } from './types';

function mkEvent(id: string, startedAt: number, durationMs = 60_000): ActiveEvent {
  return {
    id,
    kind: 'tourism_boom',
    regionId: 3,
    announcedAt: startedAt - 30_000,
    startedAt,
    durationMs,
  };
}

describe('applyServerEvents', () => {
  const base = createInitialState(0);

  it('adds a new server event', () => {
    const now = 100_000;
    const evt = mkEvent('srv:boom-2026', now + 30_000);
    const out = applyServerEvents(base, [evt], now);
    expect(out.activeEvents).toHaveLength(1);
    expect(out.activeEvents[0]!.id).toBe('srv:boom-2026');
  });

  it('dedupes by id when the event is already active', () => {
    const now = 100_000;
    const evt = mkEvent('srv:boom-2026', now + 30_000);
    const first = applyServerEvents(base, [evt], now);
    const second = applyServerEvents(first, [evt], now);
    expect(second).toBe(first);
    expect(second.activeEvents).toHaveLength(1);
  });

  it('skips events that have already ended', () => {
    const now = 1_000_000;
    const expired = mkEvent('srv:past', now - 200_000, 60_000);
    const out = applyServerEvents(base, [expired], now);
    expect(out.activeEvents).toHaveLength(0);
  });

  it('returns the same state when nothing is added', () => {
    const out = applyServerEvents(base, [], 0);
    expect(out).toBe(base);
  });
});
