/**
 * Firebase app singleton (BRD §11.1).
 *
 * Initialised lazily — the engine and Pixi layers don't need Firebase
 * to be ready, so we only spin up the SDK when a backend feature
 * (auth, cloud save) is actually used. This keeps the cold-start
 * critical path short on mid-range Android.
 *
 * The Firestore client opts in to IndexedDB persistence so writes
 * queued offline flush automatically when the device reconnects —
 * airplane mode does not block local play (BRD §11.3 acceptance).
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { FIREBASE_CONFIG } from './config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let functions: Functions | null = null;

function ensureApp(): FirebaseApp {
  if (app) return app;
  app = initializeApp(FIREBASE_CONFIG);
  return app;
}

/** The initialised Firebase app (lazily created). */
export function getFirebaseApp(): FirebaseApp {
  return ensureApp();
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  // Persist the session explicitly so a signed-in user survives an app
  // restart. The default `getAuth` persistence detection is unreliable
  // inside the Capacitor Android WebView, which made returning Google
  // users land back on the sign-in prompt. IndexedDB is preferred, with
  // localStorage and then in-memory as fallbacks (private mode / blocked
  // storage). `initializeAuth` must run before any `getAuth`, so this is
  // the single auth entry point.
  try {
    auth = initializeAuth(ensureApp(), {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    });
  } catch {
    // Already initialised (e.g. Vite HMR) — fall back to the existing instance.
    auth = getAuth(ensureApp());
  }
  return auth;
}

export function getFirebaseFirestore(): Firestore {
  if (firestore) return firestore;
  const a = ensureApp();
  try {
    // Offline persistence with multi-tab support. Falls back to plain
    // `getFirestore` if the browser blocks IndexedDB (private windows).
    firestore = initializeFirestore(a, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    firestore = getFirestore(a);
  }
  return firestore;
}

/** Callable Cloud Functions client (region must match the deployed fns). */
export function getFirebaseFunctions(): Functions {
  if (functions) return functions;
  functions = getFunctions(ensureApp(), 'us-central1');
  return functions;
}
