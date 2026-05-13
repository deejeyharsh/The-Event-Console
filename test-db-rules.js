import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    console.log("Testing collectionGroup query (unauthenticated)...");
    const q = query(collectionGroup(db, 'guests'), where('phone', '==', '1234567890'));
    const snap = await getDocs(q);
    console.log("Query success: found", snap.size);
  } catch (e) {
    console.error("Query failed:", e.message);
  }
}
test();
