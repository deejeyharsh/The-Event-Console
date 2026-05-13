import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collectionGroup, query, where, getDocs, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    console.log("creating fake wedding via unauth? No wait we need auth to create.");
    
    // Instead let's just query to get ANY guest from the DB, and try to update it.
    console.log("Testing collectionGroup query (unauthenticated)...");
    const q = query(collectionGroup(db, 'guests'));
    const snap = await getDocs(q);
    console.log("Query success: found", snap.size, "guests");

    if (snap.size > 0) {
      const guest = snap.docs[0];
      console.log("Attempting to update guest", guest.ref.path);
      await updateDoc(guest.ref, {
        rsvpStatus: 'yes',
        updatedAt: new Date().toISOString()
      });
      console.log("Unauthenticated update success!");
    } else {
      console.log("No guests to update.");
    }

  } catch (e) {
    console.error("Test failed:", e.message);
  }
}
test();
