/**
 * Live-event catalogue (BRD §4.12).
 *
 * Phase 6 ships three event types — one positive global, one positive
 * region-scoped, and one mitigable negative — to exercise the
 * scheduler, HUD banner, economy modifiers, and Crisis Manager. The
 * full BRD catalogue (government subsidy, airport expansion, crew
 * strike, storm advisory, fuel-price glut) layers on after launch
 * since the system is data-driven.
 */

export type EventKind = 'tourism_boom' | 'holiday_rush' | 'fuel_price_spike';

export interface EventDef {
  readonly kind: EventKind;
  readonly name: string;
  readonly description: string;
  readonly positive: boolean;
  /** Real-time duration of one occurrence, ms. */
  readonly durationMs: number;
  /** True if the event is scoped to one region (chosen at spawn time). */
  readonly regional: boolean;
}

export const EVENT_DEFS: Record<EventKind, EventDef> = {
  tourism_boom: {
    kind: 'tourism_boom',
    name: 'Tourism Boom',
    description: '+25% revenue for routes touching the region',
    positive: true,
    durationMs: 3 * 60 * 1000,
    regional: true,
  },
  holiday_rush: {
    kind: 'holiday_rush',
    name: 'Holiday Rush',
    description: '+20% load factor on every route',
    positive: true,
    durationMs: 2 * 60 * 1000,
    regional: false,
  },
  fuel_price_spike: {
    kind: 'fuel_price_spike',
    name: 'Fuel Price Spike',
    description: '−30% supply rate (half that with a Crisis Manager)',
    positive: false,
    durationMs: 90 * 1000,
    regional: false,
  },
};

/** Modifier helpers — consumed by the economy / fuel maths. */
export const EVENT_REVENUE_MULTIPLIER: Record<EventKind, number> = {
  tourism_boom: 1.25,
  holiday_rush: 1.0,        // load factor handled separately
  fuel_price_spike: 1.0,
};

export const EVENT_LOAD_FACTOR_BONUS: Record<EventKind, number> = {
  tourism_boom: 0,
  holiday_rush: 0.20,
  fuel_price_spike: 0,
};

export const EVENT_SUPPLY_MULTIPLIER: Record<EventKind, number> = {
  tourism_boom: 1.0,
  holiday_rush: 1.0,
  fuel_price_spike: 0.7,
};
