import { db } from './src/firebase.js';
import { doc, getDoc } from 'firebase/firestore';

async function test() {
  try {
    const r = await getDoc(doc(db, "test", "test"));
    console.log(r.exists());
  } catch (e) {
    console.error(e);
  }
}
test();
