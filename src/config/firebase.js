import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA7bbNanaC5dDV3wnaLrU8HT-bySmVMUVU",
  authDomain: "futuremove-86603.firebaseapp.com",
  projectId: "futuremove-86603",
  storageBucket: "futuremove-86603.firebasestorage.app",
  messagingSenderId: "765249859918",
  appId: "1:765249859918:web:f80304cebf58204de06e1f",
  measurementId: "G-09284YZSRN"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };