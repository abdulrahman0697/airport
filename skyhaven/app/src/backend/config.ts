/**
 * Firebase client config (BRD §11.1).
 *
 * Mirrors the values in `android/app/google-services.json`. These are
 * public client identifiers — Firebase's security model relies on
 * Firestore rules + Auth, not on hiding these strings. Same values
 * are baked into the Android APK by the Gradle plugin.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDQtjpYBADMzoXVj3bavPFAJcRqs1vpAzM',
  authDomain: 'sky-haven-game.firebaseapp.com',
  projectId: 'sky-haven-game',
  storageBucket: 'sky-haven-game.firebasestorage.app',
  messagingSenderId: '354002953206',
  appId: '1:354002953206:android:20e423b3f3df87aa335dd7',
} as const;
