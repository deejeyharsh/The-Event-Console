import { initializeApp } from 'firebase/app';
import { getFirestore, doc } from 'firebase/firestore';

const app = initializeApp({ projectId: "test", apiKey: "test" });
const db = getFirestore(app);

try {
  doc(db, "weddings/123/guests", undefined);
} catch (e) {
  console.log("ERROR MESSAGE IS:", e.message);
}
