/**
 * Cloud sync controller (BRD §11.3).
 *
 * Glues the auth + cloudSave primitives into the game loop:
 *  - Subscribes to auth changes; on a uid arriving, pulls the cloud
 *    save and reconciles it with local state via `chooseWinner`.
 *  - Subscribes to the Zustand store; throttles a push to Firestore
 *    on every state change.
 *  - Survives offline play — every operation is wrapped in try/catch
 *    and Firestore's offline queue takes care of the rest (BRD §11.3
 *    airplane-mode acceptance).
 */
import { ensureAnonymous, subscribeAuth, type AuthUser } from './auth';
import {
  chooseWinner,
  createCloudPushThrottle,
  pullSave,
  pushSave,
} from './cloudSave';
import { submitAllBoards } from './leaderboards';
import { pushProfile } from './profiles';
import { subscribeServerEvents } from './serverEvents';
import { cashPerSecond } from '../engine/economy';
import { getAircraftDef } from '../data/aircraft';
import { BOARDS } from '../data/leaderboards';
import { useGameStore } from '../state/store';
import type { SaveState } from '../engine/types';

const PUSH_INTERVAL_MS = 15_000;
const LEADERBOARD_INTERVAL_MS = 60_000;

function computePerMin(s: SaveState): number {
  const byUid = new Map(s.fleet.map((a) => [a.uid, a]));
  let totalPerSec = 0;
  for (const r of s.routes) {
    const ac = byUid.get(r.aircraftUid);
    if (!ac || !getAircraftDef(ac.defId)) continue;
    totalPerSec += cashPerSecond(r, ac, s.hubs, s.activeEvents);
  }
  return totalPerSec * 60;
}

function sessionTimeSec(s: SaveState): number {
  return Math.max(0, Math.floor((Date.now() - s.createdAtMs) / 1000));
}

function entriesFromState(s: SaveState): { board: 'lifetime' | 'perMinute' | 'eco' | 'vintage'; score: number }[] {
  const perMin = computePerMin(s);
  return BOARDS.map((b) => ({ board: b.id, score: b.selector(s, perMin) }));
}

export interface CloudSync {
  stop(): void;
}

export function startCloudSync(): CloudSync {
  // Belt-and-braces try/catch around the entire init — if Firebase
  // can't even initialise (e.g. native side missing google-services
  // config, network unavailable at boot), we return a no-op so the
  // local game is never blocked by a backend failure (BRD §11.3).
  try {
    const throttle = createCloudPushThrottle(pushSave, PUSH_INTERVAL_MS);
    let lastUid: string | null = null;
    let lastPushedAt = Date.now();
    let currentUser: AuthUser | null = null;

    // Throttle leaderboard submissions independently from the save
    // mirror so scoring updates ride at a calmer cadence (and we
    // don't hit Cloud Functions on every tick).
    let lastLeaderboardAt = 0;
    let leaderboardTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleLeaderboard = (): void => {
      if (!lastUid) return;
      const state = useGameStore.getState().state;
      if (!state) return;
      const since = Date.now() - lastLeaderboardAt;
      const fire = (): void => {
        lastLeaderboardAt = Date.now();
        leaderboardTimer = null;
        const meta = {
          sessionTimeSec: sessionTimeSec(state),
          displayName: currentUser?.displayName ?? state.airlineName,
          photoUrl: currentUser?.photoUrl ?? null,
        };
        void submitAllBoards(entriesFromState(state), meta);
        // Public profile mirror rides the same throttle window so
        // friends see fresh airline name / tier / lifetime without
        // hitting Firestore on every tick.
        void pushProfile(state);
      };
      if (since >= LEADERBOARD_INTERVAL_MS) fire();
      else if (!leaderboardTimer) {
        leaderboardTimer = setTimeout(fire, LEADERBOARD_INTERVAL_MS - since);
      }
    };

    const unsubAuth = subscribeAuth((user) => {
      currentUser = user;
      if (!user) { lastUid = null; return; }
      if (user.uid === lastUid) return;
      lastUid = user.uid;
      void (async () => {
        try {
          const cloud = await pullSave();
          const local = useGameStore.getState().state;
          if (!local) return;
          const decision = chooseWinner(local, lastPushedAt, cloud);
          // eslint-disable-next-line no-console
          console.info('[skyhaven] cloud sync', { uid: user.uid, reason: decision.reason });
          if (decision.applyLocal) useGameStore.getState().setState(decision.state);
          if (decision.push) {
            const s = useGameStore.getState().state;
            if (s) throttle.schedule(s);
          }
          scheduleLeaderboard();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[skyhaven] cloud reconcile failed', err);
        }
      })();
    });

    const unsubStore = useGameStore.subscribe((s) => {
      if (!s.state) return;
      if (!lastUid) return;
      lastPushedAt = Date.now();
      throttle.schedule(s.state);
      scheduleLeaderboard();
    });

    // Server-driven event stream (Phase 13.1). Doesn't depend on
    // sign-in: the Firestore rules allow auth-read on events/, and
    // the events themselves are publicly visible to every player.
    const serverEvents = subscribeServerEvents((events) => {
      useGameStore.getState().applyServerEvents(events);
    });

    void ensureAnonymous();

    return {
      stop(): void {
        unsubAuth();
        unsubStore();
        serverEvents.stop();
        if (leaderboardTimer) { clearTimeout(leaderboardTimer); leaderboardTimer = null; }
        void throttle.flush();
      },
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] cloud sync init failed; running local-only', err);
    return { stop: () => undefined };
  }
}
