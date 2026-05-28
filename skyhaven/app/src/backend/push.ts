/**
 * Push notification registration (BRD §13).
 *
 * On native Android we ask the OS for notification permission, kick
 * the FCM registration handshake, and persist the resulting token to
 * the player's public profile so server-side senders (the
 * `sendComebackPush` Cloud Function) can address it.
 *
 * Web is a no-op — Capacitor's push-notifications plugin only ships
 * Android + iOS implementations and the in-WebView dev build wouldn't
 * have a token anyway.
 *
 * Design Review v4 — point 1. The system permission popup is NEVER
 * fired at launch. The player has to *earn* the prompt by completing
 * a meaningful milestone first (first route + first offline-income
 * moment). The opening permission popup was the worst possible first
 * impression — it made the app feel needy before the player even
 * understood what they were being asked about.
 */
import { Capacitor } from '@capacitor/core';
import { doc, setDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';
import { currentUid } from './auth';

let registered = false;
let permissionAsked = false;

/**
 * Boot-time call. Sets up listeners + persists the token if permission
 * was already granted in a previous session — but never fires the
 * permission popup. Safe to call at launch.
 */
export async function initPushNotifications(): Promise<void> {
  if (registered) return;
  if (!Capacitor.isNativePlatform()) return;
  registered = true;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    // Check current permission without prompting.
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      // No popup at launch — wait for an in-game trigger.
      return;
    }
    permissionAsked = true;
    PushNotifications.addListener('registration', (token) => {
      void persistFcmToken(token.value);
    });
    PushNotifications.addListener('registrationError', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[skyhaven] push registration error', err);
    });
    await PushNotifications.register();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] push init failed', err);
  }
}

/**
 * Triggered from the in-game "stay-in-touch" card after the player
 * earns their first offline income. The card explains the value
 * BEFORE the OS popup appears, which is the difference between a
 * needy first-launch ask and a welcome ongoing-engagement ask.
 *
 * Returns true if permission was granted (now or previously).
 */
export async function requestPushPermissionInGame(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (permissionAsked) return true;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    permissionAsked = true;
    if (perm.receive !== 'granted') return false;
    PushNotifications.addListener('registration', (token) => {
      void persistFcmToken(token.value);
    });
    PushNotifications.addListener('registrationError', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[skyhaven] push registration error', err);
    });
    await PushNotifications.register();
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] push request failed', err);
    return false;
  }
}

async function persistFcmToken(token: string): Promise<void> {
  const uid = currentUid();
  if (!uid || !token) return;
  try {
    await setDoc(
      doc(getFirebaseFirestore(), 'profiles', uid),
      {
        uid,
        fcmToken: token,
        fcmTokenUpdatedMs: Date.now(),
      },
      { merge: true },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[skyhaven] FCM token persist failed', err);
  }
}
