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
import { ensureAnonymous, subscribeAuth } from './auth';
import {
  chooseWinner,
  createCloudPushThrottle,
  pullSave,
  pushSave,
} from './cloudSave';
import { useGameStore } from '../state/store';

const PUSH_INTERVAL_MS = 15_000;

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

    const unsubAuth = subscribeAuth((user) => {
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
    });

    void ensureAnonymous();

    return {
      stop(): void {
        unsubAuth();
        unsubStore();
        void throttle.flush();
      },
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] cloud sync init failed; running local-only', err);
    return { stop: () => undefined };
  }
}
