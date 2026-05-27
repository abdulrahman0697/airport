/**
 * Server-driven event orchestration (BRD §13, Phase 13.1).
 *
 * Reads the `event_schedule` Remote Config parameter (JSON array) on
 * a 5-minute cadence and materialises future / running entries into
 * `events/{id}` Firestore documents. Clients subscribe to that
 * collection and merge new entries into their local activeEvents
 * array (see app/src/backend/serverEvents.ts).
 *
 * This is the path the BRD §19 row 13 acceptance exercises: edit the
 * RC schedule, wait one cycle, every client sees a new event without
 * needing an app update.
 *
 * Schedule entry shape (parsed from RC JSON):
 * {
 *   id: string,                 // canonical event id, used as doc id
 *   kind: EventKind,            // must match app/src/data/events.ts
 *   regionId: number | null,    // null for global events
 *   startsAtMs: number,         // epoch ms
 *   endsAtMs: number,           // epoch ms
 *   announceLeadMs?: number     // optional, defaults to 30 s
 * }
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getRemoteConfig } from 'firebase-admin/remote-config';

const VALID_KINDS = ['tourism_boom', 'holiday_rush', 'fuel_price_spike'] as const;
type ServerEventKind = typeof VALID_KINDS[number];

const LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000;
const RETENTION_AFTER_END_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ANNOUNCE_LEAD_MS = 30_000;

interface ScheduledEntry {
  id: string;
  kind: ServerEventKind;
  regionId: number | null;
  startsAtMs: number;
  endsAtMs: number;
  announceLeadMs: number;
}

function parseSchedule(raw: string): ScheduledEntry[] {
  let arr: unknown;
  try { arr = JSON.parse(raw); }
  catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out: ScheduledEntry[] = [];
  for (const v of arr) {
    if (!v || typeof v !== 'object') continue;
    const e = v as Record<string, unknown>;
    const id = typeof e.id === 'string' ? e.id : null;
    const kind = typeof e.kind === 'string' ? e.kind : null;
    const startsAtMs = typeof e.startsAtMs === 'number' ? e.startsAtMs : null;
    const endsAtMs = typeof e.endsAtMs === 'number' ? e.endsAtMs : null;
    if (!id || !kind || startsAtMs === null || endsAtMs === null) continue;
    if (!(VALID_KINDS as readonly string[]).includes(kind)) continue;
    if (endsAtMs <= startsAtMs) continue;
    const regionId = typeof e.regionId === 'number' ? e.regionId : null;
    const announceLeadMs = typeof e.announceLeadMs === 'number'
      ? Math.max(0, Math.min(10 * 60 * 1000, e.announceLeadMs))
      : DEFAULT_ANNOUNCE_LEAD_MS;
    out.push({ id, kind: kind as ServerEventKind, regionId, startsAtMs, endsAtMs, announceLeadMs });
  }
  return out;
}

async function readSchedule(): Promise<ScheduledEntry[]> {
  try {
    const tmpl = await getRemoteConfig().getServerTemplate();
    const cfg = tmpl.evaluate();
    const raw = cfg.getString('event_schedule') || '[]';
    return parseSchedule(raw);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[scheduledEvents] failed to read Remote Config', err);
    return [];
  }
}

export const publishScheduledEvents = onSchedule(
  { schedule: 'every 5 minutes', region: 'us-central1' },
  async () => {
    const now = Date.now();
    const entries = await readSchedule();
    const db = getFirestore();

    // Upsert anything in the active or near-future window.
    const upcoming = entries.filter((e) =>
      e.endsAtMs > now && e.startsAtMs <= now + LOOKAHEAD_MS
    );
    for (const e of upcoming) {
      const ref = db.collection('events').doc(e.id);
      await ref.set({
        id: e.id,
        kind: e.kind,
        regionId: e.regionId,
        announcedAt: Timestamp.fromMillis(Math.max(0, e.startsAtMs - e.announceLeadMs)),
        startedAt: Timestamp.fromMillis(e.startsAtMs),
        endsAt: Timestamp.fromMillis(e.endsAtMs),
        source: 'server',
      });
    }

    // GC: anything whose endsAt is more than RETENTION_AFTER_END_MS in
    // the past and is no longer scheduled. Keeps the events collection
    // bounded without clipping freshly-finished events the client
    // might still be animating out.
    const scheduledIds = new Set(entries.map((e) => e.id));
    const cutoff = Timestamp.fromMillis(now - RETENTION_AFTER_END_MS);
    const stale = await db.collection('events').where('endsAt', '<', cutoff).get();
    for (const doc of stale.docs) {
      if (!scheduledIds.has(doc.id)) await doc.ref.delete();
    }
  },
);
