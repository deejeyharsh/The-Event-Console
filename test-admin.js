import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));

const app = admin.initializeApp({
  projectId: firebaseConfig.projectId
});
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const s = await db.collection('weddings').get();
    console.log('Weddings count:', s.size);
  } catch(e) {
    console.error('Error:', e);
  }
}
test();
