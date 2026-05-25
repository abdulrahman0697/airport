/**
 * Deterministic fixed-timestep simulation tick (BRD §2.4).
 * Phase 0 stub — real economy/fuel/routes/condition land in Phase 2+.
 */
export const TICK_HZ = 10;
export const TICK_MS = 1000 / TICK_HZ;

export interface TickContext {
  readonly nowMs: number;
  readonly dtMs: number;
}

export type TickFn<S> = (state: S, ctx: TickContext) => S;
