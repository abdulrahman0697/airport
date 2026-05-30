/**
 * One-off admin script: wipe ALL player data for a fresh test.
 *
 * Deletes every document in the user-data collections so you can
 * re-onboard from scratch (and re-test unique airline names) with no
 * leftover state. Static/config collections (`events`) are left alone.
 *
 * Collections cleared:
 *   players/        — per-player cloud saves
 *   profiles/       — public profile mirrors
 *   friendCodes/    — friend-code reservation index
 *   airlineNames/   — unique-name reservation index
 *   friendships/    — friend graph
 *   gifts/          — pending gifts
 *   leaderboards/{board}/entries/  — all leaderboard entries
 *
 * ── REQUIREMENTS ──────────────────────────────────────────────────
 * This needs Firebase Admin credentials — it canNOT run in the Claude
 * Code web sandbox. Run it locally / in a trusted shell:
 *
 *   1. Download a service-account key from the Firebase console
 *      (Project settings → Service accounts → Generate new private key).
 *   2. export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/serviceAccount.json
 *      export SKYHAVEN_RESET_CONFIRM=YES   # safety gate
 *   3. From skyhaven/functions (which has firebase-admin installed):
 *        node ../scripts/reset-user-data.mjs
 *
 * The SKYHAVEN_RESET_CONFIRM=YES gate prevents an accidental wipe.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (process.env.SKYHAVEN_RESET_CONFIRM !== 'YES') {
  console.error(
    'Refusing to run: set SKYHAVEN_RESET_CONFIRM=YES to confirm you want to\n' +
    'permanently delete ALL player data. (And GOOGLE_APPLICATION_CREDENTIALS\n' +
    'must point at a service-account key.)',
  );
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

/** Delete every doc in a top-level collection, in batches of 400. */
async function clearCollection(path) {
  const col = db.collection(path);
  let total = 0;
  for (;;) {
    const snap = await col.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  console.log(`  cleared ${total} docs from ${path}`);
}

async function clearLeaderboards() {
  const boards = await db.collection('leaderboards').listDocuments();
  for (const board of boards) {
    await clearCollection(`leaderboards/${board.id}/entries`);
  }
  console.log(`  cleared entries under ${boards.length} leaderboard(s)`);
}

async function main() {
  console.log('Wiping SkyHaven player data…');
  await clearCollection('players');
  await clearCollection('profiles');
  await clearCollection('friendCodes');
  await clearCollection('airlineNames');
  await clearCollection('friendships');
  await clearCollection('gifts');
  await clearLeaderboards();
  console.log('Done. Fresh slate.');
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
