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
 */
import { Capacitor } from '@capacitor/core';
import { doc, setDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';
import { currentUid } from './auth';

let registered = false;

export async function initPushNotifications(): Promise<void> {
  if (registered) return;
  if (!Capacitor.isNativePlatform()) return;
  registered = true;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    // Android 13+ requires runtime permission for POST_NOTIFICATIONS.
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      // eslint-disable-next-line no-console
      console.info('[skyhaven] push permission denied — skipping registration');
      return;
    }
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
