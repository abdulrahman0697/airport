/**
 * Server-driven live events (BRD §13).
 *
 * Subscribes to the `events/{id}` Firestore collection (which the
 * `publishScheduledEvents` Cloud Function materialises from Remote
 * Config). Every fresh entry is mapped to the local ActiveEvent shape
 * and dispatched through the store's `applyServerEvents` action.
 *
 * Server events ride the same engine path as client-rolled ones —
 * EventBanner / EventPopup render them identically, the economy maths
 * apply, and Crisis Manager mitigation still flows. The only
 * difference is the source: client xorshift versus a Cloud Function
 * walking the schedule.
 */
import {
  collection,
  onSnapshot,
  query,
  where,
  type Firestore,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';
import type { ActiveEvent } from '../engine/types';
import type { EventKind } from '../data/events';

const VALID_KINDS = ['tourism_boom', 'holiday_rush', 'fuel_price_spike'] as const;

function isEventKind(k: unknown): k is EventKind {
  return typeof k === 'string' && (VALID_KINDS as readonly string[]).includes(k);
}

function tsMs(v: unknown): number | null {
  if (v && typeof v === 'object' && 'toMillis' in v) {
    const fn = (v as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn.call(v);
  }
  return typeof v === 'number' ? v : null;
}

function db(): Firestore { return getFirebaseFirestore(); }

function toActiveEvent(raw: Record<string, unknown>): ActiveEvent | null {
  const id = typeof raw.id === 'string' ? raw.id : null;
  const kind = raw.kind;
  if (!id || !isEventKind(kind)) return null;
  const announcedAt = tsMs(raw.announcedAt);
  const startedAt = tsMs(raw.startedAt);
  const endsAt = tsMs(raw.endsAt);
  if (announcedAt === null || startedAt === null || endsAt === null) return null;
  if (endsAt <= startedAt) return null;
  const regionId = typeof raw.regionId === 'number' ? raw.regionId : null;
  return {
    id,
    kind,
    regionId,
    announcedAt,
    startedAt,
    durationMs: endsAt - startedAt,
  };
}

export interface ServerEventsSubscription { stop(): void }

/**
 * Subscribe to upcoming + running server events and pipe them into
 * the store. Returns a stop handle; safe to call repeatedly.
 */
export function subscribeServerEvents(
  dispatch: (events: readonly ActiveEvent[]) => void,
): ServerEventsSubscription {
  try {
    const nowTs = { toMillis: () => Date.now() } as Timestamp;
    // Note: `endsAt > now` filters out expired events. The 24h GC in
    // the Cloud Function clears even older entries, but this is the
    // defence in depth.
    const q = query(collection(db(), 'events'), where('endsAt', '>', nowTs));
    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        const out: ActiveEvent[] = [];
        for (const doc of snap.docs) {
          const ev = toActiveEvent({ id: doc.id, ...doc.data() });
          if (ev) out.push(ev);
        }
        if (out.length > 0) dispatch(out);
      },
      (err) => {
        // eslint-disable-next-line no-console
        console.warn('[skyhaven] serverEvents snapshot error', err);
      },
    );
    return { stop: (): void => unsub() };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] subscribeServerEvents init failed', err);
    return { stop: () => undefined };
  }
}
