// Firebase App
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

// Firestore
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Authentication
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyACCFWRUJ9P9f1rRGJvPpZeS0_vpHynGaY",
  authDomain: "kanifnath-construction-erp.firebaseapp.com",
  projectId: "kanifnath-construction-erp",
  storageBucket: "kanifnath-construction-erp.firebasestorage.app",
  messagingSenderId: "306725462212",
  appId: "1:306725462212:web:22bf8c5536344b4c87a991",
  measurementId: "G-XS3SPRQD9J"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// Keep the visitor signed in on this device/browser until they explicitly log out.
setPersistence(auth, browserLocalPersistence).catch(() => {});

/**
 * Atomically increments a running counter stored at counters/{counterName}
 * and returns the new value. Used for Invoice No. / Quotation No. so two
 * devices saving at the same moment never get the same number.
 */
export async function getNextCounterValue(counterName) {
  const counterRef = doc(db, "counters", counterName);
  const newValue = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = snap.exists() ? (Number(snap.data().value) || 0) : 0;
    const next = current + 1;
    transaction.set(counterRef, { value: next });
    return next;
  });
  return newValue;
}

export {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  serverTimestamp,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
};
